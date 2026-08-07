/**
 * GET /api/admin/affiliate-stats — every affiliate's funnel and
 * commission, plus program-wide totals.
 *
 * Admin-gated. Uses the same computeStats() as the creator dashboard,
 * so what an admin sees and what a creator sees can never disagree.
 *
 * The response carries `readiness` so the UI can distinguish "this
 * affiliate genuinely has zero conversions" from "the iOS side hasn't
 * started reporting conversions yet" — a distinction that matters a
 * lot when you're deciding whether to pay someone.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-gate";
import { adminDb } from "@/lib/firebase-admin";
import { normalizeCode } from "@/lib/affiliate";
import { loadRawData, computeStats, type AffiliateStats } from "@/lib/affiliate-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface AdminAffiliateRow extends AffiliateStats {
  applicationId: string;
  fullName: string;
  email: string;
  paymentMethod: string;
  instagramHandle: string;
  tiktokHandle: string;
  approvedAt: number | null;
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const db = adminDb();

    const approvedSnap = await db
      .collection("affiliateApplications")
      .where("status", "==", "approved")
      .get();

    if (approvedSnap.empty) {
      return NextResponse.json({
        affiliates: [],
        totals: null,
        readiness: { clicks: "live", referrals: "pending", transactions: "pending" },
      });
    }

    /** Only the application fields this route surfaces. */
    interface ApprovedApp {
      id: string;
      issuedCode?: string;
      fullName?: string;
      email?: string;
      paymentMethod?: string;
      instagramHandle?: string;
      tiktokHandle?: string;
      approvedAt?: FirebaseFirestore.Timestamp;
    }

    const apps: ApprovedApp[] = approvedSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<ApprovedApp, "id">) }))
      .filter((a) => normalizeCode(a.issuedCode || "") !== "");

    const codes = apps.map((a) => normalizeCode(a.issuedCode || ""));

    // Payouts, bucketed by code, so `paidUsd` is per-affiliate.
    const payoutsSnap = await db.collection("affiliatePayouts").get();
    const paidByCode: Record<string, number> = {};
    payoutsSnap.forEach((d) => {
      const p = d.data() as { code?: string; amountUsd?: number };
      const c = normalizeCode(p.code || "");
      if (!c) return;
      paidByCode[c] = (paidByCode[c] || 0) + (p.amountUsd || 0);
    });

    const raw = await loadRawData(db, codes);

    const affiliates: AdminAffiliateRow[] = apps.map((a) => {
      const code = normalizeCode(a.issuedCode || "");
      const stats = computeStats({
        code,
        clicks: raw.clicks[code] || 0,
        referrals: raw.referrals[code] || [],
        transactions: raw.transactions[code] || [],
        paidUsd: paidByCode[code] || 0,
        readiness: raw.readiness,
      });
      return {
        ...stats,
        applicationId: a.id,
        fullName: a.fullName || "",
        email: a.email || "",
        paymentMethod: a.paymentMethod || "",
        instagramHandle: a.instagramHandle || "",
        tiktokHandle: a.tiktokHandle || "",
        approvedAt: a.approvedAt?.toMillis() ?? null,
      };
    });

    // Sort by what an admin actually triages on: money owed, then volume.
    affiliates.sort(
      (x, y) =>
        y.commission.payableUsd - x.commission.payableUsd ||
        y.funnel.proConversions - x.funnel.proConversions
    );

    const totals = affiliates.reduce(
      (acc, a) => ({
        affiliates: acc.affiliates + 1,
        clicks: acc.clicks + a.funnel.clicks,
        installs: acc.installs + a.funnel.installs,
        signups: acc.signups + a.funnel.signups,
        proConversions: acc.proConversions + a.funnel.proConversions,
        accruedUsd: acc.accruedUsd + a.commission.accruedUsd,
        clearedUsd: acc.clearedUsd + a.commission.clearedUsd,
        paidUsd: acc.paidUsd + a.commission.paidUsd,
        payableUsd: acc.payableUsd + a.commission.payableUsd,
      }),
      {
        affiliates: 0,
        clicks: 0,
        installs: 0,
        signups: 0,
        proConversions: 0,
        accruedUsd: 0,
        clearedUsd: 0,
        paidUsd: 0,
        payableUsd: 0,
      }
    );

    return NextResponse.json({
      affiliates,
      totals,
      readiness: raw.readiness,
    });
  } catch (e) {
    console.error("[/api/admin/affiliate-stats]", e);
    return NextResponse.json(
      { error: (e as Error).message, affiliates: [], totals: null },
      { status: 502 }
    );
  }
}
