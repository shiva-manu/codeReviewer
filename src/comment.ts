import type { context as ContextType } from '@actions/github';
import type { PushDiff } from './types.js';

type Context = typeof ContextType;

interface PostReviewArgs {
  octokit: ReturnType<typeof import('@actions/github').getOctokit>;
  context: Context;
  owner: string;
  repo: string;
  diff: PushDiff;
  review: string;
}

const MARKER = '<!-- ai-code-reviewer -->';

export async function postReview({ octokit, context, owner, repo, diff, review }: PostReviewArgs): Promise<void> {
  const body = `${MARKER}\n## 🤖 AI Code Review — what this push changed\n\n${review}\n\n<details><summary>Files reviewed (${diff.files.length})</summary>\n\n${diff.files.map((f) => `- \`${f.filename}\` (+${f.additions}/-${f.deletions})`).join('\n')}\n</details>`.slice(0, 65000);
  const prNumber = (context.payload as { pull_request?: { number: number } }).pull_request?.number;

  if (prNumber) {
    let priorId: number | undefined;
    for (let page = 1; page <= 10; page++) {
      const { data: comments } = await octokit.rest.issues.listComments({ owner, repo, issue_number: prNumber, per_page: 100, page });
      const hit = comments.find((c) => c.body?.includes(MARKER));
      if (hit) {
        priorId = hit.id;
        break;
      }
      if (comments.length < 100) break;
    }
    if (priorId) {
      await octokit.rest.issues.updateComment({ owner, repo, comment_id: priorId, body });
    } else {
      await octokit.rest.issues.createComment({ owner, repo, issue_number: prNumber, body });
    }
    return;
  }

  await octokit.rest.repos.createCommitComment({
    owner,
    repo,
    commit_sha: context.sha,
    body,
  });
}
