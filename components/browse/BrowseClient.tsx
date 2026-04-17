"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { GloveProduct } from "@/lib/glove/types";
import {
  BROWSE_SORT_OPTIONS,
  matchesBrowseFilters,
  sortBrowseGloves,
  uniqueBrands,
  priceBounds,
  type BrowseFilters,
  type BrowseSort,
} from "@/lib/glove/browse";
import { POSITION_LABELS, SPORT_LABELS } from "@/lib/glove/constants";

interface BrowseClientProps {
  gloves: GloveProduct[];
}

/**
 * Client-side browse experience: filters + sort + responsive card grid.
 * The catalog comes pre-fetched from the server component so initial paint
 * has the full list; filtering happens in-memory for snappy interaction.
 */
export function BrowseClient({ gloves }: BrowseClientProps) {
  const [bounds] = useState<[number, number]>(() => priceBounds(gloves));
  const brands = useMemo(() => uniqueBrands(gloves), [gloves]);

  const [filters, setFilters] = useState<BrowseFilters>({
    sport: "all",
    position: "all",
    brand: "all",
    minPrice: bounds[0],
    maxPrice: bounds[1],
    query: "",
  });
  const [sort, setSort] = useState<BrowseSort>("recommended");

  const visible = useMemo(() => {
    const filtered = gloves.filter((g) => matchesBrowseFilters(g, filters));
    return sortBrowseGloves(filtered, sort);
  }, [gloves, filters, sort]);

  function patch<K extends keyof BrowseFilters>(key: K, value: BrowseFilters[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  function reset() {
    setFilters({
      sport: "all",
      position: "all",
      brand: "all",
      minPrice: bounds[0],
      maxPrice: bounds[1],
      query: "",
    });
    setSort("recommended");
  }

  return (
    <div className="flex flex-col gap-8">
      {/* ── Filter bar ─────────────────────────────────────────────────── */}
      <section className="card">
        <div className="grid gap-4 md:grid-cols-12">
          {/* Search */}
          <div className="md:col-span-4">
            <Label htmlFor="browse-query">Search</Label>
            <input
              id="browse-query"
              type="search"
              placeholder="Brand, model, keyword…"
              value={filters.query ?? ""}
              onChange={(e) => patch("query", e.target.value)}
              className="mt-1 w-full rounded-xl border border-brand-bg-deep bg-white/70 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
            />
          </div>

          {/* Sport */}
          <div className="md:col-span-2">
            <Label htmlFor="browse-sport">Sport</Label>
            <select
              id="browse-sport"
              value={filters.sport}
              onChange={(e) =>
                patch("sport", e.target.value as BrowseFilters["sport"])
              }
              className="mt-1 w-full rounded-xl border border-brand-bg-deep bg-white/70 px-3 py-2 text-sm"
            >
              <option value="all">All sports</option>
              {Object.entries(SPORT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Position */}
          <div className="md:col-span-2">
            <Label htmlFor="browse-position">Position</Label>
            <select
              id="browse-position"
              value={filters.position}
              onChange={(e) =>
                patch("position", e.target.value as BrowseFilters["position"])
              }
              className="mt-1 w-full rounded-xl border border-brand-bg-deep bg-white/70 px-3 py-2 text-sm"
            >
              <option value="all">All positions</option>
              {Object.entries(POSITION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Brand */}
          <div className="md:col-span-2">
            <Label htmlFor="browse-brand">Brand</Label>
            <select
              id="browse-brand"
              value={filters.brand}
              onChange={(e) => patch("brand", e.target.value)}
              className="mt-1 w-full rounded-xl border border-brand-bg-deep bg-white/70 px-3 py-2 text-sm"
            >
              <option value="all">All brands</option>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div className="md:col-span-2">
            <Label htmlFor="browse-sort">Sort</Label>
            <select
              id="browse-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as BrowseSort)}
              className="mt-1 w-full rounded-xl border border-brand-bg-deep bg-white/70 px-3 py-2 text-sm"
            >
              {BROWSE_SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Min price */}
          <div className="md:col-span-3">
            <Label htmlFor="browse-min">Min price</Label>
            <input
              id="browse-min"
              type="number"
              min={0}
              step={10}
              value={filters.minPrice ?? 0}
              onChange={(e) => patch("minPrice", numberOrUndef(e.target.value))}
              className="mt-1 w-full rounded-xl border border-brand-bg-deep bg-white/70 px-3 py-2 text-sm"
            />
          </div>

          {/* Max price */}
          <div className="md:col-span-3">
            <Label htmlFor="browse-max">Max price</Label>
            <input
              id="browse-max"
              type="number"
              min={0}
              step={10}
              value={filters.maxPrice ?? bounds[1]}
              onChange={(e) => patch("maxPrice", numberOrUndef(e.target.value))}
              className="mt-1 w-full rounded-xl border border-brand-bg-deep bg-white/70 px-3 py-2 text-sm"
            />
          </div>

          {/* Reset */}
          <div className="md:col-span-6 flex items-end">
            <button
              type="button"
              onClick={reset}
              className="btn-ghost text-sm"
            >
              Reset filters
            </button>
          </div>
        </div>
      </section>

      {/* ── Count + grid ───────────────────────────────────────────────── */}
      <section className="flex flex-col gap-6">
        <p className="text-sm text-brand-support">
          Showing{" "}
          <span className="font-semibold text-brand-primary">
            {visible.length}
          </span>{" "}
          of {gloves.length} gloves
        </p>

        {visible.length === 0 ? (
          <div className="card text-center">
            <p className="font-display text-xl font-bold text-brand-primary">
              Nothing matches those filters.
            </p>
            <p className="mt-2 text-sm text-brand-support">
              Try widening the price range or clearing sport/position filters.
            </p>
            <button type="button" onClick={reset} className="btn-secondary mt-6">
              Reset filters
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((g) => (
              <BrowseCard key={g.id} glove={g} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function numberOrUndef(v: string): number | undefined {
  if (v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function Label({
  children,
  htmlFor,
}: {
  children: React.ReactNode;
  htmlFor: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-support"
    >
      {children}
    </label>
  );
}

// ─── Glove card ─────────────────────────────────────────────────────────────

function BrowseCard({ glove }: { glove: GloveProduct }) {
  return (
    <Link
      href={`/glove/${glove.id}`}
      className="card flex h-full flex-col gap-4 transition-shadow hover:shadow-card-hover focus:outline-none focus:ring-2 focus:ring-brand-primary"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-support">
            {glove.brand} · {SPORT_LABELS[glove.sport]}
          </p>
          <h3 className="mt-2 font-display text-lg font-bold text-brand-primary">
            {glove.name}
          </h3>
        </div>
        <span className="shrink-0 text-right font-display text-lg font-bold text-brand-primary">
          ${glove.price}
        </span>
      </header>

      {glove.descriptionShort && (
        <p className="text-sm leading-relaxed text-brand-text">
          {glove.descriptionShort}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {glove.positionTags.slice(0, 4).map((p) => (
          <span key={p} className="chip text-[11px]">
            {POSITION_LABELS[p] ?? p}
          </span>
        ))}
        <span className="chip text-[11px]">{glove.sizeInches}&quot;</span>
      </div>

      <div className="mt-auto flex flex-wrap gap-1.5">
        {glove.inProduction ? (
          <span className="chip-accent text-[11px]">In production</span>
        ) : (
          <span className="chip text-[11px] opacity-70">Discontinued</span>
        )}
        {glove.fastpitchFit && (
          <span className="chip text-[11px]">Fastpitch-specific</span>
        )}
        {glove.youthFriendly && (
          <span className="chip text-[11px]">Youth-friendly</span>
        )}
      </div>
    </Link>
  );
}
