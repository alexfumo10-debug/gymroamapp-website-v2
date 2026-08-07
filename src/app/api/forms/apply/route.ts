/**
 * POST /api/forms/apply — submission endpoint for the PUBLIC application
 * forms (affiliate / gym partner / trainer).
 *
 * WHY THIS EXISTS
 * These forms used to write to Firestore straight from the browser with the
 * client SDK, which broke in two ways:
 *   1. `affiliateApplications` has no security rule, so the catch-all
 *      deny-everything rule rejected every application. The live form failed
 *      for real applicants.
 *   2. All three forms wrote their notification emails to the `mail`
 *      collection, but the `/mail` rule requires `isAuthed()` — an anonymous
 *      visitor can never satisfy it, so no notification email ever sent.
 *
 * Doing it server-side fixes both without loosening any rule: the Admin SDK
 * bypasses Firestore rules, and email goes through Resend instead of the
 * Trigger Email collection.
 *
 * NOT AN OPEN RELAY: the caller sends structured FIELDS only. Recipients,
 * subjects and markup are decided here — the admin copy always goes to our
 * own role inbox, and the only caller-influenced address is the applicant's
 * own email, which is also the reply-to. A caller cannot make us mail an
 * arbitrary third party with arbitrary content.
 */

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { brandedEmail, detailRows } from "@/lib/email-templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SALES = "sales@gymroamapp.com";
const SUPPORT = "support@gymroamapp.com";
const MAX_FIELD_LEN = 2000;

/* Per-instance rate limit — a public write endpoint needs a speed bump. */
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, { count: number; resetAt: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const e = hits.get(ip);
  if (!e || now > e.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  e.count += 1;
  if (hits.size > 5000) for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k);
  return e.count > RATE_LIMIT;
}

type Kind = "affiliate" | "gym" | "trainer";

/** Escape untrusted text before it goes into email HTML. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const KINDS: Record<
  Kind,
  {
    collection: string;
    label: string;
    applicantSubject: string;
    nextSteps: string;
    /** Extra paragraph on the applicant confirmation, if any. */
    applicantNote?: string;
  }
> = {
  affiliate: {
    collection: "affiliateApplications",
    label: "Affiliate",
    applicantSubject: "Your GymRoam affiliate application is in review",
    nextSteps:
      "We review every application by hand, usually within a few days. If you're approved we'll confirm your code, send your agreement to sign, and get you your tracking link, dashboard login, and free GymRoam Pro.",
    // Kept from the original form: creators who sign up with Apple's Hide My
    // Email give us a relay address we can't match to an account, which
    // blocks us switching on their free Pro.
    applicantNote:
      "One thing that matters: when you create your GymRoam account, please use a real email address rather than Apple's Hide My Email. A relay address means we can't find your account to switch on your free Pro.",
  },
  gym: {
    collection: "gymPartnerApplications",
    label: "Gym Partner",
    applicantSubject: "Your GymRoam partner application is in review",
    nextSteps:
      "We'll review your gym and get back to you, usually within a few days, with next steps for getting listed.",
  },
  trainer: {
    collection: "trainerApplications",
    label: "Trainer",
    applicantSubject: "Your GymRoam trainer application is in review",
    nextSteps:
      "We'll review your profile and follow up, usually within a few days, with next steps.",
  },
};

interface Body {
  kind?: string;
  /** Ordered [label, value] pairs — shown in the notification email. */
  fields?: [string, string][];
  /** Written to Firestore as the application document. */
  doc?: Record<string, unknown>;
  /** The applicant's email: gets the confirmation + is the reply-to. */
  email?: string;
  /** Applicant's display name, for the greeting. */
  name?: string;
}

function clean(v: unknown): string {
  return String(v ?? "").slice(0, MAX_FIELD_LEN);
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { ok: false, error: "Too many submissions. Please try again in a minute." },
      { status: 429 }
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }

  const kind = body.kind as Kind;
  const spec = KINDS[kind];
  if (!spec) {
    return NextResponse.json({ ok: false, error: "unknown form kind" }, { status: 400 });
  }

  const email = clean(body.email).trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "a valid email is required" }, { status: 400 });
  }
  const name = clean(body.name).trim();
  const fields: [string, string][] = Array.isArray(body.fields)
    ? body.fields
        .filter((f) => Array.isArray(f) && f.length === 2)
        .slice(0, 40)
        .map(([k, v]) => [clean(k), clean(v)] as [string, string])
    : [];

  /* ── 1. Persist the application (Admin SDK → bypasses Firestore rules) ── */
  let appId = "";
  try {
    const doc =
      body.doc && typeof body.doc === "object" ? (body.doc as Record<string, unknown>) : {};
    const ref = await adminDb()
      .collection(spec.collection)
      .add({
        ...doc,
        email,
        status: "pending",
        createdAt: FieldValue.serverTimestamp(),
      });
    appId = ref.id;
  } catch (e) {
    console.error("[/api/forms/apply] firestore write failed", e);
    return NextResponse.json(
      { ok: false, error: "Could not save your application. Please try again." },
      { status: 500 }
    );
  }

  /* ── 2. Notify us + confirm to the applicant (Resend) ── */
  // Email failures must NOT fail the submission: the application is already
  // saved and visible in the admin panel, so a mail outage would otherwise
  // show the applicant an error for work that actually succeeded.
  let emailed = false;
  const from = process.env.EMAIL_FROM;
  const key = process.env.RESEND_API_KEY;
  if (key && from) {
    try {
      const resend = new Resend(key);
      const heading = `New ${spec.label} Application`;

      await resend.emails.send({
        from,
        to: SALES,
        replyTo: email,
        subject: `${heading}${name ? `: ${name}` : ""}`,
        html: brandedEmail(
          `<p style="margin:0 0 18px;font-size:17px;"><strong>${esc(heading)}</strong></p>
           ${detailRows(fields)}
           <p style="margin:18px 0 0;font-size:12px;">Reply to this email to reach them directly.</p>`
        ),
        text: `${heading}\n\n${fields.map(([k, v]) => `${k}: ${v}`).join("\n")}\n`,
      });

      await resend.emails.send({
        from,
        to: email,
        replyTo: SUPPORT,
        subject: spec.applicantSubject,
        html: brandedEmail(
          `<p style="margin:0 0 16px;">Hi ${esc(name) || "there"},</p>
           <p style="margin:0 0 16px;">Thanks for applying. Your ${spec.label.toLowerCase()} application is in review.</p>
           <p style="margin:0 0 16px;">${spec.nextSteps}</p>
           ${spec.applicantNote ? `<p style="margin:0 0 16px;">${spec.applicantNote}</p>` : ""}
           <p style="margin:0;">Questions in the meantime? Just reply to this email.</p>`
        ),
        text: `Hi ${name || "there"},\n\nThanks for applying. Your ${spec.label.toLowerCase()} application is in review.\n\n${spec.nextSteps}\n${spec.applicantNote ? `\n${spec.applicantNote}\n` : ""}\nQuestions in the meantime? Just reply to this email.\n\nThe GymRoam team`,
      });
      emailed = true;
    } catch (e) {
      console.error("[/api/forms/apply] email send failed", e);
    }
  }

  return NextResponse.json({ ok: true, id: appId, emailed });
}
