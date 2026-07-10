/**
 * Code-defined, versioned transactional email templates.
 *
 * These are TRANSACTIONAL (account/relationship) messages sent 1:1 from the
 * admin panel — not marketing. Keep it that way: no bulk blasts, no
 * promotional content that would need an unsubscribe link + consent trail
 * (CAN-SPAM). If we ever add marketing, that's a separate path.
 *
 * Rendering is a pure string function (no DOM, no server-only imports), so
 * this file is safe to import from both the API route and a client
 * component (the panel only reads EMAIL_TEMPLATE_OPTIONS for its picker).
 */

export interface EmailVars {
  firstName?: string;
  displayName?: string;
  /** Formatted date string, e.g. "Aug 9, 2026" — for the Pro-granted note. */
  proUntil?: string;
  /** Admin-authored subject/body — only the "custom" template uses these. */
  subject?: string;
  body?: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface EmailTemplate {
  id: string;
  label: string;
  description: string;
  /** True when the admin authors the subject + body (a 1:1 note). */
  editable: boolean;
  render: (vars: EmailVars) => RenderedEmail;
}

const BRAND_YELLOW = "#E8FF3C";
const INK = "#0A0A0B";
const SUPPORT = "support@gymroamapp.com";
const APP_STORE = "https://apps.apple.com/app/id6773157406";

/** Escape untrusted text for safe HTML interpolation. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Plain-text body → simple, safe HTML paragraphs (preserves blank-line breaks). */
function paragraphs(body: string): string {
  return body
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;">${esc(p).replace(/\n/g, "<br/>")}</p>`)
    .join("\n");
}

function greeting(vars: EmailVars): string {
  return esc(vars.firstName || vars.displayName || "there");
}

/**
 * Shared email chrome — table-based, inline-styled, light background with a
 * dark brand header. Built for broad email-client compatibility (Gmail,
 * Apple Mail, Outlook). No remote images (deliverability + privacy).
 */
function layout(innerHtml: string): string {
  return `<!doctype html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
        <tr><td style="background:${INK};padding:20px 28px;">
          <span style="font-size:20px;font-weight:800;letter-spacing:-0.5px;color:#ffffff;">Gym<span style="color:${BRAND_YELLOW};">Roam</span></span>
        </td></tr>
        <tr><td style="padding:28px;color:#1a1a1f;font-size:15px;line-height:1.6;">
          ${innerHtml}
        </td></tr>
        <tr><td style="padding:18px 28px 26px;border-top:1px solid #eee;color:#8a8a92;font-size:12px;line-height:1.5;">
          GymRoam · Questions? Just reply, or email <a href="mailto:${SUPPORT}" style="color:#5a5a63;">${SUPPORT}</a>.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;"><tr><td style="background:${BRAND_YELLOW};border-radius:10px;">
    <a href="${esc(href)}" style="display:inline-block;padding:11px 22px;color:${INK};font-weight:700;font-size:14px;text-decoration:none;">${esc(label)}</a>
  </td></tr></table>`;
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "custom",
    label: "Custom message",
    description: "Write a one-off subject + message to this user (1:1).",
    editable: true,
    render: (v) => {
      const subject = (v.subject || "").trim() || "A note from GymRoam";
      const bodyText = (v.body || "").trim();
      const html = layout(
        `<p style="margin:0 0 16px;">Hi ${greeting(v)},</p>\n${paragraphs(
          bodyText || " "
        )}`
      );
      const text = `Hi ${v.firstName || v.displayName || "there"},\n\n${bodyText}\n\n— GymRoam`;
      return { subject, html, text };
    },
  },
  {
    id: "pro-granted",
    label: "Pro access is active",
    description: "Confirms a comped GymRoam Pro grant. Uses the user's Pro-until date.",
    editable: false,
    render: (v) => {
      const until = v.proUntil ? ` through <strong>${esc(v.proUntil)}</strong>` : "";
      const untilText = v.proUntil ? ` through ${v.proUntil}` : "";
      const html = layout(
        `<p style="margin:0 0 16px;">Hi ${greeting(v)},</p>
         <p style="margin:0 0 16px;">Good news — <strong>GymRoam Pro is now active on your account</strong>${until}. Everything's unlocked: unlimited trips, saved gyms, home gyms, and Scout's smartest workouts.</p>
         <p style="margin:0 0 8px;">Open the app to start roaming:</p>
         ${button(APP_STORE, "Open GymRoam")}
         <p style="margin:0;">Enjoy — and tell us what you think.</p>`
      );
      const text = `Hi ${v.firstName || v.displayName || "there"},\n\nGymRoam Pro is now active on your account${untilText}. Unlimited trips, saved gyms, home gyms, and Scout's smartest workouts are unlocked.\n\nOpen the app: ${APP_STORE}\n\n— GymRoam`;
      return { subject: "Your GymRoam Pro is active 🎉", html, text };
    },
  },
  {
    id: "welcome",
    label: "Welcome",
    description: "A friendly intro / re-onboarding nudge for a specific user.",
    editable: false,
    render: (v) => {
      const html = layout(
        `<p style="margin:0 0 16px;">Hi ${greeting(v)},</p>
         <p style="margin:0 0 16px;">Welcome to GymRoam — the passport for training wherever you travel. Find gyms, studios, and run clubs on the map, check in to stamp your passport, and ask Scout to plan a workout anywhere.</p>
         ${button(APP_STORE, "Open GymRoam")}
         <p style="margin:0;">If anything's confusing, just reply to this email — a founder reads it.</p>`
      );
      const text = `Hi ${v.firstName || v.displayName || "there"},\n\nWelcome to GymRoam — the passport for training wherever you travel. Find gyms, check in to stamp your passport, and ask Scout to plan a workout anywhere.\n\nOpen the app: ${APP_STORE}\n\nReply anytime — a founder reads it.\n\n— GymRoam`;
      return { subject: "Welcome to GymRoam", html, text };
    },
  },
  {
    id: "influencer-pro",
    label: "Influencer: Pro on us",
    description:
      "Personal founder note for a comped creator/influencer. Uses the Pro-until date when set.",
    editable: false,
    render: (v) => {
      const until = v.proUntil
        ? ` — active through <strong>${esc(v.proUntil)}</strong>`
        : "";
      const untilText = v.proUntil ? ` — active through ${v.proUntil}` : "";
      const html = layout(
        `<p style="margin:0 0 16px;">Hi ${greeting(v)},</p>
         <p style="margin:0 0 16px;">Alex here, one of the founders of GymRoam. We turned on <strong>GymRoam Pro</strong> for you, on us${until}. No card, no strings.</p>
         <p style="margin:0 0 16px;">Pro unlocks everything: unlimited trips, saved gyms, home gyms, and Scout's smartest workouts. Take it on your next trip and put it through its paces.</p>
         ${button(APP_STORE, "Open GymRoam")}
         <p style="margin:0;">One ask: be honest with us. If something's confusing or missing, reply to this email — it comes straight to a founder, and we ship fast.</p>`
      );
      const text = `Hi ${v.firstName || v.displayName || "there"},\n\nAlex here, one of the founders of GymRoam. We turned on GymRoam Pro for you, on us${untilText}. No card, no strings.\n\nPro unlocks everything: unlimited trips, saved gyms, home gyms, and Scout's smartest workouts. Take it on your next trip and put it through its paces.\n\nOpen the app: ${APP_STORE}\n\nOne ask: be honest with us. If something's confusing or missing, reply to this email — it comes straight to a founder, and we ship fast.\n\n— GymRoam`;
      return { subject: "GymRoam Pro is on us", html, text };
    },
  },
  {
    id: "pro-expiring",
    label: "Pro access ending soon",
    description:
      "Heads-up that a comped Pro window is ending. Uses the user's Pro-until date.",
    editable: false,
    render: (v) => {
      const until = v.proUntil
        ? `on <strong>${esc(v.proUntil)}</strong>`
        : "soon";
      const untilText = v.proUntil ? `on ${v.proUntil}` : "soon";
      const html = layout(
        `<p style="margin:0 0 16px;">Hi ${greeting(v)},</p>
         <p style="margin:0 0 16px;">A quick heads-up: your complimentary <strong>GymRoam Pro</strong> access ends ${until}. Until then, everything stays unlocked — trips, saved gyms, home gyms, and Scout's smartest workouts.</p>
         <p style="margin:0 0 16px;">Want to keep Pro? You can subscribe right in the app.</p>
         ${button(APP_STORE, "Open GymRoam")}
         <p style="margin:0;">Questions, or feel like the timing's wrong? Just reply — a founder reads every message.</p>`
      );
      const text = `Hi ${v.firstName || v.displayName || "there"},\n\nA quick heads-up: your complimentary GymRoam Pro access ends ${untilText}. Until then, everything stays unlocked — trips, saved gyms, home gyms, and Scout's smartest workouts.\n\nWant to keep Pro? You can subscribe right in the app: ${APP_STORE}\n\nQuestions, or feel like the timing's wrong? Just reply — a founder reads every message.\n\n— GymRoam`;
      return { subject: "Your GymRoam Pro access ends soon", html, text };
    },
  },
  {
    id: "feature-shipped",
    label: "You asked, we shipped it",
    description:
      "For a feedback submitter when their request goes live. You write what shipped; the template frames it.",
    editable: true,
    render: (v) => {
      const subject =
        (v.subject || "").trim() || "You asked. It's in GymRoam now.";
      const bodyText = (v.body || "").trim();
      const html = layout(
        `<p style="margin:0 0 16px;">Hi ${greeting(v)},</p>
         <p style="margin:0 0 16px;">You flagged something in GymRoam's feedback, and we built it. It's live now:</p>
         ${paragraphs(bodyText || " ")}
         ${button(APP_STORE, "See it in the app")}
         <p style="margin:0;">Keep the ideas coming — this one exists because you spoke up.</p>`
      );
      const text = `Hi ${v.firstName || v.displayName || "there"},\n\nYou flagged something in GymRoam's feedback, and we built it. It's live now:\n\n${bodyText}\n\nSee it in the app: ${APP_STORE}\n\nKeep the ideas coming — this one exists because you spoke up.\n\n— GymRoam`;
      return { subject, html, text };
    },
  },
];

/** Lightweight metadata for the dashboard picker (safe on the client). */
export const EMAIL_TEMPLATE_OPTIONS = EMAIL_TEMPLATES.map(
  ({ id, label, description, editable }) => ({ id, label, description, editable })
);

export function getTemplate(id: string): EmailTemplate | undefined {
  return EMAIL_TEMPLATES.find((t) => t.id === id);
}
