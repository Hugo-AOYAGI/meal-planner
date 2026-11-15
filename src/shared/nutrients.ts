/**
 * Extra nutrition values shown as the recipe "Détail", per 100 g on ingredients and per
 * person on recipes. They come from Ciqual only: `ciqual` is the column title of the Ciqual
 * table without its "(unit 100 g)" suffix; several columns are summed.
 * To add a value: add one line here, then run `bun run seed:ciqual`.
 */
export const EXTRA_NUTRIENT_GROUPS = {
  fats: "Lipides",
  carbsSalt: "Glucides · sel",
  minerals: "Minéraux",
  vitamins: "Vitamines",
} as const;
export type ExtraNutrientGroup = keyof typeof EXTRA_NUTRIENT_GROUPS;

interface ExtraNutrientDef {
  key: string;
  label: string;
  unit: "g" | "mg" | "µg";
  group: ExtraNutrientGroup;
  ciqual: string | readonly string[];
}

export const EXTRA_NUTRIENTS = [
  { key: "saturatedFat", label: "Saturés", unit: "g", group: "fats", ciqual: "AG saturés" },
  { key: "monoFat", label: "Mono-insaturés", unit: "g", group: "fats", ciqual: "AG monoinsaturés" },
  { key: "polyFat", label: "Poly-insaturés", unit: "g", group: "fats", ciqual: "AG polyinsaturés" },
  // Ciqual has no omega-3 total: sum of the three it lists (ALA, EPA, DHA).
  {
    key: "omega3",
    label: "Oméga-3",
    unit: "g",
    group: "fats",
    ciqual: [
      "AG 18:3 c9,c12,c15 (n-3), alpha-linolénique",
      "AG 20:5 5c,8c,11c,14c,17c (n-3) EPA",
      "AG 22:6 4c,7c,10c,13c,16c,19c (n-3) DHA",
    ],
  },
  { key: "sugars", label: "Sucres", unit: "g", group: "carbsSalt", ciqual: "Sucres" },
  { key: "salt", label: "Sel", unit: "g", group: "carbsSalt", ciqual: "Sel chlorure de sodium" },
  { key: "iron", label: "Fer", unit: "mg", group: "minerals", ciqual: "Fer" },
  { key: "calcium", label: "Calcium", unit: "mg", group: "minerals", ciqual: "Calcium" },
  { key: "magnesium", label: "Magnésium", unit: "mg", group: "minerals", ciqual: "Magnésium" },
  { key: "potassium", label: "Potassium", unit: "mg", group: "minerals", ciqual: "Potassium" },
  { key: "zinc", label: "Zinc", unit: "mg", group: "minerals", ciqual: "Zinc" },
  { key: "vitaminC", label: "Vitamine C", unit: "mg", group: "vitamins", ciqual: "Vitamine C" },
  { key: "vitaminD", label: "Vitamine D", unit: "µg", group: "vitamins", ciqual: "Vitamine D" },
  { key: "vitaminB12", label: "Vitamine B12", unit: "µg", group: "vitamins", ciqual: "Vitamine B12" },
  { key: "folate", label: "Folates (B9)", unit: "µg", group: "vitamins", ciqual: "Vitamine B9 ou Folates totaux" },
] as const satisfies readonly ExtraNutrientDef[];

export type ExtraNutrient = (typeof EXTRA_NUTRIENTS)[number]["key"];
export const EXTRA_NUTRIENT_KEYS = EXTRA_NUTRIENTS.map((n) => n.key) as [ExtraNutrient, ...ExtraNutrient[]];

/** Per-100 g extras of a food or ingredient; a missing key = unknown. */
export type Extras100 = Partial<Record<ExtraNutrient, number>>;
