/**
 * Benchmarks decision models and question sets against labelled posts.
 *
 *   OPENROUTER_API_KEY=… pnpm bench <dataset.jsonl> [options]
 *
 * Options:
 *   --model a,b          models to compare (default: the app's model)
 *   --questions f.json,… question sets to compare, as JSON files shaped
 *                        like CONTENT_QUESTIONS (default: the app's)
 *   --threshold 0.5      probability at which a tag counts
 *   --out results.jsonl  write every answer, with post text, as a dataset
 *
 * Dataset lines need a post reference (`uri` or bsky.app `url`) and
 * `labels`, e.g. {"url": "https://bsky.app/profile/…/post/…",
 * "labels": {"politics": true, "political_snark": false}}. Lines without
 * `state` have their text fetched from Bluesky.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { parseArgs } from "node:util";
import { scoreTags } from "../src/classify/benchmark";
import { parseDataset, type DatasetLine } from "../src/classify/dataset";
import {
  decide,
  DEFAULT_DECISION_MODEL,
  type Questions,
} from "../src/classify/decisions";
import { withDerivedTags } from "../src/classify/derived";
import { statesFor } from "../src/classify/hydrate";
import {
  CONTENT_QUESTIONS,
  questionsVersion,
  TAG_LABELS,
} from "../src/classify/questions";
import { postUrl } from "../src/links";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    model: { type: "string", default: DEFAULT_DECISION_MODEL },
    questions: { type: "string" },
    threshold: { type: "string", default: "0.5" },
    out: { type: "string" },
  },
});

const datasetPath = positionals[0];
const apiKey = process.env.OPENROUTER_API_KEY;
if (!datasetPath || !apiKey) {
  console.error(
    "Usage: OPENROUTER_API_KEY=… pnpm bench <dataset.jsonl> [--model a,b] [--questions f.json] [--threshold 0.5] [--out results.jsonl]",
  );
  process.exit(2);
}

const threshold = Number(values.threshold);
const models = values.model.split(",").filter(Boolean);
const questionSets: [string, Questions][] = values.questions
  ? values.questions
      .split(",")
      .map((path) => [
        basename(path, ".json"),
        JSON.parse(readFileSync(path, "utf8")) as Questions,
      ])
  : [["app", CONTENT_QUESTIONS]];

const lines = parseDataset(readFileSync(datasetPath, "utf8"));
const missing = lines.filter((l) => !l.state).map((l) => l.uri);
const fetched = await statesFor(missing);
const posts = lines.flatMap((line) => {
  const found = line.state
    ? { uri: line.uri, state: line.state }
    : fetched.get(line.uri);
  if (!found) {
    console.warn(`Skipping ${line.url ?? line.uri}: post not found`);
    return [];
  }
  return [{ ...line, ...found }];
});

const tags = [
  ...new Set([
    ...Object.keys(TAG_LABELS),
    ...posts.flatMap((p) => Object.keys(p.labels ?? {})),
  ]),
];
const percent = (x: number) =>
  Number.isNaN(x) ? "  —" : `${Math.round(x * 100)}%`.padStart(4);
const shorten = (text: string) =>
  text.replace(/\s+/g, " ").slice(0, 90) + (text.length > 90 ? "…" : "");

const results: DatasetLine[] = [];
console.log(
  `${posts.length} posts, ${posts.filter((p) => p.labels).length} labelled, threshold ${threshold}\n`,
);

for (const model of models) {
  for (const [questionsName, questions] of questionSets) {
    const run = await decide(
      posts.map((p) => ({ id: p.uri, state: p.state })),
      questions,
      { apiKey, model },
    ).catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
    const answers = withDerivedTags(run.answers);
    const judged = posts.map((p) => ({ ...p, answers: answers.get(p.uri) }));
    const scores = scoreTags(judged, tags, threshold);

    console.log(
      `## ${model} · questions: ${questionsName} · cost $${run.cost.toFixed(5)}` +
        (run.failed ? ` · ${run.failed} failed (${run.lastError})` : ""),
    );
    console.log("tag                 n  precision recall accuracy");
    for (const tag of tags) {
      const s = scores[tag];
      if (!s?.labelled) continue;
      console.log(
        `${tag.padEnd(18)} ${String(s.labelled).padStart(2)}  ${percent(s.precision)}      ${percent(s.recall)}   ${percent(s.accuracy)}`,
      );
    }

    const misses = judged.flatMap((p) =>
      Object.entries(p.labels ?? {}).flatMap(([tag, expected]) => {
        const probability = p.answers?.[tag];
        if (probability === undefined || Number.isNaN(probability)) return [];
        return probability >= threshold === expected
          ? []
          : [
              `  ${expected ? "missed" : "wrong "} ${tag} (${percent(probability)}) ${postUrl(p.uri)}\n         ${shorten(p.state.post)}`,
            ];
      }),
    );
    console.log(
      misses.length
        ? `Disagreements:\n${misses.join("\n")}\n`
        : "No disagreements.\n",
    );

    for (const p of judged) {
      results.push({
        uri: p.uri,
        url: postUrl(p.uri),
        created_at: p.created_at,
        type: p.type,
        state: p.state,
        model,
        questions_version: questionsVersion(questions, model),
        answers: p.answers,
        labels: p.labels,
      });
    }
  }
}

if (values.out) {
  writeFileSync(
    values.out,
    results.map((r) => JSON.stringify(r)).join("\n") + "\n",
  );
  console.log(`Wrote ${results.length} answers to ${values.out}`);
}
