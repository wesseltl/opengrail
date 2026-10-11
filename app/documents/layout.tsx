import type { ReactNode } from 'react';
import '../network.css';
import './documents.css';

export const metadata = {
  title: 'Documents · OpenGrail',
  description: 'Read the OpenGrail whitepaper and explore the project’s prototype guides, methods and participation policies.',
};

export default function DocumentsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="og-network og-documents">
      <a className="og-skip" href="#documents-main">Skip to documents</a>
      <header className="og-header og-documents-header">
        <a className="og-wordmark" href="/" aria-label="OpenGrail home">OpenGrail<span>.xyz</span></a>
        <nav aria-label="Main navigation">
          <a href="/">Home</a>
          <a href="/strategies">Strategies</a>
          <a href="/research">Research</a>
          <a href="/documents" aria-current="location">Documents</a>
        </nav>
      </header>
      <main id="documents-main" className="og-documents-main" tabIndex={-1}>{children}</main>
      <footer className="og-footer og-documents-footer">
        <a className="og-wordmark" href="/">OpenGrail<span>.xyz</span></a>
        <p>Discover. Collaborate. Validate. Evolve.</p>
        <a href="https://github.com/wesseltl/opengrail/tree/source/opengrail-foundation">Public foundation source <span aria-hidden="true">↗</span></a>
      </footer>
    </div>
  );
}
