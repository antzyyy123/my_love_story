"use client";

import { FormEvent, useState } from "react";
import GlowButton from "@/components/GlowButton";
import { BRAND_NAME, CONTACT_EMAIL, SITE_CONTENT } from "@/lib/content";

export default function WriteForm() {
  const copy = SITE_CONTENT.writeToMe;
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const hasEmail = Boolean(CONTACT_EMAIL.trim());

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || !message.trim()) return;

    if (hasEmail) {
      const subject = encodeURIComponent(
        `${copy.emailSubjectPrefix} ${name.trim()} — ${BRAND_NAME}`
      );
      const body = encodeURIComponent(
        `${copy.emailFromLabel} ${name.trim()}\n\n${message.trim()}`
      );
      window.location.href = `mailto:${CONTACT_EMAIL.trim()}?subject=${subject}&body=${body}`;
    }

    setSubmitted(true);
    setName("");
    setMessage("");
  };

  if (submitted) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-2xl border border-nebula-teal/40 bg-nebula-teal/10 p-8 text-center"
      >
        <h2 className="font-serif text-2xl font-light text-star-white">
          {copy.submittedTitle}
        </h2>
        <p className="mt-3 text-sm font-light text-star-white/80">
          {hasEmail ? copy.submittedWithEmail : copy.submittedWithoutEmail}
        </p>
        <div className="mt-6">
          <GlowButton type="button" onClick={() => setSubmitted(false)}>
            {copy.sendAnotherLabel}
          </GlowButton>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label
          htmlFor="write-name"
          className="block font-sans text-xs uppercase tracking-[0.18em] text-star-white/80"
        >
          {copy.nameLabel}
        </label>
        <input
          id="write-name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={copy.namePlaceholder}
          className="mt-2 w-full rounded-xl border border-star-white/20 bg-cosmos-navy/75 px-4 py-3 text-sm text-star-white placeholder:text-star-white/40 transition-all duration-300 focus:border-nebula-purple focus:shadow-glow focus:outline-none"
        />
      </div>

      <div>
        <label
          htmlFor="write-message"
          className="block font-sans text-xs uppercase tracking-[0.18em] text-star-white/80"
        >
          {copy.messageLabel}
        </label>
        <textarea
          id="write-message"
          rows={6}
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={copy.messagePlaceholder}
          className="mt-2 w-full resize-none rounded-xl border border-star-white/20 bg-cosmos-navy/75 px-4 py-3 text-sm text-star-white placeholder:text-star-white/40 transition-all duration-300 focus:border-nebula-purple focus:shadow-glow focus:outline-none"
        />
      </div>

      {hasEmail && (
        <div className="pt-2">
          <GlowButton type="submit" className="w-full sm:w-auto">
            {copy.submitLabel}
          </GlowButton>
        </div>
      )}
    </form>
  );
}
