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

// Email accent. The brand neon is #E8FF3C, but that's a LIME (green channel
// maxed, red lower) — mobile mail apps in dark mode render it as green. We
// raise red to max so red >= green → it reads as a bright neon YELLOW on
// phones while staying on-brand. Email-only; does not change the app/brand
// assets. (The header logo PNG is still the exact #E8FF3C tile.)
const BRAND_YELLOW = "#FFEC3C";
const INK = "#0A0A0B";
const CARD_BG = "#131312"; // brand near-black card
const TEXT = "#ECEBE8"; // off-white body text on dark
const MUTED = "#9a9a93"; // footer / secondary text
const HAIRLINE = "rgba(255,255,255,0.09)"; // subtle dividers on dark
const SUPPORT = "support@gymroamapp.com";
const APP_STORE = "https://apps.apple.com/app/id6773157406";

// The real logo (the app icon), hosted on the site so email clients can
// load it. Absolute URL is required in email. If a client blocks remote
// images, the "GymRoam" wordmark text beside it still carries the brand.
// Email-only warm-yellow variant of the app icon (#FFEC3C tile) so the header
// logo matches the email accent and doesn't read green on mobile. The exact
// brand icon (#E8FF3C lime) stays at gymroam-logo.png for the app/site.
const LOGO_URL = "https://gymroamapp.com/gymroam-logo-email.png";

// GymRoam Pro pricing quoted in promotional templates. Single source of
// truth for email copy — keep in sync with the live App Store Connect
// products (US-store pricing; the App Store localizes at purchase).
// The 7-day free trial exists on the ANNUAL plan only — never imply a
// monthly trial.
const PRO_MONTHLY = "$7.99/month";
const PRO_ANNUAL = "$39.99/year";

// Physical postal address for promotional footers — REQUIRED by CAN-SPAM
// on any email whose primary purpose is commercial (e.g. the Pro pitch).
// A registered-agent address or PO Box is fine. Until this is set, the
// promo footer renders the opt-out line without the address line — set it
// before sending promotional templates to real users.
const POSTAL_ADDRESS = "";

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
 * Shared email chrome — table-based, inline-styled, NATIVE DARK to match the
 * GymRoam brand (near-black + neon yellow). The `color-scheme: dark` signal
 * + meta tags stop Apple Mail / Gmail from force-inverting it (that inversion
 * is what muddied the old light design in dark-mode inboxes). The header uses
 * the real logo asset (hosted PNG) beside the wordmark, so a client that
 * blocks remote images still shows "GymRoam". Broad-client compatible
 * (Gmail, Apple Mail, Outlook) via bgcolor fallbacks.
 */
