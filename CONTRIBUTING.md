# Contributing — GymRoam website

Two+ people work on this repo. `main` auto-deploys to production
(`gymroamapp.com`) via Vercel. Follow this flow so we never break the
live site or clobber each other's work.

## The golden rule

**Never push directly to `main`.** It's branch-protected — direct
pushes are rejected. All changes go through a branch + Pull Request.

## Workflow

```
git checkout main
git pull                          # always start from latest main
git checkout -b yourname/what     # e.g. kevin/hero-redesign
# ... make changes ...
npm run build                     # MUST pass before you open a PR
git add <specific files>
git commit -m "clear message"
git push -u origin yourname/what
```

Then on GitHub: **open a Pull Request** into `main`.

- Vercel automatically builds a **preview deployment** for every
  branch/PR and posts the preview URL as a comment on the PR. That's
  your live, shareable test environment — use it to review the change
  visually before merging. Production is untouched until merge.
- The other person reviews + approves the PR (GitHub won't let you
  approve your own).
- Merge the PR → `main` → Vercel deploys to `gymroamapp.com`
  automatically (~1–2 min).
- Delete the branch after merge (GitHub offers a button).

## Branch naming

`yourname/short-description` — e.g. `ale/blog-infra`,
`kevin/pricing-copy`. Keeps it obvious who owns what in the branch list.

## Before every PR

1. `npm run build` passes locally (catches type errors + Next build
   failures before they hit production).
2. You've checked the Vercel preview URL renders correctly.
3. Commit messages are clear (the "why", not just the "what").

## Next.js 16 gotcha

This repo runs **Next.js 16.2.3**, which has breaking changes vs.
older Next. `AGENTS.md` is the canonical warning: **read the relevant
guide in `node_modules/next/dist/docs/` before writing Next.js code.**
Prefix-dynamic route folders (e.g. `foo-[slug]`) do **not** work —
dynamic segments must be the entire folder name (`foo/[slug]`).

## Font gotcha

`globals.css` and component CSS modules must reference
`var(--font-inter)`, never the literal `'Inter'`. The literal silently
falls back to Arial on Windows.

## Emergency hotfix

If production is broken and the reviewer is unreachable: a repo **admin**
can use GitHub's admin-merge override on the PR (branch protection is
configured with admin bypass enabled for exactly this case). Use
sparingly — it skips review.

## Environment variables

Live in Vercel project settings (not committed). `.env.local.example`
documents what's needed. If you add a new env var, update that example
file in the same PR and add the real value in Vercel → Settings →
Environment Variables.
