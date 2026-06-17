/**
 * TikTok OAuth setup helper. Two steps:
 *
 *   1) node scripts/tiktok-setup.mjs auth
 *      → prints the authorize URL. Open it in a browser logged into the
 *        GymRoam TikTok account, approve, then copy the `code` value from
 *        the URL you get redirected to (the page itself can 404 — only the
 *        ?code=... in the address bar matters).
 *
 *   2) node scripts/tiktok-setup.mjs code "<THE_CODE>"
 *      → exchanges the code for tokens and writes TIKTOK_REFRESH_TOKEN
 *        into .env.local. The dashboard then auto-refreshes from there.
 *
 * Reads TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET / TIKTOK_REDIRECT_URI
 * from .env.local.
 */
import nextEnv from "@next/env";
import { readFileSync, writeFileSync } from "node:fs";

nextEnv.loadEnvConfig(process.cwd());
const KEY = process.env.TIKTOK_CLIENT_KEY;
const SECRET = process.env.TIKTOK_CLIENT_SECRET;
const REDIRECT = process.env.TIKTOK_REDIRECT_URI;
const SCOPES = "user.info.basic,user.info.stats,video.list";
const [mode, code] = process.argv.slice(2);

if (!KEY || !SECRET || !REDIRECT) {
  console.error("Fill TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_REDIRECT_URI in .env.local first.");
  process.exit(1);
}

if (mode === "auth") {
  const state = "gr" + Math.random().toString(36).slice(2, 12);
  const url =
    "https://www.tiktok.com/v2/auth/authorize/?" +
    new URLSearchParams({
      client_key: KEY,
      scope: SCOPES,
      response_type: "code",
      redirect_uri: REDIRECT,
      state,
    });
  console.log("\nOpen this URL in a browser logged into the GymRoam TikTok account:\n");
  console.log(url);
  console.log(
    "\nApprove, then from the page it redirects you to, copy the value of `code`\n" +
      "from the address bar (everything after code= and before any &state=...),\n" +
      'then run:  node scripts/tiktok-setup.mjs code "<THE_CODE>"\n'
  );
  process.exit(0);
}

if (mode === "code" && code) {
  const body = new URLSearchParams({
    client_key: KEY,
    client_secret: SECRET,
    code: decodeURIComponent(code),
    grant_type: "authorization_code",
    redirect_uri: REDIRECT,
  });
  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const j = await res.json();
  if (!res.ok || !j.refresh_token) {
    console.error("❌ Token exchange failed:", j.error_description || j.error || JSON.stringify(j));
    console.error("   (Codes are single-use and expire in ~10 min — if it failed, run `auth` again for a fresh one.)");
    process.exit(1);
  }
  let env = readFileSync(".env.local", "utf8");
  env = env.replace(/^TIKTOK_REFRESH_TOKEN=.*$/m, `TIKTOK_REFRESH_TOKEN=${j.refresh_token}`);
  writeFileSync(".env.local", env);
  console.log(
    `\n✅ Done. Wrote TIKTOK_REFRESH_TOKEN (hidden) into .env.local` +
      ` (scopes: ${j.scope || SCOPES}).\n   Tell the assistant "done" to verify and restart.`
  );
  process.exit(0);
}

console.error('Usage:\n  node scripts/tiktok-setup.mjs auth\n  node scripts/tiktok-setup.mjs code "<THE_CODE>"');
process.exit(1);
