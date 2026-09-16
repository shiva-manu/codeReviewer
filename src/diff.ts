import type { context as ContextType } from '@actions/github';
import type { PushDiff, DiffFile } from './types.js';

type Context = typeof ContextType;

interface GetPushDiffArgs {
  octokit: ReturnType<typeof import('@actions/github').getOctokit>;
  context: Context;
  owner: string;
  repo: string;
  maxFiles: number;
}

const ZERO_SHA = /^0+$/;
const MAX_PATCH_CHARS = 8000;
const MAX_TOTAL_CHARS = 100_000;

function clipPatch(patch: string): string {
  const lines = patch.split('\n');
  const clipped = lines.map((l) => (l.length > 1000 ? l.slice(0, 1000) + ' …[long line clipped]' : l));
  const joined = clipped.join('\n');
  return joined.length > MAX_PATCH_CHARS
    ? joined.slice(0, MAX_PATCH_CHARS) + '\n…[patch clipped: file too large]'
    : joined;
}

function toStatus(raw: string | undefined): DiffFile['status'] {
  if (raw === 'added' || raw === 'removed' || raw === 'modified' || raw === 'renamed') return raw;
  return 'unknown';
}

export async function getPushDiff({ octokit, context, owner, repo, maxFiles }: GetPushDiffArgs): Promise<PushDiff> {
  const payload = context.payload as {
    pull_request?: { base: { sha: string }; head: { sha: string } };
    before?: string;
    after?: string;
  };

  let base = '';
  let head = '';

  if (payload.pull_request) {
    base = payload.pull_request.base.sha;
    head = payload.pull_request.head.sha;
  } else {
    base = payload.before ?? '';
    head = payload.after ?? context.sha;
    if (!base || ZERO_SHA.test(base)) {
      const { data: repoInfo } = await octokit.rest.repos.get({ owner, repo });
      base = repoInfo.default_branch;
    }
  }

  const { data: cmp } = await octokit.rest.repos.compareCommitsWithBasehead({
    owner,
    repo,
    basehead: `${base}...${head}`,
  });

  const rawFiles = (cmp.files ?? []).filter((f) => f.patch);
  const limit = Number.isFinite(maxFiles) && maxFiles > 0 ? Math.min(Math.floor(maxFiles), 100) : 20;
  let truncated = rawFiles.length > limit;
  const files: DiffFile[] = rawFiles.slice(0, limit).map((f) => ({
    filename: f.filename,
    status: toStatus(f.status),
    additions: f.additions,
    deletions: f.deletions,
    patch: clipPatch(f.patch ?? ''),
  }));

  const kept: DiffFile[] = [];
  let totalChars = 0;
  for (const f of files) {
    const room = MAX_TOTAL_CHARS - totalChars;
    if (room <= 0) {
      truncated = true;
      break;
    }
    if (f.patch.length > room) {
      f.patch = f.patch.slice(0, room) + '\n…[diff clipped: total too large]';
      totalChars = MAX_TOTAL_CHARS;
      kept.push(f);
      truncated = true;
      break;
    }
    totalChars += f.patch.length;
    kept.push(f);
  }

  return { files: kept, totalChars, truncated, base, head };
}
