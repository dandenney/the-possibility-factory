export function str(form: FormData, key: string): string | undefined {
  const value = form.get(key);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

export function oneOf<T extends string>(value: string | null | undefined, options: readonly T[]): T | undefined {
  return options.includes(value as T) ? (value as T) : undefined;
}

export function ids(values: (string | null | undefined)[]): number[] {
  return [...new Set(values.flatMap((v) => (v ?? "").split(",")).map(Number))].filter(
    (n) => Number.isInteger(n) && n > 0,
  );
}

export function safeNext(next: string | null | undefined, fallback = "/"): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
