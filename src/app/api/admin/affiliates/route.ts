/**
 * POST /api/admin/affiliates — approve / reject a creator application,
 * and issue or change the referral code.
 *
 * Admin-gated. Lives on the server (rather than a client-side Firestore
 * write like the older admin flows) for one reason: issuing a code has
 * to be ATOMIC. `affiliateCodes/{NORMALIZED_CODE}` is the uniqueness
 * lock — the transaction below creates that doc and flips the
 * application in one commit, so two admins approving two creators who
 * requested the same code at the same moment cannot both succeed.
 *
 * Actions:
 *   approve  { applicationId, code? }   code defaults to requestedCode
 *   reject   { applicationId, reviewNote? }
 *   recode   { applicationId, code }    change an already-issued code
 *
 * On approve we send the welcome email (code, tracking link, the
 * Sign-in-with-Apple warning). Sending the agreement for signature and
 * switching on the affiliate's own free Pro are still manual — see the
 * note at the bottom of this file.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/admin-gate";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import {
  normalizeCode,
  validateCodeFormat,
  CODE_REJECTION_MESSAGES,
  trackingLink,
  APPLE_SIGNIN_WARNING,
  AFFILIATE_DISCOUNT_USD,
  COMMISSION_TIERS,
  CLEARING_DAYS,
  MIN_PAYOUT_USD,
  SITE_ORIGIN,
} from "@/lib/affiliate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Action = "approve" | "reject" | "recode";

interface Body {
  applicationId?: string;
  action?: Action;
  code?: string;
  reviewNote?: string;
}

/**
 * Ensure the affiliate has a login for /creator, and return a link that
 * lets them set their own password.
 *
 * We create the Firebase Auth account rather than making them sign up,
 * so the identity is bound to the email WE approved — an affiliate
 * can't self-register a different address and claim someone's code.
 *
 * The custom claim is what /api/affiliate/me trusts. NOTE FOR BACKEND:
 * these accounts share the Firebase Auth pool with app users, so
 * anything that reconciles Auth against the /users collection will see
 * them as orphans unless it skips `role === "affiliate"`.
 *
 * Returns null when link generation fails — the caller still reports a
 * successful approval, since the code is already issued by then.
 */
async function ensureAffiliateLogin(
  email: string,
  displayName: string,
  code: string
): Promise<string | null> {
  const auth = adminAuth();
  const normalized = email.toLowerCase();

  let uid: string;
  try {
    const existing = await auth.getUserByEmail(normalized);
    uid = existing.uid;
  } catch {
    // No account yet. Create one with an unguessable throwaway password;
    // they never use it, because they set their own via the link below.
    const created = await auth.createUser({
      email: normalized,
      emailVerified: false,
      displayName,
      password: `${crypto.randomUUID()}${crypto.randomUUID()}`,
    });
    uid = created.uid;
  }

  await auth.setCustomUserClaims(uid, { role: "affiliate", affiliateCode: code });

  try {
    return await auth.generatePasswordResetLink(normalized, {
      url: `${SITE_ORIGIN}/creator`,
    });
  } catch (e) {
    console.error("[/api/admin/affiliates] password link failed", e);
    return null;
  }
}

/** Email of the signed-in admin, for the audit trail on the doc. */
async function adminEmail(req: NextRequest): Promise<string> {
  const token = (req.headers.get("authorization") || "").slice("Bearer ".length);
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    return (decoded.email || "").toLowerCase();
  } catch {
    return "unknown";
  }
}

