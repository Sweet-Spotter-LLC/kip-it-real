import { NextResponse } from "next/server";
import { buildUserProfile } from "@/lib/glove/profile";
import { rankGloves } from "@/lib/glove/scoring";
import { recommendSize } from "@/lib/glove/sizing";
import { loadCatalog } from "@/lib/catalog/gloves";
import type { QuizAnswers } from "@/lib/glove/types";

/**
 * POST /api/gloves
 *
 * Body: QuizAnswers (JSON)
 * Returns: { results: GloveMatchResult[], profile: UserProfile, size: SizeRecommendation }
 *
 * The quiz client posts here after the user completes the flow.
 * Results include full explanations so the client needs no further processing.
 */
export async function POST(req: Request) {
  let answers: QuizAnswers;

  try {
    answers = (await req.json()) as QuizAnswers;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  // Minimal sanity-check on required fields before normalising.
  const required: Array<keyof QuizAnswers> = [
    "sport",
    "ageGroup",
    "throwHand",
    "primaryPosition",
    "experienceLevel",
    "playFrequency",
    "fitPreference",
    "breakInPreference",
  ];
  const missing = required.filter((k) => answers[k] === undefined);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing required answers: ${missing.join(", ")}` },
      { status: 400 },
    );
  }

  // Build the normalised profile + load catalog + rank.
  const profile = buildUserProfile(answers);

  // Try strict (published only) first — but fall back to including drafts if
  // the sheet hasn't been flipped to "published" yet. This keeps the app
  // useful while the catalog is still being curated.
  let catalog = await loadCatalog({ sport: profile.sport });
  if (catalog.length === 0) {
    catalog = await loadCatalog({
      sport: profile.sport,
      includeDrafts: true,
    });
  }

  const results = rankGloves(profile, catalog);

  // Compute the display-friendly size recommendation for the results header.
  const size = recommendSize({
    sport: answers.sport,
    ageGroup: answers.ageGroup,
    primaryPosition: answers.primaryPosition,
    experienceLevel: answers.experienceLevel,
    fastpitchFitImportant: answers.fastpitchFitImportant,
    wantsVersatility: answers.wantsVersatility,
  });

  return NextResponse.json({ results, profile, size });
}

/**
 * GET /api/gloves
 * Returns the full published catalog. Handy for a future "browse all" view.
 */
export async function GET() {
  const catalog = await loadCatalog();
  return NextResponse.json({ gloves: catalog, count: catalog.length });
}
