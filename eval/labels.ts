export type IssueLabel = "bug" | "feature" | "docs" | "question";

export const criteria: Record<IssueLabel, string> = {
  bug: "Something is broken: a crash, error, wrong output, or regression in existing behavior",
  feature:
    "A request for new functionality, a new API or option, or a change to how something works",
  docs: "A problem with, or request for, documentation, guides, examples, or website content",
  question:
    "The author asks how to do something or wants help, without reporting a defect or requesting a change",
};

export const instructions =
  "Triage this GitHub issue: which kind of issue is it?";

export const repoLabels: Record<string, Record<string, IssueLabel>> = {
  "react/react": {
    "Type: Bug": "bug",
    "Type: Feature Request": "feature",
    "Type: Enhancement": "feature",
    "Type: Question": "question",
  },
  "microsoft/TypeScript": {
    Bug: "bug",
    Suggestion: "feature",
    Docs: "docs",
    Question: "question",
  },
  "microsoft/vscode": {
    bug: "bug",
    "feature-request": "feature",
    "*question": "question",
  },
  "sveltejs/svelte": {
    bug: "bug",
    "feature request": "feature",
    documentation: "docs",
  },
  "rust-lang/rust": {
    "C-bug": "bug",
    "C-feature-request": "feature",
    "A-docs": "docs",
  },
  "oven-sh/bun": {
    bug: "bug",
    enhancement: "feature",
    docs: "docs",
    question: "question",
  },
  "denoland/deno": {
    bug: "bug",
    suggestion: "feature",
    docs: "docs",
    question: "question",
  },
};

export interface Issue {
  repo: string;
  number: number;
  label: IssueLabel;
  title: string;
  body: string;
}

// Pin a version (e.g. TYPESAFE_DEFAULT_MODEL=jev-1.14.0) to compare models; caches and reports are per model.
export const model = process.env.TYPESAFE_DEFAULT_MODEL ?? "jev-latest";
export const resultsPath = `eval/data/jev-${model}.jsonl`;
export const reportPath = `eval/results/${model}.md`;
