import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Orbitron, Space_Grotesk } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const orbitron = Orbitron({ variable: "--font-orbitron", subsets: ["latin"], weight: ["600", "800", "900"] });
const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Musical Chair",
  description: "The live musical-chairs quiz game of the SVIT tech fest.",
};

export const viewport: Viewport = {
  themeColor: "#07070C",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Reading request headers renders every page per request, so Next.js can stamp each response's
  // scripts with the CSP nonce set in middleware (static pages would be blocked by the CSP).
  await headers();
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className={`${orbitron.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
