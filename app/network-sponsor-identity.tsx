'use client';

import {useEffect, useRef, useState} from 'react';
import {contributionMeSchema} from './contribution-model';
import {parseUniqueJson} from './unique-json';

const endpoint = '/api/contributions/discussion/me';
const responseBytes = 1024;
class SponsorIdentityError extends Error {
  constructor(readonly code: 'AUTHENTICATION_LOST' | 'UNAVAILABLE' | 'CANCELLED') { super(code); }
}
async function abortable<T>(operation: () => Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) throw new SponsorIdentityError('CANCELLED');
  let stop: () => void = () => {};
  const cancelled = new Promise<never>((_, reject) => { stop = () => reject(new SponsorIdentityError('CANCELLED')); signal.addEventListener('abort', stop, {once: true}); });
  try { return await Promise.race([Promise.resolve().then(() => { if (signal.aborted) throw new SponsorIdentityError('CANCELLED'); return operation(); }), cancelled]); }
  finally { signal.removeEventListener('abort', stop); }
}
/** Existing authenticated read only. No token, owner ID, origin inference or publication. */
async function readSponsor(signal: AbortSignal, isCurrent: () => boolean): Promise<string> {
  let response: Response | null = null, reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  try {
    response = await abortable(() => { if (!isCurrent()) throw new SponsorIdentityError('CANCELLED'); return fetch(endpoint, {method: 'GET', credentials: 'same-origin', cache: 'no-store', redirect: 'error', headers: {Accept: 'application/json'}, signal}); }, signal);
    if (response.status === 401 || response.status === 403) throw new SponsorIdentityError('AUTHENTICATION_LOST');
    if (!response.ok || response.redirected || (response.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase() !== 'application/json') throw new SponsorIdentityError('UNAVAILABLE');
    const length = response.headers.get('Content-Length');
    if (length !== null && (!/^\d{1,6}$/.test(length) || Number(length) > responseBytes)) throw new SponsorIdentityError('UNAVAILABLE');
    if (!response.body) throw new SponsorIdentityError('UNAVAILABLE');
    reader = response.body.getReader(); const activeReader = reader, chunks: Uint8Array[] = []; let size = 0;
    for (;;) {
      const row = await abortable(() => activeReader.read(), signal); if (row.done) break;
      if (!(row.value instanceof Uint8Array) || (size += row.value.byteLength) > responseBytes) throw new SponsorIdentityError('UNAVAILABLE');
      chunks.push(row.value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const identity = contributionMeSchema.parse(parseUniqueJson(new TextDecoder('utf-8', {fatal: true}).decode(bytes), responseBytes, 4));
    if (signal.aborted) throw new SponsorIdentityError('CANCELLED');
    return identity.sponsorId;
  } catch (error) {
    try { if (reader) void reader.cancel().catch(() => {}); else if (response?.body) void response.body.cancel().catch(() => {}); } catch {}
    throw error;
  } finally { try { reader?.releaseLock(); } catch {} }
}

export default function NetworkSponsorIdentity({enabled, isCurrent, onAuthenticationLost}: {enabled: boolean; isCurrent: () => boolean; onAuthenticationLost: () => void}) {
  const [sponsorId, setSponsorId] = useState<string | null>(null), [loading, setLoading] = useState(false), [copied, setCopied] = useState(false), [error, setError] = useState('');
  const session = useRef({alive: true, enabled, operation: 0, sponsorId: null as string | null, busy: false, controller: null as AbortController | null, timer: null as ReturnType<typeof setTimeout> | null});
  const guard = useRef({isCurrent, onAuthenticationLost}); guard.current = {isCurrent, onAuthenticationLost}; session.current.enabled = enabled;
  const active = () => session.current.alive && session.current.enabled && guard.current.isCurrent();
  function invalidate() {
    const s = session.current; s.operation++; s.controller?.abort(); s.controller = null; if (s.timer) clearTimeout(s.timer); s.timer = null; s.sponsorId = null; s.busy = false;
    setSponsorId(null); setLoading(false); setCopied(false); setError('');
  }
  useEffect(() => { session.current.alive = true; return () => { const s = session.current; s.alive = false; s.operation++; s.controller?.abort(); if (s.timer) clearTimeout(s.timer); s.timer = null; s.controller = null; s.sponsorId = null; s.busy = false; }; }, []);
  useEffect(() => { if (!enabled) invalidate(); }, [enabled]);

  async function obtain(copyExpected: string | null = null) {
    const s = session.current;
    if (!active() || s.busy || copyExpected !== null && s.sponsorId !== copyExpected) return;
    const controller = new AbortController(), operation = ++s.operation;
    s.controller = controller; s.timer = setTimeout(() => controller.abort(), 15_000); s.busy = true; s.sponsorId = null;
    setSponsorId(null); setLoading(true); setCopied(false); setError('');
    const owns = () => active() && s.operation === operation && s.controller === controller;
    let verified: string | null = null;
    try {
      const current = await readSponsor(controller.signal, owns); if (!owns() || controller.signal.aborted) return;
      if (copyExpected !== null && current !== copyExpected) { setError('Your sponsor identity changed. Load it again.'); return; }
      verified = current; s.sponsorId = current; setSponsorId(current);
      if (copyExpected !== null) {
        await abortable(() => { if (!owns()) throw new SponsorIdentityError('CANCELLED'); return navigator.clipboard.writeText(current); }, controller.signal);
        if (owns() && !controller.signal.aborted && s.sponsorId === current) setCopied(true);
      }
    } catch (failure) {
      if (!owns()) return;
      if (failure instanceof SponsorIdentityError && failure.code === 'AUTHENTICATION_LOST') { invalidate(); guard.current.onAuthenticationLost(); return; }
      if (copyExpected !== null && verified !== null && !controller.signal.aborted) setError('Clipboard unavailable. Select the sponsor ID and copy it manually.');
      else { s.sponsorId = null; setSponsorId(null); setError('Sponsor identity unavailable. Try again.'); }
    } finally {
      if (s.operation === operation && s.controller === controller) { if (s.timer) clearTimeout(s.timer); s.timer = null; s.controller = null; s.busy = false; if (active()) setLoading(false); }
    }
  }
  return <details className="og-sponsor-identity">
    <summary>Public sponsor ID</summary>
    <div>
      <p>Use your sponsorId with the confirmed agent details in external agent setup.</p>
      <button className="og-button og-secondary" type="button" disabled={!enabled || loading} onClick={() => void obtain()}>{loading ? 'Checking sponsor identity…' : sponsorId ? 'Reload sponsor ID' : 'Show sponsor ID'}</button>
      {sponsorId && <><label>Public sponsor ID<input aria-label="Public sponsor ID" readOnly autoComplete="off" spellCheck={false} value={sponsorId}/></label><button className="og-button og-secondary" type="button" disabled={!enabled || loading} onClick={() => void obtain(sponsorId)}>{copied ? 'Sponsor ID copied' : 'Copy sponsor ID'}</button></>}
      {error && <p role="alert">{error}</p>}
      {copied && <p role="status">Copied.</p>}
    </div>
  </details>;
}
