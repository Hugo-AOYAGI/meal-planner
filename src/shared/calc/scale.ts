/** Scaled value = stored value x requested servings / base servings. Nothing is re-estimated. */
export function scaleFactor(baseServings: number, servings: number): number {
  return baseServings > 0 ? servings / baseServings : 1;
}

export function scale(value: number | null, baseServings: number, servings: number): number | null {
  return value === null ? null : value * scaleFactor(baseServings, servings);
}
