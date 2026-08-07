/**
 * GET /api/affiliate/validate-code?code=NAME
 *
 * "Is this a live referral code I can redeem?" — called by the iOS app
 * when a user types a code at onboarding or at upgrade.
 *
 * This is the INVERSE of /check-code, which answers "can a new applicant
 * claim this name?". Do not confuse them:
 *   check-code    → available = true  means NOBODY owns it
 *   validate-code → valid     = true  means SOMEBODY owns it and it's active
 *
 * Deliberately returns nothing identifying about the affiliate. The
 * iOS client only needs to know the code works and what discount to
 * show; who owns it is our business, and echoing a creator's name or
 * email to any caller who guesses a code would leak the roster.
 *
 * Retired codes (renamed affiliates) return valid:false — they still
 * redirect for link traffic, but they must not mint new attributions
 * against a code the creator no longer uses.
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import {
  normalizeCode,
  validateCodeFormat,
  AFFILIATE_DISCOUNT_USD,
} from "@/lib/affiliate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Same per-instance speed bump as /check-code. A code-redemption
   endpoint is the one an attacker would brute-force to discover live
   codes, so this is tighter. */
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;
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

export async function GET(req: NextRequest) {
  if (rateLimited(clientIp(req))) {
    return NextResponse.json(
      { valid: false, error: "rate_limited" },
      { status: 429 }
    );
  }

  const code = normalizeCode(req.nextUrl.searchParams.get("code") || "");

  // Malformed codes can't exist, so answer without a read.
  if (validateCodeFormat(code)) {
    return NextResponse.json({ valid: false, code, reason: "invalid_format" });
  }

  try {
    const snap = await adminDb().collection("affiliateCodes").doc(code).get();
    if (!snap.exists) {
      return NextResponse.json({ valid: false, code, reason: "not_found" });
    }
    if ((snap.data() as { active?: boolean })?.active === false) {
      return NextResponse.json({ valid: false, code, reason: "retired" });
    }

    return NextResponse.json({
      valid: true,
      code,
      discountUsd: AFFILIATE_DISCOUNT_USD,
    });
  } catch (e) {
    console.error("[/api/affiliate/validate-code]", e);
    // Fail CLOSED here, unlike the click redirect. Granting a discount
    // we can't verify is a real loss; making the user retry is not.
    return NextResponse.json(
      { valid: false, code, reason: "unavailable" },
      { status: 503 }
    );
  }
}
