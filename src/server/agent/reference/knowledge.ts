import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const legacyDirectory = () => resolve(
  process.env.MEAL_PLANNER_FOOD_LAB_DIR ?? join(homedir(), "Downloads", "The Food Lab", "agent-reader"),
);

export function knowledgeDirectory() {
  if (process.env.MEAL_PLANNER_KNOWLEDGE_DIR) return resolve(process.env.MEAL_PLANNER_KNOWLEDGE_DIR);
  const directory = resolve("data/knowledge");
  return existsSync(directory) ? directory : legacyDirectory();
}

function readText(path: string) {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export const knowledgeContents = () => readText(join(knowledgeDirectory(), "TABLE-OF-CONTENTS.md"))?.trim();

const validId = (id: string) => /^[\p{L}\p{N}][\p{L}\p{N}._-]{0,199}$/u.test(id);

export function readReference(id: string, directory = knowledgeDirectory()) {
  if (validId(id)) return readText(join(directory, "sections", `${id}.md`));
}

/** Old messages already contain this book's original citation prefix. */
export function readLegacyReference(id: string) {
  return readReference(id, legacyDirectory());
}

const tokens = (text: string) => text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

/** Match exact words (including inflections) or a one-edit typo, including transpositions. */
function similarity(query: string, word: string) {
  if (query === word) return 1;
  if (word === `${query}s` || query === `${word}s`) return 0.92;
  if (query.length < 4 || Math.abs(query.length - word.length) > 1) return 0;
  let index = 0;
  while (query[index] === word[index] && index < query.length) index++;
  const a = query.slice(index);
  const b = word.slice(index);
  if (a.slice(1) === b || a === b.slice(1) || a.slice(1) === b.slice(1)) return 0.72;
  return a[0] === b[1] && a[1] === b[0] && a.slice(2) === b.slice(2) ? 0.72 : 0;
}

type SearchOptions = { query: string; chapter_id?: string; limit: number; offset: number };

export function searchReferences({ query, chapter_id, limit, offset }: SearchOptions, headingsOnly: boolean) {
  const directory = knowledgeDirectory();
  const sections = join(directory, "sections");
  if (!existsSync(sections)) return { results: [], total: 0, next_offset: null };
  const files = readdirSync(sections, { withFileTypes: true });
  const terms = [...new Set(tokens(query))].slice(0, 12);
  const matches = new Map<string, number[]>();
  const scoresFor = (word: string) => {
    let scores = matches.get(word);
    if (!scores) {
      scores = terms.map((term) => similarity(term, word));
      matches.set(word, scores);
    }
    return scores;
  };
  const ranked = [];
  for (const file of files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))) {
    if (!file.isFile() || !file.name.endsWith(".md")) continue;
    const id = file.name.slice(0, -3);
    const chapter = id.split(".")[0]!;
    if (chapter_id && chapter !== chapter_id) continue;
    const markdown = readReference(id, directory);
    if (!markdown) continue;
    const title = /^#\s+(.+)/m.exec(markdown)?.[1]?.trim() ?? id;
    const metadata = { id, title, chapter_id: chapter };
    if (terms.length === 0) {
      if (!query.trim()) ranked.push({ score: 0, result: metadata });
      continue;
    }
    const headingScores = terms.map(() => 0);
    for (const word of new Set(tokens(title))) {
      scoresFor(word).forEach((score, index) => { headingScores[index] = Math.max(headingScores[index]!, score); });
    }
    const bodyScores = terms.map(() => 0);
    let excerpt = "";
    let bestExcerpt = 0;
    if (!headingsOnly) {
      for (const paragraph of markdown.split(/\n\s*\n/)) {
        let paragraphScore = 0;
        for (const word of new Set(tokens(paragraph))) {
          scoresFor(word).forEach((score, index) => {
            bodyScores[index] = Math.max(bodyScores[index]!, score);
            paragraphScore += score;
          });
        }
        if (paragraphScore > bestExcerpt) {
          bestExcerpt = paragraphScore;
          excerpt = paragraph.replace(/\s+/g, " ").slice(0, 240);
        }
      }
    }
    const strength = headingScores.map((score, index) => score * 4 + bodyScores[index]!);
    const coverage = strength.filter(Boolean).length / terms.length;
    const score = strength.reduce((sum, value) => sum + value, 0) * coverage ** 2;
    if (score) ranked.push({ score, result: { ...metadata, ...(excerpt ? { excerpt } : {}) } });
  }
  ranked.sort((a, b) => b.score - a.score);
  return {
    results: ranked.slice(offset, offset + limit).map(({ result }) => result),
    total: ranked.length,
    next_offset: offset + limit < ranked.length ? offset + limit : null,
  };
}
