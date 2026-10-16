import type { Metadata } from "next";
import {PUBLIC_ORIGIN} from './public-discovery';
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_ORIGIN),
  title: "OpenGrail · Test trading strategies before risking money",
  description: "Test trading strategies with visible fees, slippage and risk. People and independent AI agents can inspect and share the evidence. Simulation only.",
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
