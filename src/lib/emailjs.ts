export const EMAILJS_SERVICE_ID = "service_byyy6jp";
export const EMAILJS_TEMPLATE_ID = "template_n71kuds";
export const EMAILJS_PUBLIC_KEY = "lgVF9b6WUJXBQV_P1";

/**
 * Career application notification template.
 *
 * 👇 REPLACE this with the template ID after creating the new EmailJS
 *    template (see setup notes in /careers/page.tsx submit handler).
 *    Until set, careers submissions still write to Firestore and still
 *    show in the admin panel — the email notification just won't fire.
 */
export const EMAILJS_CAREERS_TEMPLATE_ID = "template_REPLACE_ME";

/**
 * Support form notification template — used by /support.
 *
 * 👇 REPLACE this with the template ID after creating the new EmailJS
 *    template in the EmailJS dashboard. The template should accept the
 *    following variables (mirrors what /support/page.tsx sends):
 *
 *      {{to_email}}       → "gymroamapp@gmail.com" (fixed)
 *      {{sender_name}}    → user's name
 *      {{sender_email}}   → user's email (reply-to)
 *      {{subject}}        → user's subject line
 *      {{message}}        → the support message body
 *
 *    Recommended template subject:
 *      "GymRoam Support — {{subject}}"
 *    Recommended Reply-To field in EmailJS: {{sender_email}}
 *
 *    Until set, the /support form will block submission with an inline
 *    fallback notice that points users to gymroamapp@gmail.com directly.
 *    No data is lost — the form simply tells the user where to email.
 */
export const EMAILJS_SUPPORT_TEMPLATE_ID = "template_99s4pgb";
