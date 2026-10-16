const cache = new Map<string, RegExp>();

/**
 * Converts a gitignore-style glob to a RegExp. Supports `**`, `*`, `?`, `{a,b}` and `[...]`.
 * A pattern without a `/` matches at any depth (`*.db` matches `a/b/c.db`).
 */
export function globToRegExp(glob: string): RegExp {
  const hit = cache.get(glob);
  if (hit) return hit;

  let g = glob.startsWith("./") ? glob.slice(2) : glob;
  if (g.startsWith("/")) g = g.slice(1);
  else if (!g.includes("/")) g = `**/${g}`;
  if (g.endsWith("/")) g += "**";

  let re = "";
  let braces = 0;
  for (let i = 0; i < g.length; i++) {
    const c = g[i]!;
    if (c === "*") {
      if (g[i + 1] === "*") {
        const atStart = i === 0 || g[i - 1] === "/";
        const atEnd = i + 2 === g.length || g[i + 2] === "/";
        if (atStart && atEnd) {
          // `**/` matches zero or more directories; trailing `**` matches everything below.
          re += i + 2 === g.length ? ".*" : "(?:.*/)?";
          i += 2;
          continue;
        }
        re += "[^/]*";
        i++;
        continue;
      }
      re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else if (c === "{") {
      braces++;
      re += "(?:";
    } else if (c === "}" && braces > 0) {
      braces--;
      re += ")";
    } else if (c === "," && braces > 0) re += "|";
    else if (c === "[") {
      const end = g.indexOf("]", i + 1);
      if (end === -1) re += "\\[";
      else {
        const body = g.slice(i + 1, end).replace(/^!/, "^").replace(/\\/g, "\\\\");
        re += `[${body}]`;
        i = end;
      }
    } else re += c.replace(/[.+^$()|\\\]]/g, "\\$&");
  }
  const compiled = new RegExp(`^${re}$`);
  cache.set(glob, compiled);
  return compiled;
}

export function matchesAny(path: string, globs: readonly string[] | undefined): boolean {
  return !!globs?.some((g) => globToRegExp(g).test(path));
}
