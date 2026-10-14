import {AgentWorkProfileError} from './agent-work-profile-model';

export const agentWorkReadLimits = {
  canonicalWireBytes: 8_388_608,
  proofBytes: 16_777_216,
  bindingBytes: 1_500_000,
  rowWireBytes: 1_499_998,
  sqlBytes: 100_000,
  parameters: 100,
} as const;

type Table = 'experiment_reviews' | 'experiment_records' | 'strategy_publications'
  | 'experiment_review_moderation' | 'experiment_moderation' | 'strategy_moderation';
type Selector = {column: 'id' | 'record_id'; ids: string[]};
type Frame = {table: Table; fields: readonly string[]; selector?: Selector; rows: object[]};
const bytes = (value: string) => new TextEncoder().encode(value).byteLength;
const unavailable = () => new AgentWorkProfileError('Current work evidence cannot be read consistently within this view. Retained records were preserved.', 503);
const capacity = () => new AgentWorkProfileError('Current work evidence exceeds the bounded profile view. No partial profile or score was produced.', 503);

/** A request-local, read-only snapshot. Admission is checked in SQL before full
 * row material crosses the binding. The final statement compares exact source
 * bytes and complete selected membership together, rather than digest labels. */
export class AgentWorkProfileSnapshot {
  private frames: Frame[] = [];
  private admittedBytes = 0;
  constructor(private db: D1Database) {}

  async read<T extends object>(table: Table, fields: readonly string[], maximumRows: number, selector?: Selector): Promise<T[]> {
    if (this.frames.some(frame => frame.table === table) || fields.length > 16 || !fields.includes('payload')
      || fields.some(field => !/^[a-z_]+$/.test(field)) || !Number.isSafeInteger(maximumRows) || maximumRows < 0) throw unavailable();
    if (selector && (selector.ids.length > 1000 || new Set(selector.ids).size !== selector.ids.length
      || selector.ids.some(id => !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id)))) throw unavailable();
    const values: string[] = selector ? [JSON.stringify(selector.ids)] : [];
    const where = selector ? ` WHERE ${selector.column} IN (SELECT value FROM json_each(?1))` : '';
    const pack = `json_object(${fields.flatMap(field => [`'${field}'`, field]).join(',')})`;
    const size = `COALESCE(SUM(length(CAST(${pack} AS BLOB))),0)`;
    const largest = `COALESCE(MAX(length(CAST(${pack} AS BLOB))),0)`;
    const metadata = await this.db.prepare(`SELECT COUNT(*) AS count,${size} AS bytes,${largest} AS largest FROM ${table}${where}`)
      .bind(...values).first<{count: number; bytes: number; largest: number}>();
    if (!metadata || !Number.isSafeInteger(metadata.count) || !Number.isSafeInteger(metadata.bytes)
      || !Number.isSafeInteger(metadata.largest) || metadata.count < 0 || metadata.bytes < 0 || metadata.largest < 0) throw unavailable();
    if (metadata.count > maximumRows || metadata.largest > agentWorkReadLimits.rowWireBytes || this.admittedBytes + metadata.bytes > agentWorkReadLimits.canonicalWireBytes) throw capacity();
    const amount = '?' + (values.length + 1), count = '?' + (values.length + 2);
    // This second admission occurs in the same SQL snapshot as the payload read.
    // A race after preflight returns null material instead of allocating a larger catalog.
    const result = await this.db.prepare(`SELECT CASE WHEN (SELECT ${size} FROM ${table}${where})<=${amount}
      AND (SELECT COUNT(*) FROM ${table}${where})=${count} AND (SELECT ${largest} FROM ${table}${where})<=${agentWorkReadLimits.rowWireBytes} THEN ${pack} ELSE NULL END AS material
      FROM ${table}${where} LIMIT ${maximumRows + 1}`).bind(...values, metadata.bytes, metadata.count)
      .all<{material: string | null}>();
    if (result.results.length !== metadata.count) throw unavailable();
    let actualBytes = 0;
    const rows: T[] = [];
    for (const row of result.results) {
      if (typeof row.material !== 'string') throw unavailable();
      actualBytes += bytes(row.material);
      if (actualBytes > metadata.bytes) throw unavailable();
      let decoded: T;
      try { decoded = JSON.parse(row.material); } catch { throw unavailable(); }
      if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) throw unavailable();
      rows.push(decoded);
    }
    if (actualBytes !== metadata.bytes) throw unavailable();
    this.admittedBytes += actualBytes;
    this.frames.push({table, fields, selector, rows});
    return rows;
  }

  async confirm(): Promise<void> {
    const bindings: string[] = [];
    const ctes: string[] = [], predicates: string[] = [];
    let proofBytes = 0;
    const add = (value: string) => {
      if (bytes(value) > agentWorkReadLimits.bindingBytes) throw capacity();
      proofBytes += bytes(value);
      if (proofBytes > agentWorkReadLimits.proofBytes || bindings.length >= agentWorkReadLimits.parameters) throw capacity();
      bindings.push(value); return '?' + bindings.length;
    };
    for (const [index, frame] of this.frames.entries()) {
      const chunks: string[] = []; let items: string[] = [], length = 2;
      const flush = () => { if (items.length) { chunks.push(add('[' + items.join(',') + ']')); items = []; length = 2; } };
      for (const row of frame.rows) {
        const material = JSON.stringify(row), size = bytes(material);
        if (size + 2 > agentWorkReadLimits.bindingBytes) throw capacity();
        if (length + size + (items.length ? 1 : 0) > agentWorkReadLimits.bindingBytes) flush();
        length += size + (items.length ? 1 : 0); items.push(material);
      }
      flush(); if (!chunks.length) chunks.push(add('[]'));
      const name = 'expected_' + index;
      ctes.push(`${name} AS (${chunks.map(parameter => `SELECT value FROM json_each(${parameter})`).join(' UNION ALL ')})`);
      const where = frame.selector ? ` WHERE ${frame.selector.column} IN (SELECT value FROM json_each(${add(JSON.stringify(frame.selector.ids))}))` : '';
      predicates.push(`(SELECT COUNT(*) FROM ${frame.table}${where})=(SELECT COUNT(*) FROM ${name})`);
      const equal = frame.fields.map(field => `actual.${field} IS json_extract(expected.value,'$.${field}')`).join(' AND ');
      predicates.push(`NOT EXISTS(SELECT 1 FROM ${name} expected WHERE NOT EXISTS(SELECT 1 FROM ${frame.table} actual WHERE ${equal}))`);
    }
    const sql = `WITH ${ctes.join(',')} SELECT CASE WHEN ${predicates.join(' AND ')} THEN 1 ELSE 0 END AS matches`;
    if (!this.frames.length || bytes(sql) > agentWorkReadLimits.sqlBytes) throw capacity();
    const result = await this.db.prepare(sql).bind(...bindings).first<{matches: number}>();
    if (result?.matches !== 1) throw unavailable();
  }
}