function welcomeEmail(params: {
  fullName: string;
  code: string;
  link: string;
  passwordLink: string | null;
}) {
  const { fullName, code, link, passwordLink } = params;
  const tierLines = COMMISSION_TIERS.map(
    (t) =>
      `<li>${
        t.maxSignups === null
          ? `${t.minSignups}+ Pro signups`
          : `${t.minSignups}–${t.maxSignups} Pro signups`
      } — <strong style="color:#E8FF3C;">${t.label}</strong></li>`
  ).join("");

  return {
    subject: `You're in — your GymRoam code is ${code}`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;background:#111114;color:#E8E8EE;padding:32px;border-radius:16px;border:1px solid #1F1F26;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="display:inline-block;width:40px;height:40px;background:#E8FF3C;border-radius:10px;line-height:40px;font-weight:900;font-size:20px;color:#0A0A0B;">G</div>
        </div>
        <h2 style="text-align:center;margin:0 0 8px;font-size:22px;">Welcome to the GymRoam Creator Program</h2>
        <p style="text-align:center;color:#8A8A99;margin:0 0 24px;font-size:14px;">Approved — here's everything you need, ${fullName}.</p>

        <div style="background:#18181D;border-radius:12px;padding:20px;margin-bottom:16px;text-align:center;">
          <p style="margin:0 0 6px;color:#8A8A99;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Your referral code</p>
          <p style="margin:0 0 16px;font-weight:900;font-size:28px;color:#E8FF3C;letter-spacing:2px;">${code}</p>
          <p style="margin:0 0 6px;color:#8A8A99;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Your tracking link</p>
          <p style="margin:0;font-size:14px;"><a href="${link}" style="color:#E8FF3C;">${link}</a></p>
        </div>

        <p style="color:#8A8A99;font-size:13px;line-height:1.7;margin:0 0 24px;">
          Anyone who enters <strong style="color:#E8E8EE;">${code}</strong> gets
          <strong style="color:#E8E8EE;">$${AFFILIATE_DISCOUNT_USD} off</strong> annual Pro —
          at signup or when they upgrade later.
        </p>

        <h3 style="font-size:13px;color:#8A8A99;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">Your commission</h3>
        <ul style="color:#8A8A99;font-size:14px;line-height:1.7;padding-left:20px;margin:0 0 8px;">${tierLines}</ul>
        <p style="color:#55555F;font-size:12px;line-height:1.7;margin:0 0 24px;">
          Paid on net revenue (after Apple's cut, refunds, and taxes), recurring
          on renewals for as long as your referral stays subscribed. Commission
          clears once a subscription has been active ${CLEARING_DAYS} consecutive days.
          Payouts run monthly, $${MIN_PAYOUT_USD} minimum — balances under that roll forward.
        </p>

        <div style="background:#1A1206;border:1px solid #FF8C42;border-radius:12px;padding:16px;margin-bottom:24px;">
          <p style="margin:0 0 6px;color:#FF8C42;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Read this before you sign up</p>
          <p style="margin:0;color:#E8E8EE;font-size:13px;line-height:1.6;">${APPLE_SIGNIN_WARNING}</p>
        </div>

        ${
          passwordLink
            ? `<div style="background:#18181D;border-radius:12px;padding:20px;margin-bottom:24px;text-align:center;">
                 <p style="margin:0 0 6px;color:#8A8A99;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Your creator dashboard</p>
                 <p style="margin:0 0 14px;color:#8A8A99;font-size:13px;line-height:1.6;">Track your clicks, conversions, tier progress, and commission in real time.</p>
                 <a href="${passwordLink}" style="display:inline-block;background:#E8FF3C;color:#0A0A0B;font-weight:800;font-size:14px;text-decoration:none;padding:12px 24px;border-radius:8px;">Set your password</a>
                 <p style="margin:14px 0 0;color:#55555F;font-size:11px;">Then sign in any time at ${SITE_ORIGIN}/creator</p>
               </div>`
            : `<p style="color:#8A8A99;font-size:13px;line-height:1.7;margin:0 0 24px;">We'll follow up separately with your creator dashboard login.</p>`
        }

        <h3 style="font-size:13px;color:#8A8A99;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">Next steps</h3>
        <ol style="color:#8A8A99;font-size:14px;line-height:1.7;padding-left:20px;margin:0 0 24px;">
          <li>We'll send your affiliate agreement to sign — reply once it's done</li>
          <li>Download GymRoam and sign up <strong style="color:#E8E8EE;">with your email</strong></li>
          <li>Tell us the email you used and we'll switch on your free Pro</li>
          <li>Start sharing — your link and code work immediately</li>
        </ol>

        <p style="color:#55555F;font-size:12px;text-align:center;margin:0;">Questions? Just reply to this email.</p>
      </div>
    `,
  };
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { applicationId, action } = body;
  if (!applicationId || !action) {
    return NextResponse.json(
      { error: "applicationId and action are required" },
      { status: 400 }
    );
  }

  const db = adminDb();
  const appRef = db.collection("affiliateApplications").doc(applicationId);
  const reviewer = await adminEmail(req);

  /* ── Reject ── */
  if (action === "reject") {
    const snap = await appRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "application not found" }, { status: 404 });
    }
    await appRef.update({
      status: "rejected",
      reviewNote: (body.reviewNote || "").trim(),
      approvedBy: reviewer,
      approvedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  /* ── Approve / recode — both issue a code ── */
  if (action !== "approve" && action !== "recode") {
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }

  const snap = await appRef.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "application not found" }, { status: 404 });
  }
  const application = snap.data() as {
    fullName?: string;
    email?: string;
    requestedCode?: string;
    issuedCode?: string | null;
  };

  // Default to what they asked for; an admin can override.
  const code = normalizeCode(body.code || application.requestedCode || "");
  const rejection = validateCodeFormat(code);
  if (rejection) {
    return NextResponse.json(
      { error: CODE_REJECTION_MESSAGES[rejection], reason: rejection },
      { status: 400 }
    );
  }

  const previousCode = normalizeCode(application.issuedCode || "");
  const codeRef = db.collection("affiliateCodes").doc(code);

  try {
    await db.runTransaction(async (tx) => {
      // ── ALL READS FIRST ──
      // Firestore transactions forbid a read after a write, so both the
      // new-code check and the old-code lookup have to happen up front.
      const existing = await tx.get(codeRef);
      const previousRef =
        previousCode && previousCode !== code
          ? db.collection("affiliateCodes").doc(previousCode)
          : null;
      const previousSnap = previousRef ? await tx.get(previousRef) : null;

      if (existing.exists) {
        const owner = existing.data()?.applicationId;
        // Re-approving the same application with the same code is a no-op,
        // not a conflict.
        if (owner !== applicationId) {
          throw new Error(`CODE_TAKEN:${code}`);
        }
      }

      // ── WRITES ──
      tx.set(codeRef, {
        code,
        applicationId,
        affiliateEmail: (application.email || "").toLowerCase(),
        affiliateName: application.fullName || "",
        active: true,
        issuedBy: reviewer,
        issuedAt: FieldValue.serverTimestamp(),
      });

      // Retire the old code rather than deleting it: links and story
      // slides already carry it, and we still need it to resolve
      // historical attribution.
      if (previousRef && previousSnap?.exists) {
        tx.update(previousRef, {
          active: false,
          retiredAt: FieldValue.serverTimestamp(),
          replacedBy: code,
        });
      }

      tx.update(appRef, {
        status: "approved",
        issuedCode: code,
        approvedBy: reviewer,
        approvedAt: FieldValue.serverTimestamp(),
      });
    });
  } catch (e) {
    const msg = (e as Error).message || "";
    if (msg.startsWith("CODE_TAKEN:")) {
      return NextResponse.json(
        { error: `${code} is already issued to another affiliate`, reason: "taken" },
        { status: 409 }
      );
    }
    console.error("[/api/admin/affiliates] transaction failed", e);
    return NextResponse.json({ error: "Could not issue code" }, { status: 500 });
  }

  const link = trackingLink(code);
  const isFirstApproval = action === "approve" && !previousCode;

  // Provision the dashboard login. Failure here is logged and surfaced
  // but never rolls back the code — the approval already happened, and
  // a login can be re-sent by approving again.
  let passwordLink: string | null = null;
  if (application.email) {
    try {
      passwordLink = await ensureAffiliateLogin(
        application.email,
        application.fullName || "",
        code
      );
    } catch (e) {
      console.error("[/api/admin/affiliates] login provisioning failed", e);
    }
  }

  // Welcome email — only on first approval. A recode gets a shorter
  // heads-up instead of the full onboarding again.
  if (application.email) {
    try {
      const message =
        isFirstApproval
          ? welcomeEmail({
              fullName: application.fullName || "there",
              code,
              link,
              passwordLink,
            })
          : {
              subject: `Your GymRoam referral code is now ${code}`,
              html: `
                <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;background:#111114;color:#E8E8EE;padding:32px;border-radius:16px;border:1px solid #1F1F26;">
                  <h2 style="margin:0 0 12px;font-size:20px;">Your code changed</h2>
                  <p style="color:#8A8A99;font-size:14px;line-height:1.7;margin:0 0 20px;">
                    Heads up — your GymRoam referral code is now
                    <strong style="color:#E8FF3C;">${code}</strong>, and your
                    tracking link is <a href="${link}" style="color:#E8FF3C;">${link}</a>.
                    ${previousCode ? `Your old code <strong>${previousCode}</strong> no longer accepts new signups, but everything you've already earned on it is unaffected.` : ""}
                  </p>
                  <p style="color:#55555F;font-size:12px;margin:0;">Update your bio link and any pinned posts when you get a chance.</p>
                </div>
              `,
            };

      await db.collection("mail").add({
        to: [application.email.toLowerCase()],
        message,
      });
    } catch (e) {
      // The code IS issued at this point — an email failure must not
      // read as a failed approval. Surface it instead.
      console.error("[/api/admin/affiliates] welcome email failed", e);
      return NextResponse.json({
        ok: true,
        status: "approved",
        code,
        link,
        warning: "Code issued, but the welcome email failed to queue.",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    status: "approved",
    code,
    link,
    ...(isFirstApproval && !passwordLink
      ? {
          warning:
            "Code issued and welcome email sent, but the dashboard login couldn't be provisioned. Approve again to retry.",
        }
      : {}),
  });
}

/*
 * STILL MANUAL after approval — deliberately, for now:
 *
 *   - Sending the affiliate agreement for signature. Needs a DocuSign
 *     (or similar) integration; the welcome email tells them to expect it.
 *   - Switching on the affiliate's own free Pro. Can't be automated
 *     until they've created an app account, since there's no user
 *     record to flag yet. The welcome email asks them to send us the
 *     email they signed up with — which is exactly why the
 *     Sign-in-with-Apple warning matters.
 */
