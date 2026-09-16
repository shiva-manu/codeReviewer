# Keys

This action needs two keys. The OpenCode key is covered by you; this guide
covers every other key the project uses.

## 1. GitHub token (`GITHUB_TOKEN`) — no setup needed in CI

The bundled workflow (`.github/workflows/review.yml`) already uses the
automatic token GitHub injects into every run (`${{ github.token }}`, mapped
to the `github-token` input, default in `action.yml`). That token is what
`src/diff.ts` uses to read the push diff and what `src/comment.ts` uses to
post the review comment.

Why it just works:

- The `permissions:` block in the workflow already grants what the code
  needs: `contents: read` (compare diffs), `pull-requests: write` +
  `issues: write` (post/update the review comment). If your repo or org
  restricts default `GITHUB_TOKEN` permissions, keep those three lines.
- No secret to create, rotate, or store. GitHub mints a short-lived token
  per run and revokes it when the job ends.

You only need to think about it if:

- **Local runs** (`npm run build && npm run review` on your machine): export
  a token yourself, e.g. `export GITHUB_TOKEN=...`, plus fake the Actions
  env (`GITHUB_REPOSITORY`, `GITHUB_SHA`, ...). Easiest local token: GitHub
  → Settings → Developer settings → Personal access tokens → Tokens
  (classic) → Generate new token with `repo` scope → paste into `.env`
  (see `.env.example`). Prefer the fine-grained variant scoped to one repo
  with Contents: read + Pull requests: write if your org requires it.
- **Cross-repo use / publishing as `shiva-manu/codeReviewer@v1`**: callers
  don't pass anything — `${{ github.token }}` of *their* repo is used
  automatically. Only if they want a custom identity (e.g. a bot user for
  the comment author) would they pass `github-token:` explicitly with a PAT
  stored as a secret.

## 2. OpenCode key (`OPENCODE_API_KEY`) — repo secret, one-time setup

Already yours, so just the wiring: repo → Settings → Secrets and variables
→ Actions → New repository secret → name `OPENCODE_API_KEY` → paste.
The workflow reads it as `${{ secrets.OPENCODE_API_KEY }}` and `action.yml`
maps it to the `opencode-api-key` input. Update it in that same screen when
you rotate keys; nothing in code changes.

## Checklist

- [ ] `.github/workflows/review.yml` present with the three `permissions:`
      lines intact
- [ ] `OPENCODE_API_KEY` secret set (repo or environment secrets)
- [ ] Push to `main` or open a PR — one review comment appears, updated in
      place on the next push
