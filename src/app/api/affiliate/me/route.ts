/**
 * GET /api/affiliate/me — the signed-in creator's own dashboard data.
 *
 * SECURITY: every read here runs server-side with the Admin SDK and is
 * scoped to the code resolved from the caller's VERIFIED ID token. The
 * client never queries Firestore for affiliate data directly, so a
 * creator cannot widen the query, and this holds regardless of what the
 * Firestore security rules happen to say. The token is the only input
 * that decides whose data comes back — `code` is never read from the
 * request.
 *
 * Resolution order for "which affiliate is this?":
 *   1. the `affiliateCode` custom claim set at approval (fast path)
 *   2. an approved application matching the token's email (fallback,
 *      covers accounts approved before claims existed, or a claim that
 *      failed to write)
 */

import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { normalizeCode } from "@/lib/affiliate";
import { loadRawData, computeStats } from "@/lib/affiliate-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "missing bearer token" }, { status: 401 });
  }

  let email = "";
  let claimCode = "";
  try {
    const decoded = await adminAuth().verifyIdToken(authHeader.slice(7));
    email = (decoded.email || "").toLowerCase();
    claimCode = normalizeCode((decoded.affiliateCode as string) || "");
  } catch {
    return NextResponse.json({ error: "invalid token" }, { status: 401 });
  }

  const db = adminDb();

  try {
    /* ── Resolve the caller to exactly one approved application ── */
    let appDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;

    if (email) {
      const byEmail = await db
        .collection("affiliateApplications")
        .where("email", "==", email)
        .where("status", "==", "approved")
        .limit(1)
        .get();
      if (!byEmail.empty) appDoc = byEmail.docs[0];
    }

    if (!appDoc) {
      // A valid Firebase account that isn't an approved affiliate —
      // e.g. an app user who found the page. Not an error, just empty.
      return NextResponse.json(
        { error: "not an approved affiliate" },
        { status: 403 }
      );
    }

    const application = appDoc.data() as {
      fullName?: string;
      email?: string;
      issuedCode?: string;
      paymentMethod?: string;
      approvedAt?: FirebaseFirestore.Timestamp;
    };

    const code = normalizeCode(application.issuedCode || claimCode);
    if (!code) {
      return NextResponse.json(
        { error: "no code issued yet" },
        { status: 409 }
      );
    }

    /* ── Payouts already made to this affiliate ── */
    const payoutsSnap = await db
      .collection("affiliatePayouts")
      .where("code", "==", code)
      .get();
    let paidUsd = 0;
    const payments: { amountUsd: number; paidAt: number | null; method: string; reference: string }[] = [];
    payoutsSnap.forEach((d) => {
      const p = d.data() as {
        amountUsd?: number;
        paidAt?: FirebaseFirestore.Timestamp;
        method?: string;
        reference?: string;
      };
      const amount = p.amountUsd || 0;
      paidUsd += amount;
      payments.push({
        amountUsd: amount,
        paidAt: p.paidAt?.toMillis() ?? null,
        method: p.method || "",
        reference: p.reference || "",
      });
    });
    payments.sort((a, b) => (b.paidAt || 0) - (a.paidAt || 0));

    /* ── Funnel + commission ── */
    const raw = await loadRawData(db, [code]);
    const stats = computeStats({
      code,
      clicks: raw.clicks[code] || 0,
      referrals: raw.referrals[code] || [],
      transactions: raw.transactions[code] || [],
      paidUsd,
      readiness: raw.readiness,
    });

    return NextResponse.json({
      profile: {
        fullName: application.fullName || "",
        email: application.email || email,
        paymentMethod: application.paymentMethod || "",
        approvedAt: application.approvedAt?.toMillis() ?? null,
      },
      ...stats,
      payments,
    });
  } catch (e) {
    console.error("[/api/affiliate/me]", e);
    return NextResponse.json(
      { error: "Couldn't load your dashboard right now" },
      { status: 502 }
    );
  }
}
