import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { requireAdmin } from "@/lib/catalog/adminGate";
import { loadCatalog } from "@/lib/catalog/gloves";
import { validateGloveRow } from "@/lib/catalog/validation";
import type { GloveProduct } from "@/lib/glove/types";

const LOCAL_FILE = path.join(process.cwd(), "data", "gloves", "local.json");

function readLocal(): GloveProduct[] {
  if (!fs.existsSync(LOCAL_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(LOCAL_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function writeLocal(data: GloveProduct[]) {
  fs.mkdirSync(path.dirname(LOCAL_FILE), { recursive: true });
  fs.writeFileSync(LOCAL_FILE, JSON.stringify(data, null, 2), "utf-8");
}

function upsertToLocal(updated: GloveProduct) {
  const local = readLocal();
  const idx = local.findIndex((g) => g.id === updated.id);
  if (idx >= 0) {
    local[idx] = updated;
  } else {
    local.push(updated);
  }
  writeLocal(local);
}

interface RouteContext {
  params: { id: string };
}

/**
 * GET /api/admin/gloves/[id]
 * Returns a single glove including drafts.
 */
export async function GET(req: Request, { params }: RouteContext) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const catalog = await loadCatalog({ includeDrafts: true });
  const glove = catalog.find((g) => g.id === params.id);
  if (!glove) {
    return NextResponse.json({ error: "Glove not found" }, { status: 404 });
  }
  return NextResponse.json({ glove });
}

/**
 * PUT /api/admin/gloves/[id]
 * Full update — validates the complete row and writes to local.json.
 */
export async function PUT(req: Request, { params }: RouteContext) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const raw = await req.json();

  // Force the id to match the URL param.
  const normalised = {
    ...raw,
    id: params.id,
    positionTags:
      typeof raw.positionTags === "string"
        ? raw.positionTags
        : (raw.positionTags as string[])?.join("|"),
    throwHandAvailability:
      typeof raw.throwHandAvailability === "string"
        ? raw.throwHandAvailability
        : (raw.throwHandAvailability as string[])?.join("|"),
  };

  const result = validateGloveRow(normalised);
  if (!result.valid) {
    return NextResponse.json(
      { error: "Validation failed", errors: result.errors },
      { status: 422 },
    );
  }

  upsertToLocal(result.product!);
  return NextResponse.json({ glove: result.product });
}

/**
 * PATCH /api/admin/gloves/[id]
 * Partial update — used for status toggle (draft ↔ published).
 * Also supports patching any subset of fields without full validation.
 */
export async function PATCH(req: Request, { params }: RouteContext) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const patch = await req.json();

  // Find existing glove across full catalog (including sport files).
  const catalog = await loadCatalog({ includeDrafts: true });
  const existing = catalog.find((g) => g.id === params.id);
  if (!existing) {
    return NextResponse.json({ error: "Glove not found" }, { status: 404 });
  }

  // Validate just the status field if that's what's being patched.
  if (patch.status && !["draft", "published"].includes(patch.status)) {
    return NextResponse.json(
      { error: `Invalid status "${patch.status}"` },
      { status: 422 },
    );
  }

  const updated: GloveProduct = { ...existing, ...patch };
  upsertToLocal(updated);

  return NextResponse.json({ glove: updated });
}
