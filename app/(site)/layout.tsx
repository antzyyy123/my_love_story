import type { ReactNode } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { SITE_CONTENT } from "@/lib/content";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-cosmos-navy text-star-white">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-full focus:bg-cosmos-deep focus:px-4 focus:py-2 focus:text-xs focus:uppercase focus:tracking-widest focus:text-star-white focus:outline-2 focus:outline-nebula-purple"
      >
        {SITE_CONTENT.brand.skipToContent}
      </a>

      <Header />

      <main id="main-content" className="flex-1 flex flex-col">
        {children}
      </main>

      <Footer />
    </div>
  );
}
