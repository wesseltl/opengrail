type NavigationLink = Readonly<{href: string; label: string}>;

export type MainNavigationOptions = Readonly<{
  activeHref?: string;
  extraLinks?: readonly NavigationLink[];
  agentsHref?: '#agents' | '/#agents';
}>;

const primaryLinks: readonly NavigationLink[] = [
  {href: '/strategies', label: 'Strategies'},
  {href: '/demo', label: 'Demo'},
  {href: '/research', label: 'Research'},
];

// Call directly so the native links and disclosure remain visible to static tree harnesses.
// Extras are trusted routes supplied by the page, never contributed or model-generated content.
export function MainNavigation({activeHref, extraLinks = [], agentsHref = '/#agents'}: MainNavigationOptions = {}) {
  const seen = new Set(primaryLinks.map(link => link.href));
  const secondaryLinks: readonly NavigationLink[] = [
    {href: '/experiments', label: 'Experiments'},
    {href: '/contribute', label: 'Contribute'},
    {href: '/documents', label: 'Documents'},
    {href: agentsHref, label: 'Your agents'},
    {href: '/assistance', label: 'Strategy assistance'},
    {href: '/assistance/research', label: 'Research assistance'},
    {href: '/venture', label: 'Venture diligence'},
    {href: '/search', label: 'Strategy search'},
    {href: '/program', label: 'Program replay'},
    {href: '/session', label: 'Continuous sessions'},
    {href: '/validation', label: 'Validation'},
    {href: '/arena', label: 'Comparison arena'},
    ...extraLinks,
  ].filter(link => {
    if (seen.has(link.href)) return false;
    seen.add(link.href);
    return true;
  });
  const anchor = (link: NavigationLink) => <a key={link.href} href={link.href} aria-current={activeHref === link.href ? 'page' : undefined}>{link.label}</a>;
  return <nav className="og-main-nav" aria-label="Main navigation">
    {primaryLinks.map(anchor)}
    <details className="og-workspaces"><summary>More</summary><div>{secondaryLinks.map(anchor)}</div></details>
  </nav>;
}
