import type { Metadata } from "next";
import GlowButton from "@/components/GlowButton";
import FlowerCardCanvas from "../FlowerCardCanvas";
import { SITE_CONTENT } from "@/lib/content";

export const metadata: Metadata = {
  title: SITE_CONTENT.metadata.ourStory.title,
  description: SITE_CONTENT.metadata.ourStory.description,
  openGraph: {
    title: `${SITE_CONTENT.metadata.ourStory.title} | ${SITE_CONTENT.metadata.root.siteName}`,
    description: SITE_CONTENT.metadata.ourStory.description,
    type: "website",
  },
};

export default function OurStoryPage() {
  const {
    eyebrow,
    heading,
    quote,
    introParagraph1,
    introParagraph2,
    timeline,
    primaryCta,
    primaryHref,
    secondaryCta,
    secondaryHref,
  } = SITE_CONTENT.ourStory;

  return (
    <section className="relative flex-1 pt-36 pb-24 px-6 sm:px-10">
      <div className="mx-auto max-w-4xl">
        <header className="text-center">
          <p className="font-sans text-xs uppercase tracking-[0.28em] text-nebula-teal">
            {eyebrow}
          </p>
          <h1 className="mt-3 font-serif text-4xl sm:text-5xl font-light uppercase tracking-[0.14em] text-star-white text-shadow-glow">
            {heading}
          </h1>
        </header>

        <div className="mt-12 overflow-hidden rounded-2xl border border-star-white/12 bg-cosmos-deep/65 backdrop-blur-md">
          <FlowerCardCanvas
            flowerType="peony"
            paletteKey="pink"
            seed={777}
            label="Glowing rose-quartz peony bloom for our story"
            className="h-52 w-full"
          />

          <div className="p-8 sm:p-12">
            <p className="font-serif text-2xl sm:text-3xl font-light leading-snug text-star-white/95">
              {quote}
            </p>

            <div className="mt-6 space-y-4 text-sm sm:text-base font-light leading-relaxed text-star-white/75">
              <p>{introParagraph1}</p>
              <p>{introParagraph2}</p>
            </div>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
          {timeline.map((step) => (
            <div
              key={step.phase}
              className="rounded-2xl border border-star-white/10 bg-cosmos-deep/55 p-6 backdrop-blur-sm"
            >
              <p className="font-sans text-[10px] uppercase tracking-[0.22em] text-nebula-purple">
                {step.phase}
              </p>
              <h2 className="mt-1.5 font-serif text-2xl font-normal tracking-[0.06em] text-star-white">
                {step.title}
              </h2>
              <p className="mt-3 text-xs sm:text-sm font-light leading-relaxed text-star-white/75">
                {step.description}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap justify-center gap-4">
          <GlowButton href={primaryHref}>{primaryCta}</GlowButton>
          <GlowButton href={secondaryHref}>{secondaryCta}</GlowButton>
        </div>
      </div>
    </section>
  );
}
