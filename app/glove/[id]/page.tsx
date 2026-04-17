import Link from "next/link";
import { notFound } from "next/navigation";
import { loadGloveById } from "@/lib/catalog/gloves";
import {
  POSITION_LABELS,
  SPORT_LABELS,
  WEB_TYPE_META,
} from "@/lib/glove/constants";

/**
 * Kip It Real — glove detail page.
 *
 * Server component. Loads the glove directly from the JSON catalog at
 * request time. Structure mirrors the Bat Intentions detail page:
 *   · Header block (brand / name / price / actions)
 *   · Sport + position badges
 *   · Spec grid (two columns of attribute cells)
 *   · Description / notes section
 *   · Purchase links
 *   · Back to results / retake quiz footer
 */
interface DetailPageProps {
  params: { id: string };
}

export default async function GloveDetailPage({ params }: DetailPageProps) {
  const glove = await loadGloveById(params.id);
  if (!glove) notFound();

  const webMeta = WEB_TYPE_META[glove.webType];

  return (
    <section>
      <div className="mx-auto max-w-content px-4 py-12 md:px-8 md:py-16">
        {/* ── Top nav breadcrumb ──────────────────────────────────────── */}
        <nav className="mb-8 flex items-center gap-2 text-sm text-brand-support">
          <Link
            href="/"
            className="hover:text-brand-primary transition-colors"
          >
            Kip It Real
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-brand-text">{SPORT_LABELS[glove.sport]}</span>
          <span aria-hidden="true">/</span>
          <span className="text-brand-text">{glove.brand}</span>
        </nav>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <header className="card flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="eyebrow">{glove.brand}</p>
            <h1 className="mt-3 font-display text-3xl md:text-5xl font-bold text-brand-primary">
              {glove.name}
            </h1>
            <p className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-2">
              <span className="text-3xl font-semibold text-brand-text">
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

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="chip-accent">
                {SPORT_LABELS[glove.sport]}
              </span>
              {glove.positionTags.map((p) => (
                <span key={p} className="chip">
                  {POSITION_LABELS[p]}
                </span>
              ))}
              {glove.youthFriendly && <span className="chip">Youth friendly</span>}
              {glove.fastpitchFit && <span className="chip">Fastpitch fit</span>}
              {glove.slowpitchFriendly && (
                <span className="chip">Slowpitch ready</span>
              )}
            </div>
          </div>

          {/* ── Header action column ─────────────────────────────────── */}
          <div className="flex flex-col gap-3 md:min-w-[240px]">
            {glove.purchaseLinks?.slice(0, 3).map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="btn-primary text-sm"
              >
                Buy at {link.retailer} ↗
              </a>
            ))}
            <Link href="/quiz" className="btn-secondary text-sm">
              Retake the quiz
            </Link>
          </div>
        </header>

        {/* ── Description ─────────────────────────────────────────────── */}
        {(glove.descriptionShort || glove.notes) && (
          <section className="card mt-8">
            {glove.descriptionShort && (
              <p className="font-display text-xl md:text-2xl leading-relaxed text-brand-primary">
                {glove.descriptionShort}
              </p>
            )}
            {glove.notes && (
              <p className="mt-4 text-base leading-relaxed text-brand-text">
                {glove.notes}
              </p>
            )}
          </section>
        )}

        {/* ── Spec grid ───────────────────────────────────────────────── */}
        <section className="mt-8">
          <h2 className="section-heading">Specifications</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <SpecCell
              label="Size"
              value={
                glove.gloveType === "catcher"
                  ? `${glove.sizeInches}" circumference`
                  : `${glove.sizeInches}"`
              }
            />
            <SpecCell label="Pattern" value={capitalize(glove.patternType)} />
            <SpecCell
              label="Web type"
              value={webMeta.label}
              sub={webMeta.description}
            />
            <SpecCell
              label="Glove type"
              value={capitalize(glove.gloveType.replace("_", " "))}
            />
            <SpecCell
              label="Throw-hand availability"
              value={glove.throwHandAvailability.join(" · ")}
            />
            <SpecCell
              label="Leather quality"
              value={`${glove.leatherQuality}/5`}
              sub={leatherTierLabel(glove.leatherQuality)}
            />
            <SpecCell
              label="Break-in time"
              value={`${glove.breakInTime}/5`}
              sub={breakInLabel(glove.breakInTime)}
            />
            <SpecCell
              label="Stiffness"
              value={`${glove.stiffness}/5`}
              sub={stiffnessLabel(glove.stiffness)}
            />
            <SpecCell
              label="Game-ready level"
              value={`${glove.gameReadyLevel}/5`}
            />
            <SpecCell
              label="Durability"
              value={`${glove.durabilityScore}/5`}
            />
            <SpecCell
              label="Pocket depth"
              value={depthLabel(glove.pocketDepth)}
              sub={`Raw value: ${formatSigned(glove.pocketDepth)}`}
            />
            <SpecCell
              label="Fit profile"
              value={fitLabel(glove.fitProfile)}
              sub={`Raw value: ${formatSigned(glove.fitProfile)}`}
            />
            <SpecCell
              label="Transfer speed bias"
              value={transferLabel(glove.transferSpeedBias)}
              sub={`Raw value: ${formatSigned(glove.transferSpeedBias)}`}
            />
            <SpecCell
              label="Catch security"
              value={`${glove.catchSecurity}/5`}
            />
            <SpecCell
              label="Versatility"
              value={`${glove.versatilityScore}/5`}
            />
            <SpecCell label="Model year" value={`${glove.year}`} />
            {glove.lastVerified && (
              <SpecCell label="Last verified" value={glove.lastVerified} />
            )}
          </div>
        </section>

        {/* ── Purchase links (full list) ─────────────────────────────── */}
        {glove.purchaseLinks && glove.purchaseLinks.length > 0 && (
          <section className="mt-8">
            <h2 className="section-heading">Where to buy</h2>
            <p className="mt-2 text-sm text-brand-support">
              Links may include affiliate codes that support Kip It Real at no cost to you.
            </p>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {glove.purchaseLinks.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-2xl
                             border border-brand-bg-deep bg-white/60
                             px-5 py-4 font-semibold text-brand-primary
                             transition-all hover:border-brand-accent hover:shadow-card"
                >
                  {link.retailer}
                  <span aria-hidden="true" className="text-brand-accent">
                    ↗
                  </span>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* ── Back action ─────────────────────────────────────────────── */}
        <footer className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-brand-bg-deep pt-8">
          <Link href="/results" className="btn-ghost">
            ← Back to results
          </Link>
          <Link href="/quiz" className="btn-primary">
            Find another glove
          </Link>
        </footer>
      </div>
    </section>
  );
}

