# codeReviewer

TypeScript GitHub Action that reviews code every time a developer pushes. It fetches the push diff from the GitHub API, asks Muse Spark 1.3 Contributor (via the OpenCode Go plan API, which is OpenAI-compatible) to explain **what the changes actually do**, then posts the review as a PR comment (or commit comment on direct pushes).

## What it does on each push

1. **Trigger** — `push` or `pull_request` event fires the workflow.
2. **Diff** (`src/diff.ts`) — compares `base...head` via `compareCommitsWithBasehead`, collects file patches, clips huge files/patches so the prompt stays in budget.
3. **Review** (`src/review.ts`) — sends the diff to the OpenCode Go plan endpoint (`https://opencode.ai/zen/go/v1/responses`, model `muse-spark-1.3-contributor` by default) via the OpenAI-compatible SDK, with a system prompt that forces three sections: *What changed*, *Risks & issues*, *Suggestions*, plus a one-line verdict.
4. **Explain** (`src/comment.ts`) — posts the review back to GitHub: updates/creates one PR comment (idempotent via `<!-- ai-code-reviewer -->` marker), or a commit comment for direct pushes.

## Setup

```yaml
# .github/workflows/review.yml (already included)
- uses: shiva-manu/codeReviewer@v1
  with:
    opencode-api-key: ${{ secrets.OPENCODE_API_KEY }}
```

Secrets needed: `OPENCODE_API_KEY` (from your OpenCode Go plan subscription). Optional inputs: `model` (default `muse-spark-1.3-contributor`), `max-files` (default `20`).

> Privacy note: the Contributor tier trains on your prompts in exchange for discounted pricing, and Go requires an OpenCode-style `User-Agent` plus a stable `x-opencode-session` header — this action already sends both.

## Local dev

```bash
npm install
npm run typecheck
npm run build
```

test
