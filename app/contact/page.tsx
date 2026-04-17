import Link from "next/link";

export const metadata = {
  title: "Contact — Kip It Real",
  description:
    "Get in touch with Kip It Real. Feedback, glove requests, partnerships, or catalog corrections — we read everything.",
};

const CONTACT_EMAIL = "RobertCarlsonDA@Outlook.com";

const REASONS: Array<{ title: string; body: string }> = [
  {
    title: "Feedback on your match",
    body: "Tell us what worked, what missed, or which glove you ended up buying. Real-world feedback sharpens the scoring engine.",
  },
  {
    title: "Glove requests",
    body: "Want a model added to the catalog? Send the brand, model name, and a link — we'll consider it for the next sync.",
  },
  {
    title: "Partnership inquiries",
    body: "League organisers, coaches, podcasters, retailers — if you want to collaborate or point your audience at Kip It Real, start here.",
  },
  {
    title: "Catalog corrections",
    body: "Spot something wrong? A price that moved, a spec that's off, a discontinued glove still listed — let us know and we'll fix it.",
  },
];

export default function ContactPage() {
  const subject = encodeURIComponent("Kip It Real — hello");
  const mailto = `mailto:${CONTACT_EMAIL}?subject=${subject}`;

  return (
    <section>
      <div className="mx-auto max-w-content px-4 py-16 md:px-8 md:py-20">
        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="max-w-2xl">
          <p className="eyebrow">Contact</p>
          <h1 className="mt-4 font-display text-4xl md:text-5xl font-bold leading-tight text-brand-primary">
            Get in touch.
          </h1>
          <p className="mt-6 text-base md:text-lg leading-relaxed text-brand-text">
            Kip It Real is built by Sweet Spotter — a small team that cares
            about getting glove recommendations right. We read every message
            and reply when it makes sense to.
          </p>
        </div>

        {/* ── Reasons grid ─────────────────────────────────────────────── */}
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {REASONS.map((r) => (
            <div key={r.title} className="card">
              <h2 className="font-display text-lg md:text-xl font-bold text-brand-primary">
                {r.title}
              </h2>
              <p className="mt-3 text-sm md:text-base leading-relaxed text-brand-text">
                {r.body}
              </p>
            </div>
          ))}
        </div>

        {/* ── Contact CTA ──────────────────────────────────────────────── */}
        <div className="mt-14 rounded-3xl bg-brand-primary px-6 py-10 text-center shadow-card md:px-10 md:py-12">
          <p className="eyebrow text-brand-accent">Email the team</p>
          <h2 className="mt-3 font-display text-2xl md:text-3xl font-bold text-brand-bg">
            {CONTACT_EMAIL}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm md:text-base text-brand-bg/80">
            Drop a note. Include your sport, position, and a short description
            of what you need — we&rsquo;ll route it to the right place.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href={mailto}
              className="inline-flex items-center justify-center rounded-2xl bg-brand-accent px-6 py-3 font-semibold text-brand-text transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-card-hover focus:outline-none focus:ring-2 focus:ring-brand-bg focus:ring-offset-2 focus:ring-offset-brand-primary"
            >
              Start an email
            </a>
            <Link
              href="/quiz"
              className="inline-flex items-center justify-center rounded-2xl border border-brand-bg/40 px-6 py-3 font-semibold text-brand-bg transition-colors hover:bg-brand-bg/10"
            >
              Take the quiz instead
            </Link>
          </div>
        </div>

        {/* ── Fine print ───────────────────────────────────────────────── */}
        <p className="mt-10 text-xs text-brand-support">
          Kip It Real is independently operated. We don&rsquo;t share your
          email or sell your feedback. Messages are reviewed by the product
          team only.
        </p>
      </div>
    </section>
  );
}
