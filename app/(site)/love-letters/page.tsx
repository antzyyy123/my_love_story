import type { Metadata } from "next";
import FlowerCardCanvas from "../FlowerCardCanvas";
import { SITE_CONTENT } from "@/lib/content";

export const metadata: Metadata = {
  title: SITE_CONTENT.metadata.loveLetters.title,
  description: SITE_CONTENT.metadata.loveLetters.description,
  openGraph: {
    title: `${SITE_CONTENT.metadata.loveLetters.title} | ${SITE_CONTENT.metadata.root.siteName}`,
    description: SITE_CONTENT.metadata.loveLetters.description,
    type: "website",
  },
};

export default function LoveLettersPage() {
  const { eyebrow, heading, intro, canvasLabelPrefix, letters } =
    SITE_CONTENT.loveLetters;

  return (
    <section className="relative flex-1 pt-36 pb-24 px-6 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="mx-auto max-w-2xl text-center">
          <p className="font-sans text-xs uppercase tracking-[0.28em] text-nebula-pink">
            {eyebrow}
          </p>
          <h1 className="mt-3 font-serif text-4xl sm:text-5xl font-light uppercase tracking-[0.14em] text-star-white text-shadow-glow">
            {heading}
          </h1>
          <p className="mt-4 text-sm sm:text-base font-light leading-relaxed text-star-white/75">
            {intro}
          </p>
        </header>

        <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-3">
          {letters.map((letter) => (
            <article
              key={letter.id}
              className="group flex flex-col overflow-hidden rounded-2xl border border-star-white/12 bg-cosmos-deep/65 backdrop-blur-md transition-all duration-300 hover:border-nebula-purple/60 hover:shadow-glow"
            >
              <FlowerCardCanvas
                flowerType={letter.flowerType}
                paletteKey={letter.paletteKey}
                seed={letter.seed}
                label={`${canvasLabelPrefix} ${letter.title}`}
                className="h-44 w-full"
              />

              <div className="flex flex-1 flex-col p-6">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-star-white/60">
                  <span className="text-nebula-blue">{letter.tag}</span>
                  <span>{letter.noteLabel}</span>
                </div>

                <h2 className="mt-3 font-serif text-2xl font-normal leading-snug text-star-white">
                  {letter.title}
                </h2>

                <p className="mt-3 flex-1 text-xs sm:text-sm font-light leading-relaxed text-star-white/75">
                  {letter.preview}
                </p>

                <p className="mt-6 border-t border-star-white/10 pt-4 text-[11px] tracking-[0.12em] text-star-white/50">
                  {letter.date}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
