import type { Metadata } from "next";
import WriteForm from "./WriteForm";
import { SITE_CONTENT } from "@/lib/content";

export const metadata: Metadata = {
  title: SITE_CONTENT.metadata.writeToMe.title,
  description: SITE_CONTENT.metadata.writeToMe.description,
  openGraph: {
    title: `${SITE_CONTENT.metadata.writeToMe.title} | ${SITE_CONTENT.metadata.root.siteName}`,
    description: SITE_CONTENT.metadata.writeToMe.description,
    type: "website",
  },
};

export default function WriteToMePage() {
  const { eyebrow, heading, intro, sideHeading, sideMessage, sideQuote } =
    SITE_CONTENT.writeToMe;

  return (
    <section className="relative flex-1 pt-36 pb-24 px-6 sm:px-10">
      <div className="mx-auto max-w-5xl">
        <header className="mx-auto max-w-2xl text-center">
          <p className="font-sans text-xs uppercase tracking-[0.28em] text-nebula-teal">
            {eyebrow}
          </p>
          <h1 className="mt-3 font-serif text-4xl sm:text-5xl font-light uppercase tracking-[0.14em] text-star-white text-shadow-glow">
            {heading}
          </h1>
          <p className="mt-4 text-sm sm:text-base font-light leading-relaxed text-star-white/75">
            {intro}
          </p>
        </header>

        <div className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-5">
          <div className="lg:col-span-3 rounded-2xl border border-star-white/12 bg-cosmos-deep/65 p-7 sm:p-9 backdrop-blur-md">
            <WriteForm />
          </div>

          <aside className="lg:col-span-2 flex flex-col justify-between gap-6 rounded-2xl border border-star-white/12 bg-cosmos-deep/55 p-7 sm:p-9 backdrop-blur-md">
            <div className="space-y-4">
              <h2 className="font-serif text-2xl font-light text-star-white">
                {sideHeading}
              </h2>
              <p className="text-xs sm:text-sm font-light leading-relaxed text-star-white/75">
                {sideMessage}
              </p>
            </div>

            <p className="border-t border-star-white/10 pt-5 font-serif text-sm italic text-star-white/65">
              {sideQuote}
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}
