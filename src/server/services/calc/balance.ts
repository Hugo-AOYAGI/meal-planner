/** What a person is meant to eat per day, in grams: the target a plan is measured against. */
const DAILY_PROTEIN = 60;
const DAILY_FIBRE = 25;
/** A meal this rich in a nutrient counts as fully making up for it. */
const RICH_PROTEIN = 30;
const RICH_FIBRE = 10;

export interface Nutrients {
  protein: number;
  fibre: number;
}

/**
 * Running protein and fibre of a plan, to favour the meals that make up for what it lacks.
 * `start` is the total already eaten over `days` days.
 */
export function createBalance(start: Nutrients & { days: number }) {
  let { days, protein, fibre } = start;
  const shortfall = (total: number, daily: number) => Math.max(0, daily * days - total) / (daily * days);
  return {
    /** A new day of the plan begins: its share of the targets counts from now on. */
    startDay: () => void days++,
    add(meal?: Nutrients) {
      if (!meal) return;
      protein += meal.protein;
      fibre += meal.fibre;
    },
    /** Weight multiplier of a meal, 1 or more; 1 for a meal whose nutrients are unknown. */
    bias(meal?: Nutrients) {
      if (!meal) return 1;
      return (
        1 +
        shortfall(protein, DAILY_PROTEIN) * Math.min(meal.protein / RICH_PROTEIN, 1) +
        shortfall(fibre, DAILY_FIBRE) * Math.min(meal.fibre / RICH_FIBRE, 1)
      );
    },
  };
}
