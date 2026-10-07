import { STOPWORDS } from "./stopwords";

/** Terms found in one post. */
export interface Terms {
  words: string[];
  hashtags: string[];
  /** DIDs of mentioned accounts. */
  mentions: string[];
  /** Hostnames of linked pages, without a leading www. */
  domains: string[];
}

interface Feature {
  $type?: string;
  tag?: string;
  did?: string;
  uri?: string;
}

interface Embed {
  $type?: string;
  external?: { uri?: string };
  media?: Embed;
}

interface PostRecord {
  text?: string;
  tags?: string[];
  facets?: { features?: Feature[] }[];
  embed?: Embed;
}

const MIN_WORD_LENGTH = 3;
const URL_PATTERN = /\bhttps?:\/\/\S+|\b[\w-]+(?:\.[\w-]+)+\/\S*/gu;
const HANDLE_OR_TAG = /[@#][\p{L}\p{N}_.-]+/gu;
const WORD = /[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu;
const ELISION = /^(?:[ldjmnstc]|qu)['’]/u;

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function domainOf(uri: string): string | undefined {
  try {
    return new URL(uri).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

function externalUris(embed: Embed | undefined): string[] {
  if (!embed) return [];
  if (embed.$type === "app.bsky.embed.external" && embed.external?.uri) {
    return [embed.external.uri];
  }
  return externalUris(embed.media);
}

function wordsOf(text: string): string[] {
  const cleaned = text.replace(URL_PATTERN, " ").replace(HANDLE_OR_TAG, " ");
  const words: string[] = [];
  for (const [token] of cleaned.toLowerCase().matchAll(WORD)) {
    const word = token.replace(/’/g, "'").replace(ELISION, "");
    if (word.length < MIN_WORD_LENGTH) continue;
    if (/^\p{N}+$/u.test(word)) continue;
    if (STOPWORDS.has(word)) continue;
    words.push(word);
  }
  return words;
}

/** Extracts words, hashtags, mentions and link domains from a post record. */
export function termsOf(record: object): Terms {
  const post = record as PostRecord;
  const features = (post.facets ?? []).flatMap((f) => f.features ?? []);
  const featuresOf = (type: string) =>
    features.filter((f) => f.$type === `app.bsky.richtext.facet#${type}`);

  const linkUris = [
    ...featuresOf("link").flatMap((f) => (f.uri ? [f.uri] : [])),
    ...externalUris(post.embed),
  ];

  return {
    words: wordsOf(post.text ?? ""),
    hashtags: unique(
      [
        ...featuresOf("tag").flatMap((f) => (f.tag ? [f.tag] : [])),
        ...(post.tags ?? []),
      ].map((t) => t.toLowerCase()),
    ),
    mentions: unique(
      featuresOf("mention").flatMap((f) => (f.did ? [f.did] : [])),
    ),
    domains: unique(linkUris.flatMap((u) => domainOf(u) ?? [])),
  };
}

export interface TermCount {
  term: string;
  count: number;
}

export type TopTerms = Record<keyof Terms, TermCount[]>;

const TERM_KINDS = ["words", "hashtags", "mentions", "domains"] as const;

function rank(values: string[], limit: number): TermCount[] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts]
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term))
    .slice(0, limit);
}

/** Most frequent terms of each kind across many posts. */
export function topTerms(posts: Terms[], limit = 50): TopTerms {
  return Object.fromEntries(
    TERM_KINDS.map((kind) => [
      kind,
      rank(
        posts.flatMap((p) => p[kind]),
        limit,
      ),
    ]),
  ) as TopTerms;
}
