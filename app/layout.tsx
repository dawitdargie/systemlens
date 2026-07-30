import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "SystemLens — Understand any GitHub repository instantly",
  description:
    "Analyze any public GitHub repository, build a project profile, generate audience-specific explanations, and explore code through AI-powered chat.",
  openGraph: {
    title: "SystemLens",
    description: "Understand any GitHub repository instantly",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased min-h-screen bg-grid" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}