import { describe, expect, it } from "vitest";
import { globToRegExp, matchesAny } from "./glob.ts";

const m = (glob: string, path: string) => globToRegExp(glob).test(path);

describe("globToRegExp", () => {
  it("matches basename globs at any depth", () => {
    expect(m("*.db", "local.db")).toBe(true);
    expect(m("*.db", "a/b/local.db")).toBe(true);
    expect(m(".env", "apps/factory/.env")).toBe(true);
    expect(m(".env.*", "apps/.env.local")).toBe(true);
    expect(m(".env", ".env.example")).toBe(false);
  });

  it("anchors globs that contain a slash", () => {
    expect(m("src/*.ts", "src/a.ts")).toBe(true);
    expect(m("src/*.ts", "src/x/a.ts")).toBe(false);
    expect(m("src/*.ts", "lib/src/a.ts")).toBe(false);
    expect(m("/README.md", "README.md")).toBe(true);
  });

  it("supports **, braces, ? and classes", () => {
    expect(m("apps/factory/src/**", "apps/factory/src/pages/index.astro")).toBe(true);
    expect(m("apps/**/*.ts", "apps/a.ts")).toBe(true);
    expect(m("apps/**/*.ts", "apps/x/y/a.ts")).toBe(true);
    expect(m("**/*.{test,spec}.ts", "src/a.spec.ts")).toBe(true);
    expect(m("**/*.{test,spec}.ts", "src/a.ts")).toBe(false);
    expect(m("file?.txt", "file1.txt")).toBe(true);
    expect(m("v[0-9].md", "v3.md")).toBe(true);
    expect(m("migrations/", "migrations/0001.sql")).toBe(true);
  });

  it("escapes regex characters", () => {
    expect(m("a+b.(x).ts", "a+b.(x).ts")).toBe(true);
    expect(m("a.ts", "abts")).toBe(false);
  });

  it("matchesAny handles undefined", () => {
    expect(matchesAny("a.ts", undefined)).toBe(false);
    expect(matchesAny("a.ts", ["*.js", "*.ts"])).toBe(true);
  });
});
