import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const foodLabDirectory = () => resolve(
  process.env.MEAL_PLANNER_FOOD_LAB_DIR ?? join(homedir(), "Downloads", "The Food Lab", "agent-reader"),
);

/** The book lives on the application host and is served by its local MCP reader. */
export function foodLabReference() {
  const directory = foodLabDirectory();
  const reader = join(directory, "reader.py");
  const localUv = join(homedir(), ".local", "bin", "uv");
  const command = process.env.MEAL_PLANNER_FOOD_LAB_UV ?? (existsSync(localUv) ? localUv : Bun.which("uv"));
  if (!command || ![reader, join(directory, "catalog.json"), join(directory, "sections")].every(existsSync)) {
    return undefined;
  }
  try {
    const contents = readFileSync(join(directory, "TABLE-OF-CONTENTS.md"), "utf8").trim();
    if (contents) return { contents, server: { command, args: ["run", reader] } };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export async function readFoodLabSection(id: string) {
  if (!/^[\p{L}\p{N}][\p{L}\p{N}.-]{0,199}$/u.test(id)) return;
  const file = Bun.file(join(foodLabDirectory(), "sections", `${id}.md`));
  if (await file.exists()) return file.text();
}
