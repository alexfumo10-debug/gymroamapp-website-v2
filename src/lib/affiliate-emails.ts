/**
 * Creator-program emails, sent via Resend.
 *
 * These used to be written to the Firestore `mail` collection for the
 * Trigger Email extension, which sends from the Firebase default sender and
 * lands in spam. Everything else moved to Resend on the authenticated
 * send.gymroamapp.com subdomain, so these follow. They also reuse the shared
 * brand chrome, so a creator's first email from us looks like every other.
 *
 * Deliberately: the APPROVAL email is where commission terms first appear,
 * and even then only as "we'll send the agreement" — no rates are quoted
 * anywhere public, and none are quoted here either. What we pay is settled
 * in the signed agreement.
 */

import { brandedEmail } from "@/lib/email-templates";

const SUPPORT = "support@gymroamapp.com";

export interface AffiliateEmail {
  subject: string;
  html: string;
  text: string;
}

/** Escape untrusted values before interpolating into email HTML. */
function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;"><tr><td style="background:#E8FF3C;border-radius:10px;">
    <a href="${esc(href)}" style="display:inline-block;padding:11px 22px;color:#0A0A0B;font-weight:700;font-size:14px;text-decoration:none;">${esc(label)}</a>
  </td></tr></table>`;
}

/**
 * APPROVED — the creator is in. Carries their code, tracking link, and the
 * one-time link that sets their dashboard password.
 *
 * `dashboardLink` is a Firebase password-reset link that lands on /creator;
 * it's how a creator sets a password without us ever issuing one. When it
 * can't be generated we say a login is coming separately rather than
 * printing a broken button.
 */
export function affiliateApprovedEmail(opts: {
  name: string;
  code: string;
  trackingLink: string;
  dashboardLink: string | null;
  siteOrigin: string;
}): AffiliateEmail {
  const { name, code, trackingLink, dashboardLink, siteOrigin } = opts;
  const first = (name || "").split(" ")[0] || "there";

  const html = brandedEmail(
    `<p style="margin:0 0 16px;">Hi ${esc(first)},</p>
     <p style="margin:0 0 18px;">You're in. Welcome to the GymRoam crew.</p>

     <p style="margin:0 0 6px;color:#9a9a93;font-size:12px;text-transform:uppercase;letter-spacing:0.6px;">Your code</p>
     <p style="margin:0 0 16px;font-size:24px;font-weight:800;color:#E8FF3C;">${esc(code)}</p>

     <p style="margin:0 0 6px;color:#9a9a93;font-size:12px;text-transform:uppercase;letter-spacing:0.6px;">Your link</p>
     <p style="margin:0 0 20px;"><a href="${esc(trackingLink)}" style="color:#E8FF3C;">${esc(trackingLink)}</a></p>

     ${
       dashboardLink
         ? `<p style="margin:0 0 8px;">Set your password and open your dashboard. You'll see clicks, signups, and what you've earned.</p>
            ${button(dashboardLink, "Set up my dashboard")}
            <p style="margin:0 0 18px;font-size:12px;color:#9a9a93;">After that you can sign in any time at ${esc(siteOrigin)}/creator</p>`
         : `<p style="margin:0 0 18px;">We'll follow up separately with your dashboard login.</p>`
     }

     <p style="margin:0 0 10px;font-weight:700;">What happens next</p>
     <p style="margin:0 0 8px;">1. We'll send your creator agreement to sign. Reply once it's done.</p>
     <p style="margin:0 0 8px;">2. Download GymRoam and sign up <strong>with a real email address</strong>, not Apple's Hide My Email. A relay address means we can't find your account to switch on your free Pro.</p>
     <p style="margin:0 0 8px;">3. Tell us the email you used and we'll turn on your Pro.</p>
     <p style="margin:0 0 18px;">4. Start sharing. Your link and code work right now.</p>

     <p style="margin:0;">Questions? Just reply to this email.</p>`
  );

  const text = `Hi ${first},

You're in. Welcome to the GymRoam crew.

Your code: ${code}
Your link: ${trackingLink}

${
  dashboardLink
    ? `Set your password and open your dashboard:\n${dashboardLink}\n\nAfter that you can sign in any time at ${siteOrigin}/creator`
    : `We'll follow up separately with your dashboard login.`
}

What happens next
1. We'll send your creator agreement to sign. Reply once it's done.
2. Download GymRoam and sign up with a real email address, not Apple's Hide My Email. A relay address means we can't find your account to switch on your free Pro.
3. Tell us the email you used and we'll turn on your Pro.
4. Start sharing. Your link and code work right now.

Questions? Just reply to this email.

The GymRoam team`;

  return { subject: `You're in. Your GymRoam code is ${code}`, html, text };
}

/**
 * DECLINED — previously no email was sent at all, so applicants were left
 * hanging. Kept short, warm, and non-final: audiences grow, and a creator
 * we pass on today is one we might want next year.
 */
export function affiliateDeclinedEmail(opts: { name: string }): AffiliateEmail {
  const first = (opts.name || "").split(" ")[0] || "there";

  const html = brandedEmail(
    `<p style="margin:0 0 16px;">Hi ${esc(first)},</p>
     <p style="margin:0 0 16px;">Thanks for applying to the GymRoam crew, and for the time you put into it.</p>
     <p style="margin:0 0 16px;">We're keeping the crew small for now, so we're not moving forward with your application at the moment. That's about where the program is right now, not a judgment on your content.</p>
     <p style="margin:0 0 16px;">You're welcome to apply again as things grow on your side. We do read every application.</p>
     <p style="margin:0;">In the meantime, GymRoam is free to use, and we'd genuinely like you on it.</p>`
  );

  const text = `Hi ${first},

Thanks for applying to the GymRoam crew, and for the time you put into it.

We're keeping the crew small for now, so we're not moving forward with your application at the moment. That's about where the program is right now, not a judgment on your content.

You're welcome to apply again as things grow on your side. We do read every application.

In the meantime, GymRoam is free to use, and we'd genuinely like you on it.

The GymRoam team`;

  return { subject: "About your GymRoam crew application", html, text };
}

/** CODE CHANGED — an already-approved creator was reissued a new code. */
export function affiliateCodeChangedEmail(opts: {
  name: string;
  code: string;
  trackingLink: string;
  previousCode?: string | null;
}): AffiliateEmail {
  const { name, code, trackingLink, previousCode } = opts;
  const first = (name || "").split(" ")[0] || "there";

  const retired = previousCode
    ? `Your old code ${previousCode} no longer accepts new signups, but everything you've already earned on it is unaffected.`
    : "";

  const html = brandedEmail(
    `<p style="margin:0 0 16px;">Hi ${esc(first)},</p>
     <p style="margin:0 0 16px;">Heads up: your GymRoam code is now <strong style="color:#E8FF3C;">${esc(
       code
     )}</strong>, and your link is <a href="${esc(trackingLink)}" style="color:#E8FF3C;">${esc(
      trackingLink
    )}</a>.</p>
     ${retired ? `<p style="margin:0 0 16px;">${esc(retired)}</p>` : ""}
     <p style="margin:0;">Update your bio link and any pinned posts when you get a chance.</p>`
  );

  const text = `Hi ${first},

Heads up: your GymRoam code is now ${code}, and your link is ${trackingLink}.
${retired ? `\n${retired}\n` : ""}
Update your bio link and any pinned posts when you get a chance.

The GymRoam team`;

  return { subject: "Your GymRoam code changed", html, text };
}

export const AFFILIATE_REPLY_TO = SUPPORT;
