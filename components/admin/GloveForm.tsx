"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { GloveProduct } from "@/lib/glove/types";

interface GloveFormProps {
  initial?: Partial<GloveProduct>;
  mode: "create" | "edit";
  adminSecret: string;
}

const SPORTS = ["baseball", "fastpitch", "slowpitch"];
const GLOVE_TYPES = ["fielding", "catcher", "first_base"];
const POSITIONS = ["infield", "outfield", "pitcher", "catcher", "first_base", "utility"];
const THROW_HANDS = ["RHT", "LHT"];
const WEB_TYPES = [
  "i_web","h_web","basket","closed","trap",
  "modified_trap","single_post","two_piece_closed","unsure",
];
const PATTERN_TYPES = ["infield","outfield","pitcher","utility","softball_specific"];
const STATUSES = ["draft", "published"];

/**
 * Reusable create/edit form for GloveProduct.
 * Organized into sections matching the spec: Identity, Classification,
 * Dimensions, Performance, Flags, Commerce, Content.
 */
export function GloveForm({ initial = {}, mode, adminSecret }: GloveFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // ── Form state ────────────────────────────────────────────────────────────
  const [f, setF] = useState({
    id: initial.id ?? "",
    name: initial.name ?? "",
    brand: initial.brand ?? "",
    year: initial.year ?? new Date().getFullYear(),
    status: initial.status ?? "draft",
    sport: initial.sport ?? "baseball",
    gloveType: initial.gloveType ?? "fielding",
    positionTags: (initial.positionTags ?? []).join("|"),
    throwHandAvailability: (initial.throwHandAvailability ?? ["RHT", "LHT"]).join("|"),
    patternType: initial.patternType ?? "infield",
    webType: initial.webType ?? "i_web",
    sizeInches: initial.sizeInches ?? 11.5,
    pocketDepth: initial.pocketDepth ?? 0,
    fitProfile: initial.fitProfile ?? 0,
    wristOpening: initial.wristOpening ?? 0,
    handStallWidth: initial.handStallWidth ?? 0,
    easyClose: initial.easyClose ?? 0,
    stiffness: initial.stiffness ?? 2,
    breakInTime: initial.breakInTime ?? 2,
    leatherQuality: initial.leatherQuality ?? 3,
    durabilityScore: initial.durabilityScore ?? 3,
    gameReadyLevel: initial.gameReadyLevel ?? 3,
    transferSpeedBias: initial.transferSpeedBias ?? 0,
    catchSecurity: initial.catchSecurity ?? 3,
    versatilityScore: initial.versatilityScore ?? 3,
    youthFriendly: initial.youthFriendly ?? false,
    fastpitchFit: initial.fastpitchFit ?? false,
    slowpitchFriendly: initial.slowpitchFriendly ?? false,
    inProduction: initial.inProduction ?? true,
    price: initial.price ?? 0,
    msrp: initial.msrp ?? "",
    purchaseLinks: (initial.purchaseLinks ?? [])
      .map((l) => `${l.retailer}::${l.url}`)
      .join("|"),
    descriptionShort: initial.descriptionShort ?? "",
    notes: initial.notes ?? "",
    lastVerified: initial.lastVerified ?? new Date().toISOString().slice(0, 10),
  });

  function set(key: keyof typeof f, value: unknown) {
    setF((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const url =
      mode === "create" ? "/api/admin/gloves" : `/api/admin/gloves/${f.id}`;
    const method = mode === "create" ? "POST" : "PUT";

    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": adminSecret,
      },
      body: JSON.stringify({
        ...f,
        positionTags: f.positionTags,
        throwHandAvailability: f.throwHandAvailability,
        year: Number(f.year),
        sizeInches: Number(f.sizeInches),
        pocketDepth: Number(f.pocketDepth),
        fitProfile: Number(f.fitProfile),
        wristOpening: Number(f.wristOpening),
        handStallWidth: Number(f.handStallWidth),
        easyClose: Number(f.easyClose),
        stiffness: Number(f.stiffness),
        breakInTime: Number(f.breakInTime),
        leatherQuality: Number(f.leatherQuality),
        durabilityScore: Number(f.durabilityScore),
        gameReadyLevel: Number(f.gameReadyLevel),
        transferSpeedBias: Number(f.transferSpeedBias),
        catchSecurity: Number(f.catchSecurity),
        versatilityScore: Number(f.versatilityScore),
        price: Number(f.price),
        msrp: f.msrp !== "" ? Number(f.msrp) : undefined,
      }),
    });

    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? "Save failed.");
      setSaving(false);
      return;
    }

    router.push("/admin");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-10">
      {/* ── Identity ────────────────────────────────────────────────── */}
      <FormSection title="Identity">
        <FormRow>
          <Field label="ID (slug)" hint="e.g. rawlings-hoh-11-75-infield — no spaces">
            <input {...text(f, "id", set)} disabled={mode === "edit"} />
          </Field>
          <Field label="Name">
            <input {...text(f, "name", set)} />
          </Field>
        </FormRow>
        <FormRow>
          <Field label="Brand">
            <input {...text(f, "brand", set)} />
          </Field>
          <Field label="Year">
            <input {...num(f, "year", set)} />
          </Field>
          <Field label="Status">
            <Select value={f.status} onChange={(v) => set("status", v)} options={STATUSES} />
          </Field>
        </FormRow>
      </FormSection>

      {/* ── Classification ─────────────────────────────────────────── */}
      <FormSection title="Classification">
        <FormRow>
          <Field label="Sport">
            <Select value={f.sport} onChange={(v) => set("sport", v)} options={SPORTS} />
          </Field>
          <Field label="Glove type">
            <Select value={f.gloveType} onChange={(v) => set("gloveType", v)} options={GLOVE_TYPES} />
          </Field>
          <Field label="Pattern type">
            <Select value={f.patternType} onChange={(v) => set("patternType", v)} options={PATTERN_TYPES} />
          </Field>
        </FormRow>
        <FormRow>
          <Field label="Position tags" hint="Pipe-delimited: infield|pitcher">
            <input {...text(f, "positionTags", set)} placeholder="infield|pitcher" />
          </Field>
          <Field label="Throw hand availability" hint="Pipe-delimited: RHT|LHT">
            <input {...text(f, "throwHandAvailability", set)} placeholder="RHT|LHT" />
          </Field>
          <Field label="Web type">
            <Select value={f.webType} onChange={(v) => set("webType", v)} options={WEB_TYPES} />
          </Field>
        </FormRow>
        <Field label="Size (inches)">
          <input {...num(f, "sizeInches", set)} step="0.25" />
        </Field>
      </FormSection>

      {/* ── Performance dimensions ─────────────────────────────────── */}
      <FormSection title="Performance dimensions" hint="Signed scale (-2 to +3) unless noted as 0–5">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { key: "pocketDepth", label: "Pocket depth (-2..+3)" },
            { key: "fitProfile", label: "Fit profile (-2..+3)" },
            { key: "wristOpening", label: "Wrist opening (-2..+3)" },
            { key: "handStallWidth", label: "Hand stall width (-2..+3)" },
            { key: "easyClose", label: "Easy close (-2..+3)" },
            { key: "transferSpeedBias", label: "Transfer speed bias (-2..+3)" },
          ].map(({ key, label }) => (
            <Field key={key} label={label}>
              <input {...num(f, key as keyof typeof f, set)} min={-2} max={3} step={1} />
            </Field>
          ))}
          {[
            { key: "stiffness", label: "Stiffness (0–5)" },
            { key: "breakInTime", label: "Break-in time (0–5)" },
            { key: "leatherQuality", label: "Leather quality (1–5)" },
            { key: "durabilityScore", label: "Durability (0–5)" },
            { key: "gameReadyLevel", label: "Game-ready level (0–5)" },
            { key: "catchSecurity", label: "Catch security (0–5)" },
            { key: "versatilityScore", label: "Versatility (0–5)" },
          ].map(({ key, label }) => (
            <Field key={key} label={label}>
              <input {...num(f, key as keyof typeof f, set)} min={0} max={5} step={1} />
            </Field>
          ))}
        </div>
      </FormSection>

      {/* ── Flags ───────────────────────────────────────────────────── */}
      <FormSection title="Flags">
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { key: "youthFriendly", label: "Youth friendly" },
            { key: "fastpitchFit", label: "Fastpitch-specific fit" },
            { key: "slowpitchFriendly", label: "Slowpitch friendly" },
            { key: "inProduction", label: "In production" },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(f[key as keyof typeof f])}
                onChange={(e) => set(key as keyof typeof f, e.target.checked)}
                className="h-4 w-4 accent-brand-primary"
              />
              <span className="text-sm font-medium text-brand-text">{label}</span>
            </label>
          ))}
        </div>
      </FormSection>

      {/* ── Commerce ────────────────────────────────────────────────── */}
      <FormSection title="Commerce">
        <FormRow>
          <Field label="Price ($)">
            <input {...num(f, "price", set)} min={0} step={1} />
          </Field>
          <Field label="MSRP (optional)">
            <input
              type="number"
              value={f.msrp}
              onChange={(e) => set("msrp", e.target.value)}
              min={0}
              step={1}
              className={inputCls}
            />
          </Field>
        </FormRow>
        <Field label="Purchase links" hint="Format: Retailer Name::https://url.com|Other Store::https://url2.com">
          <textarea
            value={f.purchaseLinks}
            onChange={(e) => set("purchaseLinks", e.target.value)}
            rows={2}
            className={inputCls}
          />
        </Field>
      </FormSection>

      {/* ── Content ─────────────────────────────────────────────────── */}
      <FormSection title="Content">
        <Field label="Short description (1–2 sentences)">
          <textarea
            value={f.descriptionShort}
            onChange={(e) => set("descriptionShort", e.target.value)}
            rows={2}
            className={inputCls}
          />
        </Field>
        <Field label="Notes (internal)">
          <textarea
            value={f.notes}
            onChange={(e) => set("notes", e.target.value)}
            rows={3}
            className={inputCls}
          />
        </Field>
        <Field label="Last verified date (YYYY-MM-DD)">
          <input {...text(f, "lastVerified", set)} placeholder="2026-04-14" />
        </Field>
      </FormSection>

      {/* ── Error + submit ───────────────────────────────────────────── */}
      {error && (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex items-center gap-4 border-t border-brand-bg-deep pt-6">
        <button
          type="submit"
          disabled={saving}
          className="btn-primary disabled:opacity-50"
        >
          {saving ? "Saving…" : mode === "create" ? "Create glove" : "Save changes"}
        </button>
        <a href="/admin" className="btn-ghost">
          Cancel
        </a>
      </div>
    </form>
  );
}

// ─── Helper utilities ────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-xl border border-brand-bg-deep bg-white/80 px-4 py-2 text-sm text-brand-text " +
  "focus:border-brand-accent focus:outline-none disabled:opacity-50 disabled:bg-brand-bg-deep";

function text<K extends string>(
  f: Record<string, unknown>,
  key: K,
  set: (k: K, v: string) => void,
) {
  return {
    type: "text" as const,
    value: f[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(key, e.target.value),
    className: inputCls,
  };
}

function num<K extends string>(
  f: Record<string, unknown>,
  key: K,
  set: (k: K, v: unknown) => void,
) {
  return {
    type: "number" as const,
    value: f[key] as number,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      set(key, e.target.value),
    className: inputCls,
  };
}

function FormSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card flex flex-col gap-5">
      <div>
        <h2 className="font-display text-xl font-bold text-brand-primary">
          {title}
        </h2>
        {hint && <p className="mt-1 text-xs text-brand-support">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function FormRow({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-3">{children}</div>;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-support">
        {label}
      </span>
      {children}
      {hint && <span className="text-xs text-brand-support">{hint}</span>}
    </label>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={inputCls}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
