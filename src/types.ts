export interface DiffFile {
  filename: string;
  status: 'added' | 'removed' | 'modified' | 'renamed' | 'unknown';
  additions: number;
  deletions: number;
  patch: string;
}

export interface PushDiff {
  files: DiffFile[];
  totalChars: number;
  truncated: boolean;
  base: string;
  head: string;
}
