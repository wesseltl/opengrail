import {z} from 'zod';

/** Bounds describe public author claims; none establish factual or legal verification. */
export const ventureLimits = {sources: 8, factText: 800, founders: 5, traction: 6, risks: 5, riskText: 500, catalystText: 500, issuerName: 120, url: 2048, maximumMoney: 1e15} as const;
export const ventureScoreWeights = {founders: 15, technology: 15, market: 15, traction: 15, defensibility: 10, valuation: 10, timing: 5, accessibility: 10, asymmetry: 5} as const;

export function ventureCredentialLike(raw: string): boolean {
  let value = raw;
  for (let pass = 0; pass < 4; pass++) {
    if (/og_agent_|og_local_(?:owner|producer)_|gh[pousr]_[A-Za-z0-9]{20,255}|github_pat_[A-Za-z0-9_]{20,255}/i.test(value)) return true;
    try { const decoded = decodeURIComponent(value); if (decoded === value) break; value = decoded; } catch { break; }
  }
  return false;
}
const text = (maximum: number, minimum = 1) => z.string().trim().min(minimum).max(maximum).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/).refine(value => !ventureCredentialLike(value), 'Credentials cannot be published.');
export const ventureDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const at = Date.parse(value + 'T00:00:00.000Z');
  return Number.isFinite(at) && new Date(at).toISOString().slice(0, 10) === value;
}, 'Use a canonical calendar date.');
export const ventureUrlSchema = text(ventureLimits.url).refine(value => {
  try { const url = new URL(value); return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password; } catch { return false; }
}, 'Use a credential-free HTTPS URL.');
export const ventureClassificationSchema = z.enum(['REPORTED_FACT', 'FOUNDER_CLAIM', 'ESTIMATE', 'SPECULATION']);
export const ventureSourceIndicesSchema = z.array(z.number().int().min(0).max(ventureLimits.sources - 1)).min(1).max(ventureLimits.sources).refine(value => new Set(value).size === value.length, 'Source indices must be unique.');
const unknownSchema = z.object({state: z.literal('UNKNOWN')}).strict();
const evidenceFields = {classification: ventureClassificationSchema, asOf: ventureDateSchema, sourceIndices: ventureSourceIndicesSchema};
export const ventureReportedFactSchema = z.object({state: z.literal('REPORTED'), value: text(ventureLimits.factText), ...evidenceFields}).strict();
export const ventureFactSchema = z.discriminatedUnion('state', [unknownSchema, ventureReportedFactSchema]);
export type VentureReportedFact = z.infer<typeof ventureReportedFactSchema>;
export type VentureFact = z.infer<typeof ventureFactSchema>;
export const ventureCurrencySchema = z.enum(['EUR', 'USD', 'GBP', 'CHF']);
export const ventureValuationBasisSchema = z.enum(['PRE_MONEY', 'POST_MONEY', 'FDV', 'MARKET_CAP', 'UNKNOWN']);
export const ventureReportedMoneySchema = z.object({state: z.literal('REPORTED'), amount: z.number().finite().nonnegative().max(ventureLimits.maximumMoney), currency: ventureCurrencySchema, ...evidenceFields}).strict();
export const ventureMoneySchema = z.discriminatedUnion('state', [unknownSchema, ventureReportedMoneySchema]);
export const ventureReportedValuationSchema = z.object({state: z.literal('REPORTED'), amount: z.number().finite().positive().max(ventureLimits.maximumMoney), currency: ventureCurrencySchema, basis: ventureValuationBasisSchema, ...evidenceFields}).strict();
export const ventureValuationSchema = z.discriminatedUnion('state', [unknownSchema, ventureReportedValuationSchema]);
export type VentureMoney = z.infer<typeof ventureMoneySchema>;
export type VentureValuation = z.infer<typeof ventureValuationSchema>;
export const ventureAccessSchema = z.discriminatedUnion('status', [
  z.object({status: z.literal('UNKNOWN'), asOf: z.null(), sourceIndices: z.array(z.never()).length(0), route: z.null(), conditions: z.literal('')}).strict(),
  z.object({status: z.enum(['YES', 'MAYBE', 'NO']), asOf: ventureDateSchema, sourceIndices: ventureSourceIndicesSchema, route: ventureUrlSchema.nullable(), conditions: text(ventureLimits.factText)}).strict(),
]);
export type VentureAccess = z.infer<typeof ventureAccessSchema>;
export const ventureIssuerSchema = z.object({
  name: text(ventureLimits.issuerName), website: ventureUrlSchema, kind: z.enum(['COMPANY', 'TOKEN', 'PROJECT']),
  sector: z.enum(['AI', 'AGENTS', 'DEVELOPER_INFRA', 'AUTOMATION', 'ROBOTICS', 'COMPUTE', 'CYBERSECURITY', 'DATA_INFRA', 'VERTICAL_SAAS', 'DEEP_TECH', 'OPEN_SOURCE', 'CRYPTO_INFRA', 'OTHER']),
  stage: z.enum(['IDEA', 'PRE_SEED', 'SEED', 'SERIES_A', 'PUBLIC', 'UNKNOWN']),
}).strict();
export const ventureScoreComponentsSchema = z.object({
  founders: z.number().int().min(0).max(ventureScoreWeights.founders).nullable(),
  technology: z.number().int().min(0).max(ventureScoreWeights.technology).nullable(),
  market: z.number().int().min(0).max(ventureScoreWeights.market).nullable(),
  traction: z.number().int().min(0).max(ventureScoreWeights.traction).nullable(),
  defensibility: z.number().int().min(0).max(ventureScoreWeights.defensibility).nullable(),
  valuation: z.number().int().min(0).max(ventureScoreWeights.valuation).nullable(),
  timing: z.number().int().min(0).max(ventureScoreWeights.timing).nullable(),
  accessibility: z.number().int().min(0).max(ventureScoreWeights.accessibility).nullable(),
  asymmetry: z.number().int().min(0).max(ventureScoreWeights.asymmetry).nullable(),
}).strict();
export type VentureScoreComponents = z.infer<typeof ventureScoreComponentsSchema>;
const dossierBodySchema = z.object({
  issuer: ventureIssuerSchema, asOf: ventureDateSchema,
  product: ventureFactSchema, customer: ventureFactSchema, competition: ventureFactSchema, edge: ventureFactSchema,
  funding: ventureFactSchema, dilution: ventureFactSchema,
  founders: z.array(ventureReportedFactSchema).max(ventureLimits.founders), traction: z.array(ventureReportedFactSchema).max(ventureLimits.traction),
  terms: z.object({valuation: ventureValuationSchema, roundSize: ventureMoneySchema, minimumTicket: ventureMoneySchema, security: ventureFactSchema, fees: ventureFactSchema}).strict(),
  access: ventureAccessSchema,
  crypto: z.object({usage: ventureFactSchema, tokenomics: ventureFactSchema, liquidity: ventureFactSchema}).strict().nullable(),
  risks: z.array(text(ventureLimits.riskText)).min(1).max(ventureLimits.risks),
  nextCatalyst: z.object({event: text(ventureLimits.catalystText), date: ventureDateSchema.nullable()}).strict(),
  scoring: z.object({components: ventureScoreComponentsSchema, confidence: z.enum(['LOW', 'MEDIUM', 'HIGH'])}).strict(),
}).strict();
type DossierBody = z.infer<typeof dossierBodySchema>;
function claims(dossier: DossierBody) {
  return [dossier.product, dossier.customer, dossier.competition, dossier.edge, dossier.funding, dossier.dilution,
    ...dossier.founders, ...dossier.traction, dossier.terms.valuation, dossier.terms.roundSize, dossier.terms.minimumTicket, dossier.terms.security, dossier.terms.fees,
    ...(dossier.crypto ? [dossier.crypto.usage, dossier.crypto.tokenomics, dossier.crypto.liquidity] : [])].filter(value => value.state === 'REPORTED');
}
export const ventureDossierSchema = dossierBodySchema.superRefine((dossier, ctx) => {
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({code: z.ZodIssueCode.custom, path, message});
  if ((dossier.issuer.kind === 'TOKEN' || dossier.issuer.sector === 'CRYPTO_INFRA') && !dossier.crypto) issue(['crypto'], 'Token and crypto infrastructure dossiers require explicit usage, tokenomics and liquidity states.');
  if (claims(dossier).some(value => value.asOf > dossier.asOf) || (dossier.access.status !== 'UNKNOWN' && dossier.access.asOf > dossier.asOf)) issue(['asOf'], 'Reported claims must not postdate the dossier review.');
  if (dossier.terms.valuation.state === 'UNKNOWN' && (dossier.scoring.components.valuation ?? 0) > 0) issue(['scoring', 'components', 'valuation'], 'Unknown valuation cannot receive a positive entry-price score.');
  if (['UNKNOWN', 'NO'].includes(dossier.access.status) && (dossier.scoring.components.accessibility ?? 0) > 0) issue(['scoring', 'components', 'accessibility'], 'Unknown or unavailable access cannot receive a positive access score.');
});
export type VentureDossier = z.infer<typeof ventureDossierSchema>;

