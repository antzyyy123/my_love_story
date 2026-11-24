"use client";

import { useState } from "react";
import FlowerCardCanvas from "../FlowerCardCanvas";
import { SITE_CONTENT } from "@/lib/content";

export default function PromisesGrid() {
  const { items, buttonIdle, buttonKept, statusPrefix } =
    SITE_CONTENT.myPromises;
  const [keptIds, setKeptIds] = useState<string[]>([]);
  const [announcement, setAnnouncement] = useState("");

  const handleTogglePromise = (id: string, title: string) => {
    setKeptIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
    setAnnouncement(`${title}.`);
  };

  return (
    <>
      <div className="mt-8 flex items-center justify-center">
        <p
          role="status"
          aria-live="polite"
          className="rounded-full border border-star-white/15 bg-cosmos-deep/70 px-4 py-1.5 font-sans text-xs tracking-[0.14em] text-star-white/80"
        >
          {statusPrefix}:{" "}
          <span className="font-semibold text-nebula-teal">
            {keptIds.length} / {items.length}
          </span>
          {announcement ? ` — ${announcement}` : ""}
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((promise) => {
          const isKept = keptIds.includes(promise.id);

          return (
            <article
              key={promise.id}
              className="group flex flex-col overflow-hidden rounded-2xl border border-star-white/12 bg-cosmos-deep/65 backdrop-blur-md transition-all duration-300 hover:border-nebula-purple/60 hover:shadow-glow"
            >
              <FlowerCardCanvas
                flowerType={promise.flowerType}
                paletteKey={promise.paletteKey}
                seed={promise.seed}
                label={`${promise.title} — glowing floral emblem`}
                className="h-52 w-full"
              />

              <div className="flex flex-1 flex-col justify-between p-6">
                <div>
                  <p className="font-sans text-[11px] uppercase tracking-[0.16em] text-star-white/55">
                    {promise.subtitle}
                  </p>
                  <h2 className="mt-2 font-serif text-xl font-normal text-star-white">
                    {promise.title}
                  </h2>
                  <p className="mt-2.5 text-xs sm:text-sm font-light leading-relaxed text-star-white/75">
                    {promise.description}
                  </p>
                </div>

                <div className="mt-6 flex items-center justify-end border-t border-star-white/10 pt-4">
                  <button
                    type="button"
                    onClick={() =>
                      handleTogglePromise(promise.id, promise.title)
                    }
                    aria-pressed={isKept}
                    aria-label={`${buttonIdle}: ${promise.title}`}
                    className={`rounded-full border px-5 py-2 font-sans text-[11px] uppercase tracking-[0.18em] transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nebula-purple ${
                      isKept
                        ? "border-nebula-teal/70 bg-nebula-teal/15 text-nebula-teal"
                        : "border-star-white/40 bg-star-white/5 text-star-white hover:border-star-white hover:bg-nebula-purple/20 hover:shadow-glow"
                    }`}
                  >
                    {isKept ? buttonKept : buttonIdle}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
