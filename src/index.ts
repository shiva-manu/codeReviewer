import * as core from '@actions/core';
import * as github from '@actions/github';
import { getPushDiff } from './diff.js';
import { reviewChanges, DEFAULT_OPENCODE_GO_MODEL } from './review.js';
import { postReview } from './comment.js';

async function run(): Promise<void> {
  try {
    const apiKey: string = process.env.OPENAI_API_KEY ?? process.env.OPENCODE_API_KEY ?? '';
    const model: string = process.env.INPUT_MODEL ?? DEFAULT_OPENCODE_GO_MODEL;
    const parsedMax = parseInt(process.env.INPUT_MAX_FILES ?? '20', 10);
    const maxFiles: number = Number.isFinite(parsedMax) && parsedMax > 0 ? Math.min(Math.floor(parsedMax), 100) : 20;
    const token: string = process.env.GITHUB_TOKEN ?? '';

    if (!apiKey) throw new Error('Missing OpenCode Go key. Pass inputs.opencode-api-key.');
    if (!token) throw new Error('Missing GITHUB_TOKEN.');

    const octokit = github.getOctokit(token);
    const ctx = github.context;
    const { owner, repo } = ctx.repo;

    const diff = await getPushDiff({ octokit, context: ctx, owner, repo, maxFiles });

    if (diff.files.length === 0) {
      core.info('No code changes found — nothing to review.');
      return;
    }

    core.info(`Reviewing ${diff.files.length} file(s), ~${diff.totalChars} chars of diff.`);
    const review: string = await reviewChanges({ apiKey, model, diff });
    await postReview({ octokit, context: ctx, owner, repo, diff, review });

    core.setOutput('review', review);
    core.info('Review posted successfully.');
  } catch (err) {
    core.setFailed(err instanceof Error ? err.message : String(err));
  }
}

void run();
