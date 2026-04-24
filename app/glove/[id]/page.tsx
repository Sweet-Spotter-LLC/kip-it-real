import Link from "next/link";
import { notFound } from "next/navigation";
import { loadGloveById } from "@/lib/catalog/gloves";
import {
  POSITION_LABELS,
  SPORT_LABELS,
  WEB_TYPE_META,
} from "@/lib/glove/constants";
import {
  leatherLabel,
  breakInLabel,
  fitLabel,
  stiffnessLabel,
  gameReadyLabel,
  durabilityLabel,
  catchSecurityLabel,
  versatilityLabel,
  pocketDepthLabel,
  transferSpeedLabel,
} from "@/lib/glove/qualitative";

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
  params: Promise<{ id: string }>;
}

export default async function GloveDetailPage({ params }: DetailPageProps) {
  const { id } = await params;
  const glove = await loadGloveById(id);
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
              {glove.valueTier && (
                <span className="chip-accent">{glove.valueTier}</span>
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

        {/* ── Scouting report ──────────────────────────────────────────── */}
        <section className="mt-8">
          <h2 className="section-heading">Scouting Report</h2>

          {/* Feel & Construction */}
          <div className="mt-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-brand-support">
              Feel &amp; Construction
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <RatingSpecCell
                label="Leather"
                value={leatherLabel(glove.leatherQuality)}
                rating={glove.leatherQuality}
                max={5}
              />
              <RatingSpecCell
                label="Break-in"
                value={breakInLabel(glove.breakInTime)}
                rating={glove.breakInTime}
                max={5}
              />
              <RatingSpecCell
                label="Stiffness"
                value={stiffnessLabel(glove.stiffness)}
                rating={glove.stiffness}
                max={5}
              />
              <RatingSpecCell
                label="Game ready"
                value={gameReadyLabel(glove.gameReadyLevel)}
                rating={glove.gameReadyLevel}
                max={5}
              />
            </div>
          </div>

          {/* Fit */}
          <div className="mt-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-brand-support">
              Fit
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <SpecCell
                label="Pocket depth"
                value={pocketDepthLabel(glove.pocketDepth)}
              />
              <SpecCell
                label="Hand opening"
                value={fitLabel(glove.fitProfile)}
              />
              <SpecCell
                label="Transfer bias"
                value={transferSpeedLabel(glove.transferSpeedBias)}
              />
              <RatingSpecCell
                label="Catch security"
                value={catchSecurityLabel(glove.catchSecurity)}
                rating={glove.catchSecurity}
                max={5}
              />
            </div>
          </div>

          {/* Performance */}
          <div className="mt-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-brand-support">
              Performance
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <RatingSpecCell
                label="Durability"
                value={durabilityLabel(glove.durabilityScore)}
                rating={glove.durabilityScore}
                max={5}
              />
              <RatingSpecCell
                label="Versatility"
                value={versatilityLabel(glove.versatilityScore)}
                rating={glove.versatilityScore}
                max={5}
              />
            </div>
          </div>
        </section>

        {/* ── Specifications ────────────────────────────────────────────── */}
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
            <SpecCell label="Model year" value={`${glove.year}`} />
            {glove.series && (
              <SpecCell label="Series" value={glove.series} />
            )}
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

// ─── RatingSpecCell ──────────────────────────────────────────────────────────

/**
 * Like SpecCell but with a compact segmented rating bar for 0–5 scale attrs.
 * The bar gives an immediate visual read without showing a raw number.
 */
function RatingSpecCell({
  label,
  value,
  rating,
  max = 5,
}: {
  label: string;
  value: string;
  rating: number;
  max?: number;
}) {
  const filled = Math.max(0, Math.min(Math.round(rating), max));
  return (
    <div className="rounded-2xl border border-brand-bg-deep bg-white/60 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-support">
        {label}
      </p>
      <p className="mt-2 font-display text-lg font-bold text-brand-primary">
        {value}
      </p>
      <div className="mt-3 flex gap-1.5" aria-hidden="true">
        {Array.from({ length: max }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full ${
              i < filled ? "bg-brand-primary" : "bg-brand-bg-deep"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Label helper ────────────────────────────────────────────────────────────

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
