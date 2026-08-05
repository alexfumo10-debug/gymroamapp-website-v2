/**
 * POST /api/admin/creator-grant — bulk-grant bonus Pro to a cohort of signups.
 *
 * Two ways to pick the cohort:
 *
 *  1. mode "code"   — everyone whose `acquisition.creatorCode` matches, e.g.
 *                     @chloe. Precise, but depends on users actually typing
 *                     the code (in practice most skip that optional field).
 *  2. mode "window" — everyone who signed up from a given SOURCE within a
 *                     date range, e.g. instagram between Aug 4 and Aug 11.
 *                     Less precise (sweeps in organic traffic from that
 *                     channel) but it works when nobody types a code, which
 *                     is the realistic case for an influencer post.
 *
 * Either way it extends each matched user's `proAccessUntil` by N days,
 * reusing the Pro comp field the iOS app (2.3+) already reads — so the perk
 * lights up with no app update.
 *
 * IDEMPOTENT: each granted user is stamped under `proCodeGrants[<key>]`
 * (key = the code, or a sanitized window id). Re-running the same grant
 * skips anyone already rewarded for it and only picks up NEW signups, so
 * it's safe to click repeatedly as a campaign grows.
 *
 * Extension is additive from whichever is later — now, or their existing
 * proAccessUntil — so a comped window is extended, never shortened.
 *
 * Admin-only (Firebase ID token → ADMIN_EMAILS).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminContext } from "@/lib/admin-gate";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_DAYS = 7;
const MAX_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Matches iOS normalizeCreatorCode (strip @, trim, lowercase) + strips accents. */
function normalizeCode(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/@/g, "")
    .trim()
    .toLowerCase();
}

/** Firestore-safe map key (letters, digits, underscore only). */
function safeKey(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
}

interface Body {
  mode?: "code" | "window";
  code?: string;
  source?: string; // window mode: an AcquisitionSource, or "any"
  from?: string; // window mode: yyyy-mm-dd (inclusive)
  to?: string; // window mode: yyyy-mm-dd (inclusive)
  days?: number;
  dryRun?: boolean;
}

/** Signup time for a user doc: createdAt, else the attribution timestamp. */
function signupMs(d: Record<string, unknown>): number | null {
  const created = d.createdAt as { toDate?: () => Date } | undefined;
  if (created && typeof created.toDate === "function") return created.toDate().getTime();
  const acq = d.acquisition as { at?: { toDate?: () => Date } } | undefined;
  if (acq?.at && typeof acq.at.toDate === "function") return acq.at.toDate().getTime();
  return null;
}

export async function POST(req: NextRequest) {
  const { denied, email: adminEmail } = await requireAdminContext(req);
  if (denied) return denied;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }

  const mode: "code" | "window" = body.mode === "window" ? "window" : "code";
  const daysRaw = Number(body.days);
  const days =
    Number.isFinite(daysRaw) && daysRaw > 0 ? Math.min(daysRaw, MAX_DAYS) : DEFAULT_DAYS;
  const dryRun = body.dryRun === true;

  // Resolve the cohort selector + the idempotency key.
  let grantKey = "";
  let label = "";
  let code = "";
  let source = "";
  let fromMs = 0;
  let toMs = 0;

  if (mode === "code") {
    code = normalizeCode(body.code || "");
    if (!code) {
      return NextResponse.json({ ok: false, error: "missing code" }, { status: 400 });
    }
    grantKey = safeKey(code);
    label = `@${code}`;
  } else {
    source = (body.source || "").trim().toLowerCase();
    const from = (body.from || "").trim();
    const to = (body.to || "").trim();
    if (!source || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return NextResponse.json(
        { ok: false, error: "window mode needs source + from/to as yyyy-mm-dd" },
        { status: 400 }
      );
    }
    fromMs = Date.parse(`${from}T00:00:00Z`);
    toMs = Date.parse(`${to}T00:00:00Z`) + DAY_MS - 1; // inclusive end-of-day
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs < fromMs) {
      return NextResponse.json({ ok: false, error: "invalid date range" }, { status: 400 });
    }
    grantKey = safeKey(`w_${source}_${from}_${to}`);
    label = `${source} signups ${from} → ${to}`;
  }

  try {
    const snap = await adminDb().collection("users").get();
    const now = Date.now();
    const matched: { uid: string; name: string; alreadyGranted: boolean }[] = [];

    snap.forEach((doc) => {
      const d = doc.data();
      const acq = d.acquisition as { creatorCode?: string; source?: string } | undefined;

      let isMatch = false;
      if (mode === "code") {
        const raw = acq?.creatorCode;
        isMatch = !!raw && normalizeCode(String(raw)) === code;
      } else {
        const src = (acq?.source || "").toString().trim().toLowerCase();
        const srcOk = source === "any" ? true : src === source;
        const ms = signupMs(d);
        isMatch = srcOk && ms != null && ms >= fromMs && ms <= toMs;
      }
      if (!isMatch) return;

      const grants = (d.proCodeGrants || {}) as Record<string, unknown>;
      matched.push({
        uid: doc.id,
        name: (d.displayName as string) || (d.username as string) || doc.id,
        alreadyGranted: Object.prototype.hasOwnProperty.call(grants, grantKey),
      });
    });

    const toGrant = matched.filter((m) => !m.alreadyGranted);

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        mode,
        label,
        days,
        matched: matched.length,
        wouldGrant: toGrant.length,
        alreadyGranted: matched.length - toGrant.length,
        users: toGrant.map((m) => m.name),
      });
    }

    const results: { uid: string; name: string; newUntil: string }[] = [];
    for (const m of toGrant) {
      const ref = adminDb().collection("users").doc(m.uid);
      const cur = await ref.get();
      const existing = cur.data()?.proAccessUntil as { toDate?: () => Date } | undefined;
      const base =
        existing && typeof existing.toDate === "function"
          ? Math.max(now, existing.toDate().getTime())
          : now;
      const until = new Date(base + days * DAY_MS);
      await ref.set(
        {
          proAccessUntil: Timestamp.fromDate(until),
          proGrantReason: `${label} (+${days}d)`,
          proGrantedBy: adminEmail,
          proGrantedAt: FieldValue.serverTimestamp(),
          [`proCodeGrants.${grantKey}`]: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      results.push({ uid: m.uid, name: m.name, newUntil: until.toISOString() });
    }

    return NextResponse.json({
      ok: true,
      mode,
      label,
      days,
      matched: matched.length,
      granted: results.length,
      skippedAlreadyGranted: matched.length - toGrant.length,
      users: results,
    });
  } catch (e) {
    console.error("[/api/admin/creator-grant]", e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
