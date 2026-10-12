import './evidence-amount.css';

const number = new Intl.NumberFormat('en-GB', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Presentation only: the original number stays in the evidence and its exports. */
export function evidenceAmount(value: unknown, label: string, kind: 'AMOUNT' | 'PNL' = 'AMOUNT') {
  if (value === null || value === undefined) return <span className="og-evidence-amount-missing">UNKNOWN</span>;
  if (typeof value !== 'number') return <span className="og-evidence-amount-missing">INVALID</span>;

  const finite = Number.isFinite(value), exact = Object.is(value, -0) ? '-0' : String(value);
  const small = finite && value !== 0 && Math.abs(value) < 0.01;
  const displayed = !finite ? 'NONFINITE' : small
    ? kind === 'PNL' ? (value < 0 ? 'Loss <0.01' : 'Gain <0.01') : value < 0 ? 'Negative, magnitude <0.01' : '<0.01'
    : (kind === 'PNL' && value > 0 ? '+' : '') + number.format(value === 0 ? 0 : value);

  return <div className="og-evidence-amount">
    <span>{displayed}</span>
    <details className="og-evidence-amount-exact">
      <summary aria-label={'Show exact ' + label}>Exact</summary>
      <code aria-label={'Exact ' + label}>{exact}</code>
    </details>
  </div>;
}
