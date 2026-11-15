/**
 * `bun run seed:ciqual`: downloads the ANSES Ciqual 2025 table (Licence Ouverte / Etalab 2.0,
 * https://doi.org/10.57745/RDMHWY) into data/ciqual/ and imports it into `ciqual_food`.
 * Idempotent: the table is replaced in one transaction, and the detail values (`extras`) of
 * the ingredients that have a Ciqual code are copied again from it.
 */
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { readSheet } from "read-excel-file/node";
import { sql } from "drizzle-orm";
import { EXTRA_NUTRIENTS, type Extras100 } from "@shared/nutrients";
import { normalize } from "@shared/text";
import { DB_PATH, db } from "./db";
import { ciqualFood, ingredient } from "./db/schema";

const URL = "https://entrepot.recherche.data.gouv.fr/api/access/datafile/666260"; // Table Ciqual 2025_FR_2025_11_03.xlsx
const FILE = join(dirname(DB_PATH), "ciqual", "ciqual-2025.xlsx");

if (!existsSync(FILE)) {
  console.log("Downloading", URL);
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  mkdirSync(dirname(FILE), { recursive: true });
  await Bun.write(FILE, res);
}

/** French decimal commas; "< 0,5" and "traces" count as 0; "-" or empty = unknown. */
function parseValue(v: unknown): number | null {
  if (typeof v === "number") return v;
  const s = String(v ?? "").trim().toLowerCase();
  if (!s || s === "-") return null;
  if (s === "traces" || s.startsWith("<")) return 0;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

const rows = (await readSheet(FILE)) as unknown[][];
const header = rows[0]!.map((c) => String(c ?? "").replace(/\s+/g, " ").trim());
const col = (re: RegExp) => {
  const i = header.findIndex((h) => re.test(h));
  if (i < 0) throw new Error(`Column not found: ${re}`);
  return i;
};
const c = {
  code: col(/^alim_code$/),
  name: col(/^alim_nom_fr$/),
  group: col(/^alim_grp_nom_fr$/),
  kcal: col(/1169.*kcal/),
  protein: col(/^Protéines, N x facteur de Jones/),
  carbs: col(/^Glucides/),
  fat: col(/^Lipides/),
  fibre: col(/^Fibres alimentaires/),
};

/** Column indexes of each detail value, found by exact title so the unit is checked too. */
const extraCols = EXTRA_NUTRIENTS.map((n) => ({
  key: n.key,
  cols: [n.ciqual].flat().map((title) => {
    const i = header.indexOf(`${title} (${n.unit} 100 g)`);
    if (i < 0) throw new Error(`Column not found: ${title} (${n.unit} 100 g)`);
    return i;
  }),
}));
/** Known values only; summed columns need at least one known value. */
function extrasOf(r: unknown[]): Extras100 {
  const extras: Extras100 = {};
  for (const { key, cols } of extraCols) {
    const values = cols.map((i) => parseValue(r[i])).filter((v) => v !== null);
    if (values.length) extras[key] = Math.round(values.reduce((a, b) => a + b, 0) * 1e4) / 1e4;
  }
  return extras;
}

const clean = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();
const foods = rows.slice(1).flatMap((r) => {
  const code = clean(r[c.code]);
  const name = clean(r[c.name]);
  if (!code || !name) return [];
  const group = clean(r[c.group]);
  return [
    {
      code,
      name,
      nameNorm: normalize(name),
      groupName: group && group !== "-" ? group : null,
      kcal: parseValue(r[c.kcal]),
      protein: parseValue(r[c.protein]),
      carbs: parseValue(r[c.carbs]),
      fat: parseValue(r[c.fat]),
      fibre: parseValue(r[c.fibre]),
      extras: extrasOf(r),
    },
  ];
});

db.transaction((tx) => {
  tx.delete(ciqualFood).run();
  for (let i = 0; i < foods.length; i += 500) tx.insert(ciqualFood).values(foods.slice(i, i + 500)).run();
  tx.update(ingredient)
    .set({ extras: sql`(select ${ciqualFood.extras} from ${ciqualFood} where ${ciqualFood.code} = ${ingredient.ciqualCode})` })
    .where(sql`${ingredient.ciqualCode} is not null`)
    .run();
});
console.log(`Imported ${foods.length} Ciqual foods`);
