import Link from "next/link";

/**
 * Kip It Real — homepage.
 *
 * Structure mirrors Bat Intentions:
 *  1. Hero (brand mark + tagline + primary CTA)
 *  2. Positioning block (independence / no affiliates)
 *  3. How it works (3 steps)
 *  4. Feature grid (sport-specific matching, unbiased, glove-native, mobile-friendly)
 *  5. Final CTA band
 */
export default function HomePage() {
  return (
    <>
      {/* ── HERO ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0
                     bg-gradient-to-b from-brand-bg-deep/60 via-brand-bg to-brand-bg"
        />
        <div className="relative mx-auto max-w-content px-4 py-20 md:px-8 md:py-28">
          <p className="eyebrow">Baseball · Fastpitch · Slowpitch</p>
          <h1 className="mt-6 font-display text-5xl md:text-7xl font-bold leading-[1.05] text-brand-primary">
            Find your <span className="text-brand-accent">sweet spot</span>.
          </h1>
          <p className="mt-6 max-w-2xl text-lg md:text-xl leading-relaxed text-brand-text">
            The glove matchmaker for players who care about fit, feel, and
            where the ball actually lands. Answer a few questions, get your
            top three matches — no affiliates, no sponsorships, no noise.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link href="/quiz" className="btn-primary text-base md:text-lg">
              Start the quiz
            </Link>
            <Link href="#how-it-works" className="btn-secondary">
              How it works
            </Link>
          </div>
          <p className="mt-8 text-sm font-semibold uppercase tracking-[0.18em] text-brand-support">
            Powered by Sweet&nbsp;Spotter
          </p>
        </div>
      </section>

      {/* ── POSITIONING ────────────────────────────────────────────────── */}
      <section className="border-t border-brand-bg-deep bg-white/40">
        <div className="mx-auto max-w-content px-4 py-16 md:px-8 md:py-20">
          <div className="grid gap-10 md:grid-cols-5">
            <div className="md:col-span-2">
              <p className="eyebrow">Unbiased by design</p>
              <h2 className="section-heading mt-4">
                Built by players, for players.
              </h2>
            </div>
            <div className="md:col-span-3 text-base md:text-lg leading-relaxed text-brand-text space-y-5">
              <p>
                Kip It Real is an independent ball glove matching engine — not
                a retailer, not a brand, and not a paid reviewer. We built this
                tool because finding the right glove shouldn&rsquo;t require
                hours of YouTube rabbit holes or trusting recommendations from
                someone with a sponsorship deal.
              </p>
              <p>
                Tell us how you play. We match you to the glove that fits your
                game, your league, and your budget using a structured scoring
                system built by players who&rsquo;ve been on the diamond.
              </p>
              <p className="font-semibold text-brand-primary">
                No affiliates influence your results. No brands pay for
                placement. Just your best gloves.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────── */}
      <section id="how-it-works" className="border-t border-brand-bg-deep">
        <div className="mx-auto max-w-content px-4 py-16 md:px-8 md:py-20">
          <div className="max-w-2xl">
            <p className="eyebrow">How it works</p>
            <h2 className="section-heading mt-4">
              Three steps. Roughly two minutes.
            </h2>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                num: "01",
                title: "Tell us about you",
                body: "Sport, position, age, throwing hand, fit preference, budget. We only ask what changes the recommendation.",
              },
              {
                num: "02",
                title: "We score the catalog",
                body: "Hard filters eliminate gloves that can't work. A weighted model ranks the rest across twelve fit dimensions.",
              },
              {
                num: "03",
                title: "You get your top 3",
                body: "Match score, specific reasons it fits you, tradeoffs, and who should avoid it. No generic filler.",
              },
            ].map((step) => (
              <div
                key={step.num}
                className="card transition-shadow hover:shadow-card-hover"
              >
                <span className="font-display text-4xl font-bold text-brand-accent">
                  {step.num}
                </span>
                <h3 className="mt-4 font-display text-xl font-bold text-brand-primary">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm md:text-base leading-relaxed text-brand-text">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURE GRID ──────────────────────────────────────────────── */}
      <section className="border-t border-brand-bg-deep bg-white/40">
        <div className="mx-auto max-w-content px-4 py-16 md:px-8 md:py-20">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                eyebrow: "Sport-aware",
                title: "Three sports, three models",
                body: "Baseball, fastpitch, and slowpitch each use their own weighted scoring — because the right glove for one isn't the right glove for another.",
              },
              {
                eyebrow: "Position-specific",
                title: "Infield, outfield, mitts",
                body: "Catchers and first basemen branch into mitt-specific logic. Utility players get versatility-weighted picks.",
              },
              {
                eyebrow: "Structured scoring",
                title: "Twelve-dimension fit",
                body: "Size, pocket, hand opening, break-in, leather quality, versatility, budget — all weighted and transparent.",
              },
              {
                eyebrow: "Independent",
                title: "No paid placements",
                body: "No brand sponsorships. No affiliate kickbacks shaping the ranking. Just a scoring engine that serves you.",
              },
            ].map((f) => (
              <div key={f.title} className="card">
                <p className="eyebrow">{f.eyebrow}</p>
                <h3 className="mt-3 font-display text-lg font-bold text-brand-primary">
                  {f.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-brand-text">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────────────── */}
      <section className="border-t border-brand-bg-deep">
        <div className="mx-auto max-w-content px-4 py-16 md:px-8 md:py-24">
          <div
            className="rounded-3xl bg-brand-primary px-6 py-12 text-center
                       shadow-card md:px-12 md:py-16"
          >
            <p className="eyebrow text-brand-accent">Ready when you are</p>
            <h2 className="mt-4 font-display text-3xl md:text-5xl font-bold text-brand-bg">
              Find your glove fit.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base md:text-lg text-brand-bg/80">
              Two minutes. Three matches. One glove that actually feels like
              yours.
            </p>
            <Link
              href="/quiz"
              className="mt-8 inline-flex items-center justify-center
                         rounded-2xl bg-brand-accent px-8 py-4
                         font-semibold text-brand-text
                         transition-transform duration-200
                         hover:-translate-y-0.5 hover:shadow-card-hover
                         focus:outline-none focus:ring-2 focus:ring-brand-bg
                         focus:ring-offset-2 focus:ring-offset-brand-primary"
            >
              Start the quiz
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
