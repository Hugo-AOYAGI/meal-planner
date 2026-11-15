import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const maxFilesPerDirectory = 5;
const maxLinesPerFile = 250;
const generatedDirectory = join("src", "server", "db", "migrations");
const violations: string[] = [];

async function checkDirectory(directory: string): Promise<void> {
  // Drizzle owns the migration files and their snapshots.
  if (directory === generatedDirectory) return;

  const entries = await readdir(directory, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile());
  if (files.length > maxFilesPerDirectory) {
    violations.push(`${directory}: ${files.length} files (maximum ${maxFilesPerDirectory})`);
  }

  for (const file of files) {
    const path = join(directory, file.name);
    const contents = await readFile(path, "utf8");
    const lines = contents.length === 0 ? 0 : contents.split(/\r?\n/).length - Number(contents.endsWith("\n"));
    if (lines > maxLinesPerFile) {
      violations.push(`${path}: ${lines} lines (maximum ${maxLinesPerFile})`);
    }
  }

  for (const child of entries.filter((entry) => entry.isDirectory())) {
    await checkDirectory(join(directory, child.name));
  }
}

for (const directory of ["src", "tests"]) {
  await checkDirectory(directory);
}

if (violations.length > 0) {
  console.error(violations.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Source and test structure is within the file and line limits.");
}
