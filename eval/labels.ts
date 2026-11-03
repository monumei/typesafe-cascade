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
