import type {Metadata} from 'next';

// Official public website only. Self-hosted forks choose their own canonical origin.
export const PUBLIC_ORIGIN = 'https://opengrail.xyz';
type PublicPagePath = '/' | '/demo' | '/agent-guide' | '/documents' | '/documents/get-started' | '/documents/whitepaper';

export function metadataForPublicPage(path: PublicPagePath, title: string, description: string): Metadata {
  const url = new URL(path, PUBLIC_ORIGIN).href;
  return {
    title,
    description,
    alternates: {canonical: url},
    openGraph: {type: 'website', siteName: 'OpenGrail', title, description, url},
    twitter: {card: 'summary', title, description},
  };
}
