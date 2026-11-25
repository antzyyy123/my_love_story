import type { Metadata } from "next";
import FlowerCardCanvas from "../FlowerCardCanvas";
import { SITE_CONTENT } from "@/lib/content";

export const metadata: Metadata = {
  title: SITE_CONTENT.metadata.ourMemories.title,
  description: SITE_CONTENT.metadata.ourMemories.description,
  openGraph: {
    title: `${SITE_CONTENT.metadata.ourMemories.title} | ${SITE_CONTENT.metadata.root.siteName}`,
    description: SITE_CONTENT.metadata.ourMemories.description,
    type: "website",
  },
};

export default function OurMemoriesPage() {
  const { eyebrow, heading, intro, canvasLabelSuffix, items } =
    SITE_CONTENT.ourMemories;

  return (
    <section className="relative flex-1 pt-36 pb-24 px-6 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="mx-auto max-w-2xl text-center">
          <p className="font-sans text-xs uppercase tracking-[0.28em] text-nebula-blue">
            {eyebrow}
          </p>
          <h1 className="mt-3 font-serif text-4xl sm:text-5xl font-light uppercase tracking-[0.14em] text-star-white text-shadow-glow">
            {heading}
          </h1>
          <p className="mt-4 text-sm sm:text-base font-light leading-relaxed text-star-white/75">
            {intro}
          </p>
        </header>

        <div className="mt-14 grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <figure
              key={item.id}
              className="group overflow-hidden rounded-2xl border border-star-white/12 bg-cosmos-deep/65 backdrop-blur-sm transition-all duration-300 hover:border-nebula-purple/60 hover:shadow-glow"
            >
              <div className="relative overflow-hidden">
                <FlowerCardCanvas
                  flowerType={item.flowerType}
                  paletteKey={item.paletteKey}
                  seed={item.seed}
                  label={`${item.title} — ${canvasLabelSuffix}`}
                  className="h-56 w-full transition-transform duration-700 ease-out group-hover:scale-105"
                />
                <span className="pointer-events-none absolute top-3.5 left-3.5 rounded-full border border-star-white/20 bg-cosmos-navy/70 px-3 py-1 font-sans text-[10px] uppercase tracking-[0.2em] text-star-white/85 backdrop-blur-md">
                  {item.date}
                </span>
              </div>

              <figcaption className="p-5">
                <h2 className="font-serif text-xl font-normal tracking-[0.06em] text-star-white">
                  {item.title}
                </h2>
                <p className="mt-1.5 font-sans text-xs tracking-[0.06em] text-star-white/65">
                  {item.caption}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
