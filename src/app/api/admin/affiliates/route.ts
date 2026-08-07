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
import { Resend } from "resend";
import {
  normalizeCode,
  validateCodeFormat,
  CODE_REJECTION_MESSAGES,
  trackingLink,
  SITE_ORIGIN,
} from "@/lib/affiliate";
import {
  affiliateApprovedEmail,
  affiliateDeclinedEmail,
  affiliateCodeChangedEmail,
  AFFILIATE_REPLY_TO,
  type AffiliateEmail,
} from "@/lib/affiliate-emails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Action = "approve" | "reject" | "recode" | "delete";

/**
 * Send a creator-program email through Resend.
 *
 * Was the Firestore `mail` collection (Trigger Email extension), which
 * sends from the Firebase default sender and lands in spam. Throws when
 * unconfigured so callers can surface it — approval/decision state is
 * always written before we get here, so a throw never loses the decision.
 */
async function sendAffiliateEmail(to: string, mail: AffiliateEmail): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) throw new Error("email not configured (RESEND_API_KEY / EMAIL_FROM)");
  const { error } = await new Resend(key).emails.send({
    from,
    to: to.toLowerCase(),
    replyTo: AFFILIATE_REPLY_TO,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });
  if (error) throw new Error(error.message);
}

interface Body {
  applicationId?: string;
  action?: Action;
  code?: string;
  reviewNote?: string;
  /** Decline only: set false to skip the "not this time" email. */
  notify?: boolean;
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


/**
 * GET /api/admin/affiliates — list applications for the admin tab.
 *
 * The tab used to read `affiliateApplications` straight from the browser
 * with the client SDK, which fails ("Missing or insufficient permissions")
 * because the collection has no read rule — and it shouldn't have one: these
 * documents hold applicant PII (name, email, phone, payment preference), so
 * they must never be client-readable. Serving them here through the Admin
 * SDK keeps the collection sealed and the data admin-only.
 */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const snap = await adminDb()
      .collection("affiliateApplications")
      .orderBy("createdAt", "desc")
      .limit(500)
      .get();

    const applications = snap.docs.map((d) => {
      const data = d.data();
      // Firestore Timestamps → epoch ms so the client can format them
      // without pulling in the Firestore SDK types.
      const ts = (v: unknown) =>
        v && typeof (v as { toDate?: () => Date }).toDate === "function"
          ? (v as { toDate: () => Date }).toDate().getTime()
          : null;
      return {
        ...data,
        id: d.id,
        createdAt: ts(data.createdAt),
        approvedAt: ts(data.approvedAt),
        rejectedAt: ts(data.rejectedAt),
      };
    });

    return NextResponse.json({ ok: true, applications });
  } catch (e) {
    console.error("[/api/admin/affiliates GET]", e);
    return NextResponse.json(
      { ok: false, error: (e as Error).message, applications: [] },
      { status: 500 }
    );
  }
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
    const rejected = snap.data() || {};
    await appRef.update({
      status: "rejected",
      reviewNote: (body.reviewNote || "").trim(),
      approvedBy: reviewer,
      approvedAt: FieldValue.serverTimestamp(),
    });

    // Previously no email was sent on a decline, so applicants were left
    // hanging indefinitely. Send one, but never let it fail the decision —
    // the status is already written.
    let emailed = false;
    if (rejected.email && body.notify !== false) {
      try {
        await sendAffiliateEmail(
          String(rejected.email),
          affiliateDeclinedEmail({ name: String(rejected.fullName || "") })
        );
        emailed = true;
      } catch (e) {
        console.error("[/api/admin/affiliates] decline email failed", e);
      }
    }
    return NextResponse.json({ ok: true, status: "rejected", emailed });
  }

  /* ── Delete ──
     Removes the application AND releases its code, so the creator (or
     anyone) can apply for that code again. Deleting the application alone
     would leave `affiliateCodes/{CODE}` behind as a permanent uniqueness
     lock on a code nobody owns.

     What this deliberately does NOT do is delete the Firebase Auth
     account. Affiliate logins share the Auth pool with app users, and the
     address may well belong to a real GymRoam user (or, in one case, an
     admin) — deleting it would take out an unrelated account. We strip the
     affiliate claims instead, which is what actually gates /creator. */
  if (action === "delete") {
    const snap = await appRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "application not found" }, { status: 404 });
    }
    const app = snap.data() as { email?: string; issuedCode?: string | null };
    const issued = normalizeCode(app.issuedCode || "");

    if (issued) {
      await db.collection("affiliateCodes").doc(issued).delete().catch((e) => {
        console.error("[/api/admin/affiliates] code release failed", e);
      });
    }

    if (app.email) {
      try {
        const auth = adminAuth();
        const user = await auth.getUserByEmail(app.email.toLowerCase());
        const claims = { ...(user.customClaims || {}) } as Record<string, unknown>;
        delete claims.role;
        delete claims.affiliateCode;
        await auth.setCustomUserClaims(user.uid, claims);
      } catch (e) {
        // No account, or claim clear failed — neither should block the delete.
        console.error("[/api/admin/affiliates] claim clear skipped", e);
      }
    }

    await appRef.delete();
    return NextResponse.json({ ok: true, status: "deleted", releasedCode: issued || null });
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
  // Only a genuine code CHANGE gets the "your code changed" note. Approving
  // an already-approved creator without changing their code (a re-approval,
  // or re-sending their details) previously took that path and produced
  // nonsense: "your code is now X ... your old code X no longer accepts
  // new signups". Everything that isn't a real change re-sends the full
  // welcome, which also re-issues the dashboard password link — that's how
  // a creator who lost the first email gets back in.
  const codeChanged = !!previousCode && previousCode !== code;

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

  // Welcome (or code-changed) email via Resend. Only on first approval does
  // the creator get the full onboarding; a recode gets a short heads-up.
  if (application.email) {
    try {
      const mail = !codeChanged
        ? affiliateApprovedEmail({
            name: application.fullName || "",
            email: application.email,
            code,
            trackingLink: link,
            dashboardLink: passwordLink,
            siteOrigin: SITE_ORIGIN,
          })
        : affiliateCodeChangedEmail({
            name: application.fullName || "",
            code,
            trackingLink: link,
            previousCode,
          });
      await sendAffiliateEmail(application.email, mail);
    } catch (e) {
      // The code IS issued at this point — an email failure must not read
      // as a failed approval. Surface it instead.
      console.error("[/api/admin/affiliates] approval email failed", e);
      return NextResponse.json({
        ok: true,
        status: "approved",
        code,
        link,
        warning: "Code issued, but the email failed to send.",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    status: "approved",
    code,
    link,
    ...(!codeChanged && !passwordLink
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
