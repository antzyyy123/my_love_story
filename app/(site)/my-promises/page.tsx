import type { Metadata } from "next";
import PromisesGrid from "./PromisesGrid";
import { SITE_CONTENT } from "@/lib/content";

export const metadata: Metadata = {
  title: SITE_CONTENT.metadata.myPromises.title,
  description: SITE_CONTENT.metadata.myPromises.description,
  openGraph: {
    title: `${SITE_CONTENT.metadata.myPromises.title} | ${SITE_CONTENT.metadata.root.siteName}`,
    description: SITE_CONTENT.metadata.myPromises.description,
    type: "website",
  },
};

export default function MyPromisesPage() {
  const { eyebrow, heading, intro } = SITE_CONTENT.myPromises;

  return (
    <section className="relative flex-1 pt-36 pb-24 px-6 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="mx-auto max-w-2xl text-center">
          <p className="font-sans text-xs uppercase tracking-[0.28em] text-nebula-purple">
            {eyebrow}
          </p>
          <h1 className="mt-3 font-serif text-4xl sm:text-5xl font-light uppercase tracking-[0.14em] text-star-white text-shadow-glow">
            {heading}
          </h1>
          <p className="mt-4 text-sm sm:text-base font-light leading-relaxed text-star-white/75">
            {intro}
          </p>
        </header>

        <PromisesGrid />
      </div>
    </section>
  );
}
