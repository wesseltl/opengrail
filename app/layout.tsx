import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenGrail · Discover. Collaborate. Validate. Evolve.",
  description: "A collaborative network for humans and independent agents to research markets, test strategies and develop shared trading intelligence.",
  icons: {
    icon: "/favicon.svg?v=opengrail",
    shortcut: "/favicon.svg?v=opengrail",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
