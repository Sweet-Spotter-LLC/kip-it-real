import Link from "next/link";
import type { GloveMatchResult } from "@/lib/glove/types";
import { POSITION_LABELS, WEB_TYPE_META } from "@/lib/glove/constants";

interface GloveCardProps {
  match: GloveMatchResult;
  rank: number;
}

/**
 * Kip It Real — single result card.
 *
 * Hierarchy (top → bottom):
 *  1. Rank chip + match score
 *  2. Glove name + brand + price
 *  3. Key attribute badges
 *  4. Why this matches you
 *  5. Tradeoffs
 *  6. Who should avoid
 *  7. Actions (details + purchase links)
 */
export function GloveCard({ match, rank }: GloveCardProps) {
  const { glove, score, reasons, tradeoffs, avoidIf } = match;
  const webMeta = WEB_TYPE_META[glove.webType];

  return (
    <article className="card relative flex flex-col gap-6">
      {/* ── Rank + score ribbon ─────────────────────────────────────── */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="chip-accent">#{rank} match</span>
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-support">
            {glove.brand}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-support">
            Match score
          </span>
          <ScoreBadge score={score} />
        </div>
      </header>

      {/* ── Title + price ──────────────────────────────────────────── */}
      <div>
        <h2 className="font-display text-2xl md:text-3xl font-bold text-brand-primary">
          {glove.name}
        </h2>
        <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-2xl font-semibold text-brand-text">
            ${glove.price}
          </span>
          {glove.msrp && glove.msrp > glove.price && (
            <span className="text-sm text-brand-support line-through">
              MSRP ${glove.msrp}
            </span>
          )}
          <span className="text-sm text-brand-support">
            · {glove.sizeInches}&quot; · {webMeta.label}
          </span>
        </p>
      </div>

      {/* ── Attribute badges ───────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {glove.positionTags.map((p) => (
          <span key={p} className="chip">
            {POSITION_LABELS[p] ?? p}
          </span>
        ))}
        <span className="chip">
          Leather {glove.leatherQuality}/5
        </span>
        <span className="chip">
          Break-in {glove.breakInTime}/5
        </span>
        <span className="chip">
          Fit {glove.fitProfile > 0 ? "+" : ""}
          {glove.fitProfile}
        </span>
      </div>

      {/* ── Explanation blocks ─────────────────────────────────────── */}
      <ExplanationBlock
        heading="Why this matches you"
        items={reasons}
        accent="primary"
      />
      <ExplanationBlock
        heading="Tradeoffs"
        items={tradeoffs}
        accent="support"
      />
      <ExplanationBlock
        heading="Who should avoid this"
        items={avoidIf}
        accent="accent"
      />

      {/* ── Footer actions ─────────────────────────────────────────── */}
      <footer className="flex flex-wrap items-center gap-3 border-t border-brand-bg-deep pt-6">
        <Link
          href={`/glove/${glove.id}`}
          className="btn-primary text-sm md:text-base"
        >
          See full details
        </Link>
        {glove.purchaseLinks?.slice(0, 2).map((link) => (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="btn-secondary text-sm md:text-base"
          >
            Buy at {link.retailer} ↗
          </a>
        ))}
      </footer>
    </article>
  );
}

// ─── Score badge ────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 85
      ? "bg-brand-primary text-brand-accent"
      : score >= 70
      ? "bg-brand-accent text-brand-text"
      : "bg-brand-support text-brand-bg";
  return (
    <span
      className={[
        "inline-flex h-14 w-14 items-center justify-center rounded-full font-display text-xl font-bold shadow-card",
        tone,
      ].join(" ")}
    >
      {score}
    </span>
  );
}

// ─── Explanation block ──────────────────────────────────────────────────────

interface ExplanationBlockProps {
  heading: string;
  items: string[];
  accent: "primary" | "support" | "accent";
}

function ExplanationBlock({ heading, items, accent }: ExplanationBlockProps) {
  if (items.length === 0) return null;

  const barColor =
    accent === "primary"
      ? "bg-brand-primary"
      : accent === "accent"
      ? "bg-brand-accent"
      : "bg-brand-support";

  return (
    <section>
      <h3 className="flex items-center gap-2 font-display text-lg font-bold text-brand-primary">
        <span
          aria-hidden="true"
          className={`inline-block h-2 w-6 rounded-full ${barColor}`}
        />
        {heading}
      </h3>
      <ul className="mt-3 space-y-2 text-sm md:text-base text-brand-text">
        {items.map((item, i) => (
          <li key={i} className="flex gap-3 leading-relaxed">
            <span
              aria-hidden="true"
              className="mt-2 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-support"
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
