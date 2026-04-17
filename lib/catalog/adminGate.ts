/**
 * Kip It Real — admin access gate.
 *
 * Guards admin API routes and the admin UI against public access.
 * Set ADMIN_SECRET in your .env.local (or Vercel env) to any strong string.
 *
 * Clients pass the secret via the `x-admin-secret` request header.
 * The admin UI reads NEXT_PUBLIC_ADMIN_SECRET from the browser env —
 * only set this on machines / environments where admin access is intended.
 *
 * Usage in an API route:
 *
 *   import { requireAdmin } from "@/lib/catalog/adminGate";
 *
 *   export async function GET(req: Request) {
 *     const denied = requireAdmin(req);
 *     if (denied) return denied;
 *     // ... handler logic
 *   }
 *
 * Usage in a server component (layout or page guard):
 *
 *   import { isAdminEnabled } from "@/lib/catalog/adminGate";
 *   if (!isAdminEnabled()) redirect("/");
 */

import { NextResponse } from "next/server";

// ─── Environment helpers ──────────────────────────────────────────────────────

/**
 * Returns true if the ADMIN_SECRET env var is configured.
 * Use this to conditionally render admin navigation links.
 */
export function isAdminEnabled(): boolean {
  return Boolean(process.env.ADMIN_SECRET);
}

/**
 * Returns the configured admin secret.
 * Throws if called when ADMIN_SECRET is not set (fail-safe).
 */
function getAdminSecret(): string {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    throw new Error(
      "[adminGate] ADMIN_SECRET is not configured. Set it in .env.local.",
    );
  }
  return secret;
}

// ─── Request guard ────────────────────────────────────────────────────────────

/**
 * Checks the incoming request for a valid admin secret.
 *
 * Accepted delivery methods (checked in order):
 *  1. `x-admin-secret` header
 *  2. `secret` query parameter (for GET requests from browser address bar)
 *
 * Returns a 401 NextResponse if the secret is missing or wrong.
 * Returns null if the request is authorised — caller proceeds normally.
 */
export function requireAdmin(req: Request): NextResponse | null {
  let provided: string | null = null;

  // Header check (preferred for API calls).
  const headerVal = req.headers.get("x-admin-secret");
  if (headerVal) {
    provided = headerVal;
  }

  // Query param fallback (for quick browser-based access).
  if (!provided) {
    const url = new URL(req.url);
    const queryVal = url.searchParams.get("secret");
    if (queryVal) provided = queryVal;
  }

  if (!provided) {
    return NextResponse.json(
      { error: "Unauthorised — admin secret required" },
      { status: 401 },
    );
  }

  let expected: string;
  try {
    expected = getAdminSecret();
  } catch {
    return NextResponse.json(
      { error: "Admin access is not configured on this deployment" },
      { status: 503 },
    );
  }

  // Constant-time comparison to prevent timing attacks.
  if (!timingSafeEqual(provided, expected)) {
    return NextResponse.json(
      { error: "Unauthorised — invalid admin secret" },
      { status: 401 },
    );
  }

  return null; // authorised
}

/**
 * Minimal constant-time string comparison.
 * For a production system with sensitive data, replace with
 * `crypto.timingSafeEqual` on Buffers. Fine for this use case.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// ─── Server component guard ───────────────────────────────────────────────────

/**
 * Validates an admin secret string directly (for server component use
 * where you don't have a Request object).
 *
 * Example:
 *   const secret = searchParams.get("secret") ?? "";
 *   if (!validateAdminSecret(secret)) redirect("/");
 */
export function validateAdminSecret(provided: string): boolean {
  try {
    return timingSafeEqual(provided, getAdminSecret());
  } catch {
    return false;
  }
}
