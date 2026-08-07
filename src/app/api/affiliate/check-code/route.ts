/**
 * GET /api/affiliate/check-code?code=CHLOE
 *
 * Real-time availability for the referral code an applicant is typing,
 * the same way a username field behaves. Public (an applicant has no
 * account yet), so it is deliberately narrow: it reveals only
 * taken/not-taken for one code at a time, never a listing.
 *
 * "Taken" means EITHER already issued (`affiliateCodes/{CODE}`) OR
 * requested by a still-pending application. Pending requests count as
 * taken on purpose — two creators shouldn't both go build story slides
 * around the same code while we're reviewing.
 *
 * Availability is a courtesy, not a reservation. The code is only
 * really locked when an admin approves the application, which re-runs
 * every one of these checks inside a transaction.
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import {
  normalizeCode,
  validateCodeFormat,
  suggestAlternatives,
  CODE_REJECTION_MESSAGES,
} from "@/lib/affiliate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ── Rate limit ──
   Keystroke-driven endpoints invite scraping, so cap per IP. This is
   per-instance memory: on serverless it resets on cold start and isn't
   shared across regions, which makes it a speed bump rather than a
   real control. If the endpoint ever gets abused, move this to
   Firestore or a KV store with a shared counter. */
const RATE_LIMIT = 60; // requests
const RATE_WINDOW_MS = 60_000; // per minute per IP
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  if (entry.count > RATE_LIMIT) return true;
  // Opportunistic cleanup so the map can't grow without bound.
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k);
  }
  return false;
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

/** Codes already issued, or spoken for by a pending application. */
async function takenCodes(): Promise<Set<string>> {
  const db = adminDb();
  const [issued, pending] = await Promise.all([
    db.collection("affiliateCodes").get(),
    db
      .collection("affiliateApplications")
      .where("status", "==", "pending")
      .get(),
  ]);

  const set = new Set<string>();
  issued.forEach((d) => set.add(normalizeCode(d.id)));
  pending.forEach((d) => {
    const requested = (d.data() as { requestedCode?: string }).requestedCode;
    if (requested) set.add(normalizeCode(requested));
  });
  return set;
}

export async function GET(req: NextRequest) {
  if (rateLimited(clientIp(req))) {
    return NextResponse.json(
      { error: "Too many requests. Slow down a moment." },
      { status: 429 }
    );
  }

  const raw = req.nextUrl.searchParams.get("code") || "";
  const code = normalizeCode(raw);

  // Format + reserved + profanity, before we touch the database.
  const rejection = validateCodeFormat(code);
  if (rejection) {
    return NextResponse.json({
      code,
      available: false,
      reason: rejection,
      message: CODE_REJECTION_MESSAGES[rejection],
      suggestions: [],
    });
  }

  try {
    const taken = await takenCodes();
    if (taken.has(code)) {
      return NextResponse.json({
        code,
        available: false,
        reason: "taken",
        message: "That code is already taken",
        suggestions: suggestAlternatives(code, (c) => taken.has(c)),
      });
    }

    return NextResponse.json({
      code,
      available: true,
      message: `${code} is available`,
      suggestions: [],
    });
  } catch (e) {
    console.error("[/api/affiliate/check-code]", e);
    // Fail soft: the applicant can still submit, and approval re-checks
    // everything anyway. Blocking submission on our own outage is worse.
    return NextResponse.json(
      {
        code,
        available: null,
        message: "Couldn't check right now — we'll confirm on review",
        suggestions: [],
      },
      { status: 200 }
    );
  }
}