function layout(innerHtml: string, opts?: { promoFooter?: boolean }): string {
  // CAN-SPAM block for promotional templates: why they got it, a working
  // opt-out (reply-based is compliant), and the postal address when set.
  const promo = opts?.promoFooter
    ? `<p style="margin:10px 0 0;color:${MUTED};">You're receiving this one-time note because you have a GymRoam account. Prefer not to get emails like this? Reply &quot;unsubscribe&quot; and we won't send more.${
        POSTAL_ADDRESS ? `<br/>GymRoam · ${esc(POSTAL_ADDRESS)}` : ""
      }</p>`
    : "";
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="color-scheme" content="dark"/>
  <meta name="supported-color-schemes" content="dark"/>
</head>
<body style="margin:0;padding:0;background:${INK};color-scheme:dark;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${INK}" style="background:${INK};padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${CARD_BG}" style="max-width:520px;background:${CARD_BG};border-radius:14px;overflow:hidden;border:1px solid ${HAIRLINE};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
        <tr><td bgcolor="${INK}" style="background:${INK};padding:20px 28px;border-bottom:1px solid ${HAIRLINE};">
          <img src="${LOGO_URL}" width="38" height="38" alt="" style="display:inline-block;vertical-align:middle;border-radius:9px;"/>
          <span style="display:inline-block;vertical-align:middle;margin-left:11px;font-size:21px;font-weight:800;letter-spacing:-0.5px;color:#ffffff;">Gym<span style="color:${BRAND_YELLOW};">Roam</span></span>
        </td></tr>
        <tr><td style="padding:28px;color:${TEXT};font-size:15px;line-height:1.6;">
          ${innerHtml}
        </td></tr>
        <tr><td style="padding:18px 28px 26px;border-top:1px solid ${HAIRLINE};color:${MUTED};font-size:12px;line-height:1.5;">
          GymRoam · Questions? Just reply, or email <a href="mailto:${SUPPORT}" style="color:${BRAND_YELLOW};">${SUPPORT}</a>.${promo}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Plain-text mirror of the promo footer (compliance applies to both parts). */
function promoFooterText(): string {
  return `\n\nYou're receiving this one-time note because you have a GymRoam account. Prefer not to get emails like this? Reply "unsubscribe" and we won't send more.${
    POSTAL_ADDRESS ? `\nGymRoam · ${POSTAL_ADDRESS}` : ""
  }`;
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;"><tr><td style="background:${BRAND_YELLOW};border-radius:10px;">
    <a href="${esc(href)}" style="display:inline-block;padding:11px 22px;color:${INK};font-weight:700;font-size:14px;text-decoration:none;">${esc(label)}</a>
  </td></tr></table>`;
}

/** One feature line: bold neon name + a one-line description. */
function featureRow(name: string, desc: string): string {
  return `<p style="margin:0 0 15px;"><strong style="color:${BRAND_YELLOW};">${esc(name)}</strong><br/>${esc(desc)}</p>`;
}

// The feature rundown shown to Pro members (id "pro-features"). Order = most
// marquee first. Keep every line true to what actually ships (no unconfirmed
// perks). Rendered to HTML rows + plain-text bullets from one source.
const PRO_FEATURES: [string, string][] = [
  ["Scout, your AI", "Find the right gym or generate a full workout anywhere. Pro runs the smartest model."],
  ["Unlimited Trips", "Map the gyms for every trip and get countdown reminders before you fly."],
  ["Unlimited saved gyms", "Bookmark every spot worth coming back to, no cap."],
  ["Home gyms", "Set your home bases and post multi-layout Stories from them."],
  ["Travel Fitness Passport", "Check in with a photo, earn a stamp, and share the card straight to Instagram."],
  ["The whole map", "Boutique studios, HYROX, pilates, yoga, run clubs, recovery and wellness, wherever you land."],
  ["Friends", "Follow friends and see where they've been training."],
];

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
    id: "pro-features",
    label: "Pro features rundown",
    description:
      "Walks a Pro member through everything the app can do, so they use it all.",
    editable: false,
    render: (v) => {
      const rowsHtml = PRO_FEATURES.map(([n, d]) => featureRow(n, d)).join("\n");
      const rowsText = PRO_FEATURES.map(([n, d]) => `• ${n}: ${d}`).join("\n");
      const html = layout(
        `<p style="margin:0 0 16px;">Hi ${greeting(v)},</p>
         <p style="margin:0 0 18px;">You&apos;re on <strong>GymRoam Pro</strong>, so the full toolkit is yours. Here&apos;s everything you can do to make the most of every trip:</p>
         ${rowsHtml}
         ${button(APP_STORE, "Open GymRoam")}
         <p style="margin:0;">Get out there. Reply anytime, a founder reads every message.</p>`
      );
      const text = `Hi ${v.firstName || v.displayName || "there"},\n\nYou're on GymRoam Pro, so the full toolkit is yours. Here's everything you can do to make the most of every trip:\n\n${rowsText}\n\nOpen the app: ${APP_STORE}\n\nGet out there. Reply anytime, a founder reads every message.\n\nThe GymRoam team`;
      return { subject: "Everything your GymRoam Pro unlocks", html, text };
    },
  },
  {
    id: "welcome-pro",
    label: "Welcome + Pro pitch ($7.99)",
    description:
      "Welcome with the Pro upsell (monthly price + annual w/ 7-day trial). PROMOTIONAL — send only while Pro is purchasable in the live app.",
    editable: false,
    render: (v) => {
      const html = layout(
        `<p style="margin:0 0 16px;">Hi ${greeting(v)},</p>
         <p style="margin:0 0 16px;">Welcome to GymRoam — the passport for training wherever you travel. Find gyms, studios, and run clubs on the map, check in to stamp your passport, and ask Scout to plan a workout anywhere.</p>
         <p style="margin:0 0 16px;">And when you're ready for the full experience, <strong>GymRoam Pro is waiting</strong>: unlimited trips, saved gyms, home gyms, and Scout's smartest workouts — for <strong>${PRO_MONTHLY}</strong>, or ${PRO_ANNUAL} with a <strong>7-day free trial</strong>.</p>
         ${button(APP_STORE, "Start roaming")}
         <p style="margin:0;">If anything's confusing, just reply — a founder reads every message.</p>`,
        { promoFooter: true }
      );
      const text = `Hi ${v.firstName || v.displayName || "there"},\n\nWelcome to GymRoam — the passport for training wherever you travel. Find gyms, studios, and run clubs on the map, check in to stamp your passport, and ask Scout to plan a workout anywhere.\n\nAnd when you're ready for the full experience, GymRoam Pro is waiting: unlimited trips, saved gyms, home gyms, and Scout's smartest workouts — for ${PRO_MONTHLY}, or ${PRO_ANNUAL} with a 7-day free trial.\n\nStart roaming: ${APP_STORE}\n\nIf anything's confusing, just reply — a founder reads every message.\n\n— GymRoam${promoFooterText()}`;
      return { subject: "Welcome to GymRoam — Pro is waiting for you", html, text };
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
