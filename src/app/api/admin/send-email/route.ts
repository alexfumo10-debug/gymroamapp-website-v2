/**
 * POST /api/admin/send-email — send a TRANSACTIONAL 1:1 email to a user.
 *
 * Renders a code-defined template (src/lib/email-templates.ts) and sends it
 * via Resend to a single recipient, resolved from a Firebase Auth uid (so we
 * use the canonical Auth email, not a stale user-doc value). Every send is
 * logged to Firestore `adminEmailLog` for an audit trail.
 *
 * Transactional only — no bulk, no marketing. That keeps us clear of the
 * unsubscribe/consent requirements (CAN-SPAM) a promotional path would need.
 *
 * Admin-only (Firebase ID token → ADMIN_EMAILS). Dormant (503) until
 * RESEND_API_KEY + EMAIL_FROM are set in the environment.
 *
 * Body: { uid?: string, to?: string, templateId: string,
 *         subject?: string, body?: string }   // subject/body: "custom" only
 */

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { requireAdminContext } from "@/lib/admin-gate";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { getTemplate, type EmailVars } from "@/lib/email-templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUPPORT_REPLY_TO = "support@gymroamapp.com";

function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}

interface Body {
  uid?: string;
  to?: string;
  templateId?: string;
  subject?: string;
  body?: string;
}

export async function POST(req: NextRequest) {
  const { denied, email: adminEmail } = await requireAdminContext(req);
  if (denied) return denied;

  if (!emailConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Email not configured — set RESEND_API_KEY and EMAIL_FROM." },
      { status: 503 }
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }

  const templateId = (body.templateId || "").trim();
  const template = getTemplate(templateId);
  if (!template) {
    return NextResponse.json({ ok: false, error: "unknown templateId" }, { status: 400 });
  }

  // Resolve the recipient. Prefer the canonical Auth email for a uid; fall
  // back to an explicit `to`. Never trust a user-doc email over Auth.
  const uid = (body.uid || "").trim();
  let to = (body.to || "").trim().toLowerCase();
  const vars: EmailVars = {};

  if (uid) {
    try {
      const authUser = await adminAuth().getUser(uid);
      if (authUser.email) to = authUser.email.toLowerCase();
      vars.displayName = authUser.displayName || undefined;
    } catch {
      // No Auth account for this uid (orphan doc) — fall through to `to`.
    }
    // Enrich from the user doc: first name + Pro-until for the pro-granted template.
    try {
      const snap = await adminDb().collection("users").doc(uid).get();
      const data = snap.data() || {};
      const dn = (data.displayName as string) || vars.displayName || "";
      vars.displayName = dn || undefined;
      vars.firstName = dn ? dn.split(" ")[0] : undefined;
      const until = data.proAccessUntil;
      if (until && typeof until.toDate === "function") {
        vars.proUntil = until.toDate().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      }
    } catch {
      /* non-fatal — template still renders with what we have */
    }
  }

  if (!to || !EMAIL_RE.test(to)) {
    return NextResponse.json(
      { ok: false, error: "no valid recipient email for this user" },
      { status: 400 }
    );
  }

  // Custom template carries admin-authored subject/body.
  if (template.editable) {
    vars.subject = (body.subject || "").toString();
    vars.body = (body.body || "").toString();
    if (!vars.body.trim()) {
      return NextResponse.json({ ok: false, error: "message body is empty" }, { status: 400 });
    }
  }

  const rendered = template.render(vars);
  const isPrivateRelay = to.endsWith("@privaterelay.appleid.com");

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM as string,
      to,
      replyTo: SUPPORT_REPLY_TO,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });

    if (error) {
      console.error("[/api/admin/send-email] resend error", error);
      await logSend({ to, uid, templateId, subject: rendered.subject, adminEmail, status: "error", detail: error.message });
      return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
    }

    await logSend({ to, uid, templateId, subject: rendered.subject, adminEmail, status: "sent", resendId: data?.id });
    return NextResponse.json({
      ok: true,
      to,
      subject: rendered.subject,
      id: data?.id ?? null,
      privateRelay: isPrivateRelay,
    });
  } catch (e) {
    console.error("[/api/admin/send-email]", e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

async function logSend(entry: {
  to: string;
  uid: string;
  templateId: string;
  subject: string;
  adminEmail: string | null;
  status: "sent" | "error";
  resendId?: string;
  detail?: string;
}) {
  try {
    const { FieldValue } = await import("firebase-admin/firestore");
    await adminDb().collection("adminEmailLog").add({
      to: entry.to,
      uid: entry.uid || null,
      templateId: entry.templateId,
      subject: entry.subject,
      sentBy: entry.adminEmail,
      status: entry.status,
      resendId: entry.resendId || null,
      detail: entry.detail || null,
      sentAt: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    // Logging must never block the send result.
    console.error("[/api/admin/send-email] log write failed", e);
  }
}
