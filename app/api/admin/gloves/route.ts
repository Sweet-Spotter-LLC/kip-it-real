import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { requireAdmin } from "@/lib/catalog/adminGate";
import { loadCatalog } from "@/lib/catalog/gloves";
import { validateGloveRow } from "@/lib/catalog/validation";

const LOCAL_FILE = path.join(process.cwd(), "data", "gloves", "local.json");

function readLocal(): Record<string, unknown>[] {
  if (!fs.existsSync(LOCAL_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(LOCAL_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function writeLocal(data: unknown[]) {
  fs.mkdirSync(path.dirname(LOCAL_FILE), { recursive: true });
  fs.writeFileSync(LOCAL_FILE, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * GET /api/admin/gloves
 * Returns the full catalog including drafts.
 */
export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const catalog = await loadCatalog({ includeDrafts: true });
  return NextResponse.json({ gloves: catalog, count: catalog.length });
}

/**
 * POST /api/admin/gloves
 * Creates a new glove in local.json.
 * Body: raw glove row (same shape as CSV import).
 */
export async function POST(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const raw = await req.json();

  // Normalise pipe arrays that may arrive as arrays from the form.
  const normalised = {
    ...raw,
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

  const local = readLocal();
  const exists = local.find((g: unknown) => (g as { id: string }).id === result.product!.id);
  if (exists) {
    return NextResponse.json(
      { error: `Glove with id "${result.product!.id}" already exists` },
      { status: 409 },
    );
  }

  local.push(result.product! as unknown as Record<string, unknown>);
  writeLocal(local);

  return NextResponse.json({ glove: result.product }, { status: 201 });
}
