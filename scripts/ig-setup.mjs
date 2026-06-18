/**
 * Instagram setup helper — System User token path.
 *
 * Your GymRoam Page is business-owned, so a personal token can't see it.
 * A System User token (same kind your ads integration uses) can — and
 * it's non-expiring. This script takes that token, finds the assigned
 * Page + linked Instagram account, and writes INSTAGRAM_ACCESS_TOKEN
 * (the non-expiring Page token) + INSTAGRAM_IG_USER_ID into .env.local.
 *
 *   node scripts/ig-setup.mjs "<SYSTEM_USER_TOKEN>"
 *
 * Prereqs (Business Settings → System Users → your system user):
 *   • Add Assets → Pages → the GymRoam Page (full control)
 *   • Add Assets → Instagram accounts → the GymRoam IG (if listed)
 *   • Generate New Token → the GymRoam app → scopes: instagram_basic,
 *     instagram_manage_insights, pages_show_list, pages_read_engagement
 */
import nextEnv from "@next/env";
import { readFileSync, writeFileSync } from "node:fs";
import { createHmac } from "node:crypto";

nextEnv.loadEnvConfig(process.cwd());
const TOKEN = process.argv[2];
const SECRET = process.env.META_APP_SECRET;
const V = process.env.META_GRAPH_VERSION || "v25.0";
const H = `https://graph.facebook.com/${V}`;

if (!TOKEN) {
  console.error('Usage: node scripts/ig-setup.mjs "<SYSTEM_USER_TOKEN>"');
  process.exit(1);
}

const proof = SECRET ? createHmac("sha256", SECRET).update(TOKEN).digest("hex") : null;
const url = (path, params = {}) => {
  const qs = new URLSearchParams({ ...params, access_token: TOKEN });
  if (proof) qs.set("appsecret_proof", proof);
  return `${H}/${path}?${qs}`;
};
const j = async (path, params) => (await fetch(url(path, params))).json();

// Diagnostic: granted scopes (system-user tokens may return none — that's fine).
try {
  const perms = await j("me/permissions");
  if (perms.data) {
    const granted = perms.data.filter((p) => p.status === "granted").map((p) => p.permission);
    if (granted.length) console.log("Granted scopes:", granted.join(", "));
  }
} catch {
  /* non-fatal */
}

const pages = await j("me/accounts", {
  fields:
    "name,access_token,instagram_business_account{id,username},connected_instagram_account{id,username}",
});

if (pages.error) {
  console.error("❌ Graph API error:", pages.error.message);
  process.exit(1);
}
const all = pages.data || [];
if (all.length === 0) {
  console.error(
    "❌ This token still sees no Pages. Make sure the GymRoam Page is assigned\n" +
      "   as an ASSET to this System User (Business Settings → System Users →\n" +
      "   [your system user] → Add Assets → Pages → GymRoam Page → full control),\n" +
      "   then generate a fresh System User token and re-run."
  );
  process.exit(1);
}

console.log("Pages this token can see:");
for (const p of all) {
  const ig = p.instagram_business_account || p.connected_instagram_account;
  console.log(`   • ${p.name}: ${ig ? `IG @${ig.username} (${ig.id})` : "— no linked Instagram —"}`);
}

const withIg = all.filter((p) => p.instagram_business_account || p.connected_instagram_account);
if (withIg.length === 0) {
  console.error(
    "\n❌ Page(s) visible, but no linked Instagram account. Confirm the GymRoam IG\n" +
      "   is a Business/Creator account linked to the GymRoam Page, then re-run."
  );
  process.exit(1);
}

const chosen = withIg[0];
const igObj = chosen.instagram_business_account || chosen.connected_instagram_account;

let env = readFileSync(".env.local", "utf8");
env = env.replace(/^INSTAGRAM_ACCESS_TOKEN=.*$/m, `INSTAGRAM_ACCESS_TOKEN=${chosen.access_token}`);
env = env.replace(/^INSTAGRAM_IG_USER_ID=.*$/m, `INSTAGRAM_IG_USER_ID=${igObj.id}`);
writeFileSync(".env.local", env);

console.log(
  `\n✅ Done. Wrote INSTAGRAM_ACCESS_TOKEN (hidden) + INSTAGRAM_IG_USER_ID=${igObj.id}\n` +
    `   for "${chosen.name}" → @${igObj.username} into .env.local.\n` +
    `   Tell the assistant "done" to verify and restart.`
);