/** A display-only author assessment, never a qualified rank or recommendation. */
export function ventureScoreTotal(components: VentureScoreComponents): number | null {
  const parsed = ventureScoreComponentsSchema.parse(components), values = Object.values(parsed);
  return values.some(value => value === null) ? null : values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

/** Empty required identity/risk/catalyst fields are an honest draft, not publication evidence. */
export function blankVentureDossier(date: string): VentureDossier {
  const asOf = ventureDateSchema.parse(date), unknown = (): {state: 'UNKNOWN'} => ({state: 'UNKNOWN'});
  return {issuer: {name: '', website: '', kind: 'COMPANY', sector: 'OTHER', stage: 'UNKNOWN'}, asOf,
    product: unknown(), customer: unknown(), competition: unknown(), edge: unknown(), funding: unknown(), dilution: unknown(), founders: [], traction: [],
    terms: {valuation: unknown(), roundSize: unknown(), minimumTicket: unknown(), security: unknown(), fees: unknown()},
    access: {status: 'UNKNOWN', asOf: null, sourceIndices: [], route: null, conditions: ''}, crypto: null, risks: [''], nextCatalyst: {event: '', date: null},
    scoring: {components: {founders: null, technology: null, market: null, traction: null, defensibility: null, valuation: null, timing: null, accessibility: null, asymmetry: null}, confidence: 'LOW'}};
}

/** Sources and clocks bind a declared dossier, without fetching or verifying a cited page. */
export function validateVentureSources(dossier: VentureDossier, sources: readonly {url: string}[], at?: string): void {
  const parsed = ventureDossierSchema.safeParse(dossier);
  const admittedSources = z.array(z.object({url: ventureUrlSchema}).passthrough()).max(ventureLimits.sources).safeParse(sources);
  if (!parsed.success || !admittedSources.success) throw new Error('Invalid venture sources or dates.');
  const value = parsed.data, urls = admittedSources.data.map(source => new URL(source.url).href);
  if (new Set(urls).size !== urls.length || claims(value).some(claim => claim.sourceIndices.some(index => index >= sources.length)) || (value.access.status !== 'UNKNOWN' && value.access.sourceIndices.some(index => index >= sources.length))) throw new Error('Invalid venture sources or dates.');
  if (at !== undefined) {
    const timestamp = typeof at === 'string' && Number.isFinite(Date.parse(at)) && new Date(at).toISOString() === at;
    const date = ventureDateSchema.safeParse(at);
    if ((!timestamp && !date.success) || value.asOf > at.slice(0, 10)) throw new Error('Invalid venture sources or dates.');
  }
}
