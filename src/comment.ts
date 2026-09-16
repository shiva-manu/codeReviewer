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
  const prs = await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
    owner,
    repo,
    commit_sha: context.sha,
  });
  const prNumber =
    (context.payload as { pull_request?: { number: number } }).pull_request?.number ??
    prs.data[0]?.number;

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

  try {
    await octokit.rest.repos.createCommitComment({
      owner,
      repo,
      commit_sha: context.sha,
      body,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Resource not accessible by integration') || msg.includes('commit comments')) {
      throw new Error(
        'Commit comments need a token with commit-comment scope: direct pushes to main use createCommitComment, which the default GITHUB_TOKEN cannot call here. Push via a pull request instead (review posts as a PR comment), or pass github-token with a PAT that has Contents: write.',
      );
    }
    throw err;
  }
}
