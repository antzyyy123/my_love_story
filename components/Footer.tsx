import NewsletterForm from "./NewsletterForm";
import { SITE_CONTENT, SOCIAL_LINKS } from "@/lib/content";

export default function Footer() {
  const hasAnySocial = Boolean(
    SOCIAL_LINKS.instagram.trim() ||
      SOCIAL_LINKS.facebook.trim() ||
      SOCIAL_LINKS.pinterest.trim()
  );

  return (
    <footer className="relative z-30 border-t border-star-white/10 bg-cosmos-navy/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-4 sm:px-10 md:flex-row">
        {/* Left: Romantic sign-off */}
        <p className="text-[11px] font-sans tracking-[0.08em] text-star-white/70 text-center md:text-left">
          {SITE_CONTENT.brand.footerLeft}
        </p>

        {/* Center: Optional Social Icons (shown only when links are filled in lib/content.ts) */}
        {hasAnySocial && (
          <div
            aria-label={SITE_CONTENT.common.socialLinksAria}
            className="flex items-center justify-center gap-5"
          >
            {SOCIAL_LINKS.instagram.trim() && (
              <a
                href={SOCIAL_LINKS.instagram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={SITE_CONTENT.common.socialLabels.instagram}
                className="text-star-white/75 transition-all duration-300 hover:text-star-white hover:drop-shadow-[0_0_10px_rgba(236,72,153,0.85)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-nebula-purple rounded-sm"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="2.5" y="2.5" width="19" height="19" rx="5" ry="5" />
                  <circle cx="12" cy="12" r="4.2" />
                  <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" stroke="none" />
                </svg>
              </a>
            )}

            {SOCIAL_LINKS.facebook.trim() && (
              <a
                href={SOCIAL_LINKS.facebook}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={SITE_CONTENT.common.socialLabels.facebook}
                className="text-star-white/75 transition-all duration-300 hover:text-star-white hover:drop-shadow-[0_0_10px_rgba(56,189,248,0.85)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-nebula-purple rounded-sm"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.6-1.5h1.6V4.4c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.1v2.1H8v3h2.3V21h3.2z" />
                </svg>
              </a>
            )}

            {SOCIAL_LINKS.pinterest.trim() && (
              <a
                href={SOCIAL_LINKS.pinterest}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={SITE_CONTENT.common.socialLabels.pinterest}
                className="text-star-white/75 transition-all duration-300 hover:text-star-white hover:drop-shadow-[0_0_10px_rgba(139,92,246,0.9)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-nebula-purple rounded-sm"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12.2 3C7.2 3 4.5 6.3 4.5 9.9c0 1.7.9 3.8 2.4 4.4.2.1.4 0 .4-.2l.3-1.3c0-.2 0-.3-.1-.4-.5-.6-.8-1.5-.8-2.4 0-2.4 1.8-4.6 4.9-4.6 2.7 0 4.5 1.7 4.5 4.2 0 2.9-1.5 5-3.4 5-1.1 0-1.9-.9-1.6-2 .3-1.3.9-2.7.9-3.6 0-.8-.4-1.5-1.4-1.5-1.1 0-2 1.1-2 2.6 0 1 .3 1.6.3 1.6l-1.3 5.5c-.4 1.6-.1 3.7 0 3.9 0 .1.2.2.3.1.1-.2 1.6-2 2.1-3.8l.8-3c.4.8 1.5 1.4 2.7 1.4 3.5 0 6.1-3.2 6.1-7.2C19.6 6 16.5 3 12.2 3z" />
                </svg>
              </a>
            )}
          </div>
        )}

        {/* Right: Live "Together for X days" pill (hidden when TOGETHER_SINCE is empty) */}
        <NewsletterForm />
      </div>
    </footer>
  );
}
