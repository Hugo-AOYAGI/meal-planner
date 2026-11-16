import type { GameCard } from "@shared/schemas";
import { deleteMeal, getMeal, updateMeal } from "../catalog/meals";
import { applySuggestions } from "../planning/draw";
import { slotKey } from "./deal";
import { countIdeaRefusal, removeFromReserve, type Game } from "./store";

/** An assistant idea refused this many times is dropped. */
const IDEA_REFUSALS_MAX = 3;

/** A card refused in catch-up is not dealt again in this game; an assistant idea refused too often is deleted. */
export function refuse(game: Game, card: GameCard): void {
  game.refused.push(...card.meals.map((m) => m.id));
  if (card.tag !== "new") return;
  const meal = getMeal(card.meals[0]!.id);
  if (meal.status === "idea" && countIdeaRefusal(meal.id) >= IDEA_REFUSALS_MAX) deleteMeal(meal.id);
}

/**
 * Writes the placed matches into the plan, all or none (a slot changed meanwhile refuses the whole set).
 * Planned assistant ideas become meals to try; planned reserve cards leave the reserve.
 */
export function validate(game: Game): void {
  const byId = new Map(game.matches.map((c) => [c.id, c]));
  const placed = game.slots.flatMap((slot) => {
    const card = byId.get(game.placement[slotKey(slot)] ?? "");
    return card ? [{ slot, card }] : [];
  });
  if (placed.length) applySuggestions(placed.map(({ slot, card }) => ({ ...slot, meals: card.meals })));
  for (const { card } of placed) {
    for (const { id } of card.meals) if (getMeal(id).status === "idea") updateMeal(id, { status: "to_try" });
  }
  removeFromReserve(placed.map(({ card }) => card.meals[0]!.id));
  game.phase = "done";
}