// ─── SpecCell ────────────────────────────────────────────────────────────────

function SpecCell({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-brand-bg-deep bg-white/60 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-support">
        {label}
      </p>
      <p className="mt-2 font-display text-lg font-bold text-brand-primary">
        {value}
      </p>
      {sub && (
        <p className="mt-2 text-xs leading-relaxed text-brand-support">
          {sub}
        </p>
      )}
    </div>
  );
}

// ─── Label helpers ───────────────────────────────────────────────────────────

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function formatSigned(n: number) {
  return n > 0 ? `+${n}` : `${n}`;
}
function depthLabel(n: number) {
  if (n >= 2) return "Very deep";
  if (n >= 1) return "Deep";
  if (n >= -0.5) return "Medium";
  if (n >= -1.5) return "Shallow";
  return "Very shallow";
}
function fitLabel(n: number) {
  if (n >= 1.5) return "Roomy";
  if (n >= 0.5) return "Slightly roomy";
  if (n >= -0.5) return "Balanced";
  if (n >= -1.5) return "Snug";
  return "Very snug";
}
function transferLabel(n: number) {
  if (n >= 2) return "Quick transfer";
  if (n >= 0.5) return "Leans quick";
  if (n >= -0.5) return "Balanced";
  return "Deep / catch security";
}
function leatherTierLabel(n: number) {
  if (n >= 5) return "Top-tier full-grain";
  if (n >= 4) return "Premium leather";
  if (n >= 3) return "Mid-range leather";
  if (n >= 2) return "Entry-level leather";
  return "Synthetic or low-grade";
}
function breakInLabel(n: number) {
  if (n >= 4) return "Extended conditioning required";
  if (n >= 3) return "Noticeable break-in period";
  if (n >= 2) return "Moderate break-in";
  if (n >= 1) return "Short break-in";
  return "Game-ready";
}
function stiffnessLabel(n: number) {
  if (n >= 4) return "Raw, premium-stiff";
  if (n >= 3) return "Firm";
  if (n >= 2) return "Moderate";
  if (n >= 1) return "Soft";
  return "Already broken in";
}
