import type { Nutrient } from "./constants";
import type { ExtraNutrient } from "./nutrients";

/** Who the reference intakes are for. */
export const REFERENCE_PROFILE = "homme sportif, 55 kg";
export const REFERENCE_SOURCES =
  "Repères indicatifs pour un jeune homme sportif de 55 kg : ANSES (fibres, sel, minéraux, vitamines, acides gras) et nutrition du sport (énergie, protéines, glucides). Pas un avis médical.";

/** A daily reference: to reach (`min`), to aim at (`goal`) or not to exceed (`max`). */
export interface DailyTarget {
  kind: "min" | "goal" | "max";
  value: number;
}

const WEIGHT_KG = 55;
/** Daily energy: resting needs (~1 550 kcal at 55 kg) x 1.8 for a sporty lifestyle. */
const ENERGY_KCAL = 2800;

/** Per person and per day. Energy and macros follow body weight; the rest are adult male references. */
export const DAILY_TARGETS: Record<Nutrient | ExtraNutrient, DailyTarget> = {
  kcal: { kind: "goal", value: ENERGY_KCAL },
  protein: { kind: "goal", value: Math.round(1.6 * WEIGHT_KG) }, // 1.2-2.0 g/kg for training
  carbs: { kind: "goal", value: 6 * WEIGHT_KG }, // 5-7 g/kg for moderate to high training
  fat: { kind: "goal", value: Math.round((0.3 * ENERGY_KCAL) / 9) }, // 30 % of energy
  fibre: { kind: "min", value: 30 },
  saturatedFat: { kind: "max", value: Math.round((0.12 * ENERGY_KCAL) / 9) }, // 12 % of energy
  monoFat: { kind: "min", value: Math.round((0.15 * ENERGY_KCAL) / 9) }, // 15 % of energy
  polyFat: { kind: "min", value: Math.round((0.055 * ENERGY_KCAL) / 9) }, // linoleic 4 % + alpha-linolenic 1 % + EPA/DHA
  omega3: { kind: "min", value: 3.6 }, // alpha-linolenic 1 % of energy + 0.5 g EPA/DHA
  sugars: { kind: "max", value: 100 },
  salt: { kind: "max", value: 6 },
  iron: { kind: "min", value: 11 },
  calcium: { kind: "min", value: 1000 },
  magnesium: { kind: "min", value: 380 },
  potassium: { kind: "min", value: 3500 },
  zinc: { kind: "min", value: 12 },
  vitaminC: { kind: "min", value: 110 },
  vitaminD: { kind: "min", value: 15 },
  vitaminB12: { kind: "min", value: 4 },
  folate: { kind: "min", value: 330 },
};

/** How much of the daily reference an amount is, as a fraction (0.36 = 36 %). */
export const shareOfTarget = (key: Nutrient | ExtraNutrient, amount: number) => amount / DAILY_TARGETS[key].value;
