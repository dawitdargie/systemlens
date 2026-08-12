import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "SystemLens. Understand any GitHub repository instantly",
  description:
    "Analyze any public GitHub repository, build a project profile, generate audience-specific explanations, and explore code through AI-powered chat.",
  icons: {
    icon: "https://i.ibb.co/HTQ0Cc8s/System-Lens-Fav.png",
  },
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
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Apply stored/system theme before paint to avoid flash of wrong theme. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t);}else{var s=window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.setAttribute("data-theme",s);}}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();`,
          }}
        />
      </head>
      <body className="antialiased min-h-screen bg-grid" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}