import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { idSchema } from "@shared/schemas";
import { AppError } from "../../services/support/errors";

const json = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }] });

function failure(e: unknown) {
  const text =
    e instanceof AppError ? e.message : e instanceof z.ZodError ? `Entrée invalide : ${z.prettifyError(e)}` : "Erreur interne";
  if (!(e instanceof AppError || e instanceof z.ZodError)) console.error(e);
  return { content: [{ type: "text" as const, text }], isError: true };
}

/** A tool built from a zod object: input is parsed with the schema (applying defaults), errors become isError results. */
export function define<S extends z.ZodObject>(name: string, description: string, schema: S, run: (input: z.output<S>) => unknown) {
  return tool(name, description, schema.shape, async (args) => {
    try {
      return json(run(schema.parse(args)));
    } catch (e) {
      return failure(e);
    }
  });
}

export const withId = <S extends z.ZodObject>(patch: S) => z.object({ id: idSchema, ...patch.shape });
