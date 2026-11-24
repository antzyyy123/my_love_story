import type { Metadata } from "next";
import { Cormorant_Garamond, Montserrat } from "next/font/google";
import { SITE_CONTENT } from "@/lib/content";
import "./globals.css";

const cormorantGaramond = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-cormorant-garamond",
  display: "swap",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: SITE_CONTENT.metadata.root.defaultTitle,
    template: SITE_CONTENT.metadata.root.titleTemplate,
  },
  description: SITE_CONTENT.metadata.root.description,
  openGraph: {
    title: SITE_CONTENT.metadata.root.defaultTitle,
    description: SITE_CONTENT.metadata.root.description,
    type: "website",
    siteName: SITE_CONTENT.metadata.root.siteName,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${cormorantGaramond.variable} ${montserrat.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-cosmos-navy text-star-white font-sans selection:bg-nebula-purple/40 selection:text-star-white">
        {children}
      </body>
    </html>
  );
}
