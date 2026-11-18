export type ReferenceTarget = { source: "reference" | "food-lab"; id: string };

export const referenceHref = ({ source, id }: ReferenceTarget) => `#${source}/${id}`;

export function parseReferenceHref(href?: string | null): ReferenceTarget | null {
  const match = href?.match(/^#(reference|food-lab)\/([\p{L}\p{N}][\p{L}\p{N}._-]{0,199})$/u);
  if (!match) return null;
  return { source: match[1] === "reference" ? "reference" : "food-lab", id: match[2]! };
}
