import { $ } from "bun";
import { repoLabels, type Issue, type IssueLabel } from "./labels";

// The manifest pins which issues are in the eval and their labels at snapshot time.
// Issue text stays out of git and gets hydrated from GitHub on demand.
export const manifestPath = "eval/manifest.jsonl";
export const issuesPath = "eval/data/issues.jsonl";
const maxBody = 4000;
const batchSize = 50;

type Entry = Pick<Issue, "repo" | "number" | "label">;

const readJsonl = async <T>(path: string): Promise<T[]> =>
  (await Bun.file(path).text())
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as T);

const writeJsonl = (path: string, rows: unknown[]) =>
  Bun.write(path, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");

async function sample(perLabel: number): Promise<Entry[]> {
  const out: Entry[] = [];
  const seen = new Set<string>();
  for (const [repo, mapping] of Object.entries(repoLabels)) {
    for (const ghLabel of Object.keys(mapping)) {
      const raw =
        await $`gh issue list -R ${repo} --state all --label ${ghLabel} --limit ${perLabel} --json number,labels,author`.json();
      for (const issue of raw as {
        number: number;
        labels: { name: string }[];
        author: { is_bot?: boolean };
      }[]) {
        if (issue.author?.is_bot || seen.has(`${repo}#${issue.number}`))
          continue;
        seen.add(`${repo}#${issue.number}`);
        const mapped = new Set<IssueLabel>(
          issue.labels.flatMap((l) =>
            Object.hasOwn(mapping, l.name) ? [mapping[l.name]!] : [],
          ),
        );
        // Zero or conflicting type labels leave no single right answer to score against.
        if (mapped.size !== 1) continue;
        out.push({ repo, number: issue.number, label: [...mapped][0]! });
      }
    }
  }
  return out.sort(
    (a, b) => a.repo.localeCompare(b.repo) || a.number - b.number,
  );
}

async function hydrate(entries: Entry[]): Promise<Issue[]> {
  const out: Issue[] = [];
  const byRepo = Object.groupBy(entries, (e) => e.repo);
  for (const [repo, repoEntries] of Object.entries(byRepo)) {
    const [owner, name] = repo.split("/");
    for (let i = 0; i < repoEntries!.length; i += batchSize) {
      const batch = repoEntries!.slice(i, i + batchSize);
      const fields = batch
        .map((e) => `i${e.number}: issue(number: ${e.number}) { title body }`)
        .join("\n");
      const query = `query { repository(owner: "${owner}", name: "${name}") { ${fields} } }`;
      // nothrow: a deleted or transferred issue makes GraphQL report an error but still return the rest.
      const res = await $`gh api graphql -f query=${query}`.nothrow().quiet();
      const data = JSON.parse(res.stdout.toString() || "{}").data?.repository;
      if (!data)
        throw new Error(`GitHub returned no data for ${repo}: ${res.stderr}`);
      for (const e of batch) {
        const issue = data[`i${e.number}`];
        if (!issue) continue;
        out.push({
          ...e,
          title: issue.title,
          body: (issue.body ?? "").slice(0, maxBody),
        });
      }
    }
  }
  return out;
}

if (import.meta.main) {
  const refresh = process.argv.includes("--refresh");
  if (refresh) {
    const perLabel = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 100);
    await writeJsonl(manifestPath, await sample(perLabel));
  }
  const manifest = await readJsonl<Entry>(manifestPath);
  const issues = await hydrate(manifest);
  await writeJsonl(issuesPath, issues);

  console.log(`${issues.length}/${manifest.length} issues hydrated`);
  const counts = Object.groupBy(issues, (i) => i.label);
  for (const [k, v] of Object.entries(counts))
    console.log(`  ${k}: ${v!.length}`);
}
