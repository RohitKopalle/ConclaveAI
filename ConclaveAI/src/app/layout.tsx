import type { Metadata } from "next";
import { Inter, DM_Serif_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const dmSerif = DM_Serif_Display({
  variable: "--font-dm-serif",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Conclave | Self-Improving Agent",
  description: "A professional-grade self-improving AI agent",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${dmSerif.variable} antialiased`}
    >
      <body className="min-h-screen flex flex-col font-sans bg-background text-foreground selection:bg-gold/30">
        {children}
      </body>
    </html>
  );
}
