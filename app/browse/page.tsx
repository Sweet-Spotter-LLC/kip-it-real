import Link from "next/link";
import { loadCatalog } from "@/lib/catalog/gloves";
import { BrowseClient } from "@/components/browse/BrowseClient";

export const metadata = {
  title: "Browse gloves — Kip It Real",
  description:
    "Browse the full Kip It Real glove catalog. Filter by sport, position, brand, and price.",
};

// Match the 5-minute Sheets fetch cache — no point caching the page longer
// than the underlying data source.
export const revalidate = 300;

export default async function BrowsePage() {
  // Published catalog across all sports. Fall back to includeDrafts if the
  // sheet still has everything marked draft (matches /api/gloves behaviour).
  let gloves = await loadCatalog();
  if (gloves.length === 0) {
    gloves = await loadCatalog({ includeDrafts: true });
  }

  return (
    <section>
      <div className="mx-auto max-w-content px-4 py-14 md:px-8 md:py-16">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <div className="mb-10 max-w-2xl">
          <p className="eyebrow">Catalog</p>
          <h1 className="mt-4 font-display text-4xl md:text-5xl font-bold leading-tight text-brand-primary">
            Browse the glove catalog.
          </h1>
          <p className="mt-5 text-base md:text-lg leading-relaxed text-brand-text">
            Every glove Kip It Real scores. Filter by sport, position, brand,
            or price. Click any glove for full specs. Want a personalised
            match instead?{" "}
            <Link
              href="/quiz"
              className="font-semibold text-brand-primary underline decoration-brand-accent decoration-2 underline-offset-4"
            >
              Take the quiz
            </Link>
            .
          </p>
        </div>

        <BrowseClient gloves={gloves} />
      </div>
    </section>
  );
}
