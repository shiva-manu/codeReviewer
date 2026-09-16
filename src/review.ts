import OpenAI from 'openai';
import { randomUUID } from 'node:crypto';
import type { PushDiff } from './types.js';

interface ReviewArgs {
  apiKey: string;
  model: string;
  diff: PushDiff;
}

export const OPENCODE_GO_BASE_URL = 'https://opencode.ai/zen/go/v1';
export const DEFAULT_OPENCODE_GO_MODEL = 'muse-spark-1.3-contributor';

function renderDiff(diff: PushDiff): string {
  return diff.files
    .map(
      (f) =>
        `--- ${f.filename} [${f.status}, +${f.additions}/-${f.deletions}] ---\n${f.patch}`,
    )
    .join('\n\n');
}

export async function reviewChanges({ apiKey, model, diff }: ReviewArgs): Promise<string> {
  const client = new OpenAI({
    apiKey,
    baseURL: OPENCODE_GO_BASE_URL,
    timeout: 120_000,
  });
  const summaryLine = diff.truncated
    ? `Showing first ${diff.files.length} files (more files changed).`
    : `${diff.files.length} file(s) changed.`;

  const response = await client.responses.create(
    {
      model,
      temperature: 0.3,
      instructions:
        'You are a senior code reviewer. Explain what the pushed code changes DO (not just list files), then flag risks, bugs, and concrete suggestions. Be concise, use markdown, reference filenames and line context. Sections: ## What changed, ## Risks & issues, ## Suggestions. End with a one-line verdict.',
      input: `Review this push (${summaryLine} base ${diff.base} → head ${diff.head}):\n\n${renderDiff(diff)}`,
    },
    {
      headers: {
        'User-Agent': 'code-reviewer/1.0',
        'x-opencode-session': `code-reviewer-${diff.head || randomUUID()}`,
      },
    },
  );

  return response.output_text.trim() || 'No review generated.';
}
