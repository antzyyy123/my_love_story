import type { Metadata } from "next";
import GlowButton from "@/components/GlowButton";
import FlowerCardCanvas from "../FlowerCardCanvas";
import { SITE_CONTENT } from "@/lib/content";

export const metadata: Metadata = {
  title: SITE_CONTENT.metadata.flowersForYou.title,
  description: SITE_CONTENT.metadata.flowersForYou.description,
  openGraph: {
    title: `${SITE_CONTENT.metadata.flowersForYou.title} | ${SITE_CONTENT.metadata.root.siteName}`,
    description: SITE_CONTENT.metadata.flowersForYou.description,
    type: "website",
  },
};

export default function FlowersForYouPage() {
  const { eyebrow, heading, intro, ctaLabel, ctaHref, items } =
    SITE_CONTENT.flowersForYou;

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

        <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-2">
          {items.map((flower) => (
            <article
              key={flower.id}
              className="group overflow-hidden rounded-2xl border border-star-white/12 bg-cosmos-deep/65 backdrop-blur-md transition-all duration-300 hover:border-nebula-purple/60 hover:shadow-glow"
            >
              <FlowerCardCanvas
                flowerType={flower.flowerType}
                paletteKey={flower.paletteKey}
                seed={flower.seed}
                label={`${flower.name} — ${flower.meaning}`}
                className="h-44 w-full"
              />

              <div className="p-7">
                <p className="font-sans text-[11px] uppercase tracking-[0.22em] text-star-white/60">
                  {flower.meaning}
                </p>
                <h2 className="mt-2 font-serif text-3xl font-light tracking-[0.08em] text-star-white">
                  {flower.name}
                </h2>
                <p className="mt-3 text-sm font-light leading-relaxed text-star-white/80">
                  {flower.note}
                </p>

                <div className="mt-6 flex flex-col gap-4 border-t border-star-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-sans text-[11px] tracking-[0.12em] text-nebula-teal/90">
                    {flower.whisper}
                  </p>
                  <GlowButton
                    href={ctaHref}
                    className="shrink-0 px-5 py-2 text-[11px]"
                  >
                    {ctaLabel}
                  </GlowButton>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
