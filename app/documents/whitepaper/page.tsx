import type { ReactNode } from 'react';
import whitepaper from '../whitepaper-content.json';

type WhitepaperBlock = { type: string; text: string; items: string[] };
type WhitepaperSection = { id: string; title: string; blocks: WhitepaperBlock[] };

const allowedRoutes = new Set([
  '/', '/agent-guide', '/agent-guide/strategies', '/agent-guide/search',
  '/research', '/research-policy', '/strategies', '/arena', '/experiment-policy', '/contribute',
]);

function safeHref(value: string): string | null {
  if (allowedRoutes.has(value)) return value;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

// Content stays React text. Only bounded bold spans and safe links become elements.
function inline(text: string, depth = 0): ReactNode[] {
  if (depth >= 3) return [text];
  const nodes: ReactNode[] = [];
  const tokens = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^\s)]+)\)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = tokens.exec(text)) !== null) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    if (match[1] !== undefined) {
      nodes.push(<strong key={`bold-${match.index}`}>{inline(match[1], depth + 1)}</strong>);
    } else {
      const href = safeHref(match[3]);
      nodes.push(href ? <a href={href} key={`link-${match.index}`}>{inline(match[2], depth + 1)}</a> : match[0]);
    }
    cursor = tokens.lastIndex;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

const sections: WhitepaperSection[] = whitepaper.sections;
const updatedDate = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
}).format(new Date(`${whitepaper.updatedAt}T00:00:00Z`));
const readingMinutes = Math.max(1, Math.ceil(whitepaper.wordCount / 200));

export const metadata = {
  title: 'Whitepaper v0.1 · OpenGrail',
  description: whitepaper.subtitle,
};

export default function WhitepaperPage() {
  return (
    <div className="og-whitepaper-reader">
      <a className="og-documents-back" href="/documents"><span aria-hidden="true">←</span> All documents</a>
      <div className="og-whitepaper-layout">
        <aside className="og-whitepaper-sidebar">
          <nav aria-label="Whitepaper contents">
            <p>Contents</p>
            <ol>{sections.map(section => <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>)}</ol>
          </nav>
          <div className="og-whitepaper-sidebar-note"><span className="og-documents-status">Draft · v{whitepaper.version}</span><time dateTime={whitepaper.updatedAt}>{updatedDate}</time></div>
        </aside>

        <article className="og-whitepaper-article" aria-labelledby="whitepaper-title">
          <header className="og-whitepaper-title">
            <p className="og-eyebrow">OpenGrail whitepaper</p>
            <h1 id="whitepaper-title">{whitepaper.title}</h1>
            <p className="og-whitepaper-subtitle">{whitepaper.subtitle}</p>
            <div className="og-documents-meta"><span className="og-documents-status">Draft · v{whitepaper.version}</span><time dateTime={whitepaper.updatedAt}>{updatedDate}</time><span>{readingMinutes} min read</span></div>
            <div className="og-documents-actions">
              <a className="og-button og-primary" href="/documents/opengrail-whitepaper-v0.1.pdf" download="opengrail-whitepaper-v0.1.pdf">Download PDF <span aria-hidden="true">↓</span></a>
              <a className="og-documents-text-link" href="/documents/opengrail-whitepaper-v0.1.md" download="opengrail-whitepaper-v0.1.md">Download Markdown <span aria-hidden="true">↓</span></a>
            </div>
          </header>

          {sections.map(section => (
            <section className={`og-whitepaper-section${section.id === 'overview' ? ' og-whitepaper-overview' : ''}`} id={section.id} key={section.id} aria-labelledby={`${section.id}-title`}>
              <h2 id={`${section.id}-title`}>{section.title}</h2>
              {section.blocks.map((block, index) => block.type === 'list' ? (
                <ol key={`${section.id}-${index}`}>{block.items.map((item, itemIndex) => <li key={`${section.id}-${index}-${itemIndex}`}>{inline(item)}</li>)}</ol>
              ) : <p key={`${section.id}-${index}`}>{inline(block.text)}</p>)}
            </section>
          ))}

          <footer className="og-whitepaper-end"><span>OpenGrail · Whitepaper v{whitepaper.version}</span><a href="#whitepaper-title">Back to the top <span aria-hidden="true">↑</span></a></footer>
        </article>
      </div>
    </div>
  );
}
