import type { UIMessageChunk } from "ai";
import { isNull } from "drizzle-orm";
import { db } from "../db";
import { recipe } from "../db/schema";
import { emitChanged } from "../events";
import { AISLE_LABELS, AISLES } from "@shared/constants";
import { listMeals } from "../services/catalog/meals";
import { sortExtras, unsortedExtras } from "../services/planning/shopping";
import { getSettings } from "../services/support/settings";
import { isBusy, startRun } from "./runtime/live-run";
import { askOnce, runTurn } from "./runtime/providers";

/** The draw's "Nouveau" card wants this many assistant ideas in stock. */
const IDEAS_STOCK = 3;
const MAX_DURATIONS_PER_RUN = 40;
const STARTUP_DELAY_MS = 5 * 60_000;

/** The jobs worth running now, as prompts for the assistant; empty when there is nothing to do. */
export function pendingJobs(): { name: string; prompt: string }[] {
  const jobs: { name: string; prompt: string }[] = [];
  const missing = db
    .select({ id: recipe.id, name: recipe.name, mealId: recipe.mealId, steps: recipe.steps })
    .from(recipe)
    .where(isNull(recipe.durationMin))
    .limit(MAX_DURATIONS_PER_RUN)
    .all();
  if (missing.length) {
    const list = missing.map((r) => `- recette ${r.id} « ${r.name} » : ${r.steps.join(" / ") || "(pas d'étapes)"}`).join("\n");
    jobs.push({
      name: "durations",
      prompt: `Tâche de fond, sans utilisateur. Estime la durée totale (préparation + cuisson, en minutes) de chacune de ces recettes à partir de leurs étapes, puis enregistre-la avec update_recipe (champ durationMin uniquement, ne modifie rien d'autre). Si une recette n'a pas d'étapes, déduis la durée de son nom. Ne réponds rien d'autre qu'un court bilan.\n\n${list}`,
    });
  }
  const ideas = listMeals({ status: "idea" }).length;
  if (ideas < IDEAS_STOCK) {
    jobs.push({
      name: "ideas",
      prompt: `Tâche de fond, sans utilisateur. Prépare ${IDEAS_STOCK - ideas} idée(s) de plat que le foyer n'a jamais faite(s), pour la carte « Nouveau » du tirage au sort. Pour chacune :
- vérifie avec list_meals (et list_meals status "idea") qu'aucun repas proche n'existe ;
- choisis un plat complet (kind "plat"), de saison, réaliste un soir de semaine, varié par rapport à la bibliothèque, et qui respecte les préférences du foyer ;
- trouve une recette fiable sur le web ou adapte-en une ;
- crée le repas avec create_meal et status "idea" (jamais "regular" ni "to_try"), puis sa recette complète avec create_recipe (ingrédients existants réutilisés, grammes renseignés, durationMin renseigné, sourceUrl si elle vient du web).
Ne réponds rien d'autre qu'un court bilan.`,
    });
  }
  return jobs;
}

/** Runs one job through the chat's single run slot, so it never overlaps a conversation. */
async function runJob(job: { name: string; prompt: string }): Promise<void> {
  const run = startRun(`background:${job.name}`, (signal) => {
    const turn = runTurn({
      assistant: getSettings().assistant,
      input: { text: job.prompt, images: [], signal },
      storedSession: null,
      history: [],
      saveSession: () => {},
    });
    return new ReadableStream<UIMessageChunk>({
      async pull(controller) {
        const next = await turn.next();
        if (next.done) controller.close();
        else controller.enqueue(next.value);
      },
    });
  });
  while (!run.done) await new Promise<void>((resolve) => run.waiting.add(resolve));
  emitChanged();
}

let running = false;

/** Runs the pending jobs one after the other, unless the assistant is busy with a conversation. */
export async function runBackgroundJobs(): Promise<void> {
  if (running) return;
  running = true;
  try {
    for (const job of pendingJobs()) {
      if (isBusy()) return; // someone is chatting: try again next time
      await runJob(job).catch((e) => console.error(`background job ${job.name} failed`, e));
    }
  } finally {
    running = false;
  }
}

let sorting = false;

/**
 * Sorts the hand-added shopping lines the ingredients could not place: one short question to the assistant, outside the
 * chat's run slot (it is quick and writes nothing else). Lines added meanwhile are sorted by the next pass; on failure
 * they stay unsorted until the next line added or the next start.
 */
export async function classifyExtras(ask = (prompt: string) => askOnce(getSettings().assistant, prompt)): Promise<void> {
  if (sorting) return;
  sorting = true;
  try {
    const tried = new Set<number>();
    for (let todo = unsortedExtras(); todo.length; todo = unsortedExtras().filter((e) => !tried.has(e.id))) {
      todo.forEach((e) => tried.add(e.id));
      const aisles = AISLES.map((a) => `- ${a} : ${AISLE_LABELS[a]}`).join("\n");
      const lines = todo.map((e) => `- ${e.id} : ${e.label}`).join("\n");
      const answer = await ask(
        `Range chaque article de liste de courses dans le rayon d'un supermarché français où on le trouve.\n\nRayons :\n${aisles}\n\nArticles (id : libellé) :\n${lines}\n\nRéponds uniquement par un objet JSON {"<id>": "<rayon>"} avec un code de rayon de la liste, "autre" si aucun ne va.`,
      );
      const json = answer.match(/\{[\s\S]*\}/)?.[0];
      if (!json) throw new Error(`classifyExtras: no JSON in ${answer.slice(0, 200)}`);
      const parsed = JSON.parse(json) as Record<string, unknown>;
      sortExtras(Object.fromEntries(todo.map((e) => [e.id, String(parsed[e.id] ?? "autre")])));
      emitChanged();
    }
  } catch (e) {
    console.error("classifyExtras failed", e);
  } finally {
    sorting = false;
  }
}

/** Runs the jobs a few minutes after start, then every night at 03:30 (after the backup). */
export function scheduleBackgroundJobs(): void {
  setTimeout(() => void runBackgroundJobs(), STARTUP_DELAY_MS).unref();
  setTimeout(() => void classifyExtras(), 10_000).unref(); // lines added while the assistant could not sort them
  const next = new Date();
  next.setHours(3, 30, 0, 0);
  if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
  setTimeout(() => {
    void runBackgroundJobs();
    scheduleNightly();
  }, next.getTime() - Date.now()).unref();
}

function scheduleNightly(): void {
  setTimeout(() => {
    void runBackgroundJobs();
    scheduleNightly();
  }, 24 * 60 * 60_000).unref();
}
