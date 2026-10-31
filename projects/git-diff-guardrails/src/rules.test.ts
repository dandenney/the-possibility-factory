import { describe, expect, it } from "vitest";
import type { Config } from "./config.ts";
import type { FileDiff } from "./diff.ts";
import { evaluate, isSuppressed } from "./rules.ts";

const file = (path: string, lines: string[] = [], status: FileDiff["status"] = "modified"): FileDiff => ({
  path,
  status,
  binary: false,
  added: lines.map((text, i) => ({ line: i + 1, text })),
});

const config: Config = {
  version: 1,
  rules: [
    {
      id: "use-logger",
      type: "line",
      pattern: "console\\.(log|error)\\(",
      paths: ["src/**"],
      exclude: ["src/lib/logger.ts"],
      message: "Use the logger from @/lib/logger.",
    },
    { id: "no-db-files", type: "file", paths: ["*.db"], message: "Don't commit database files." },
    { id: "no-edit-migrations", type: "file", paths: ["migrations/*.sql"], on: ["modified", "deleted"], message: "Never edit applied migrations." },
    { id: "schema-needs-migration", type: "cochange", paths: ["src/schema.ts"], require: ["migrations/**"], severity: "warn", message: "Run db:generate." },
  ],
};

describe("evaluate", () => {
  it("flags matching added lines in scope only", () => {
    const v = evaluate(
      [
        file("src/app.ts", ["const a = 1;", 'console.log("x");']),
        file("src/lib/logger.ts", ["console.log(msg);"]),
        file("scripts/run.ts", ["console.log(1);"]),
      ],
      config,
    );
    expect(v).toEqual([
      { ruleId: "use-logger", severity: "error", message: "Use the logger from @/lib/logger.", path: "src/app.ts", line: 2, text: 'console.log("x");' },
    ]);
  });

  it("respects file statuses", () => {
    const v = evaluate(
      [
        file("local.db", [], "added"),
        file("migrations/0001.sql", ["x"], "modified"),
        file("migrations/0002.sql", ["y"], "added"),
      ],
      config,
    );
    expect(v.map((x) => [x.ruleId, x.path])).toEqual([
      ["no-db-files", "local.db"],
      ["no-edit-migrations", "migrations/0001.sql"],
    ]);
  });

  it("checks co-changes", () => {
    expect(evaluate([file("src/schema.ts", ["x"])], config).map((v) => v.ruleId)).toEqual(["schema-needs-migration"]);
    expect(evaluate([file("src/schema.ts", ["x"]), file("migrations/0002.sql", ["y"], "added")], config)).toEqual([]);
  });

  it("ignores deleted files, the config file, and configured ignores", () => {
    const withIgnore: Config = { ...config, ignore: ["src/generated/**"] };
    const v = evaluate(
      [
        file("src/old.ts", ["console.log(1)"], "deleted"),
        file(".diffrails.json", ['"pattern": "console\\\\.log("']),
        file("src/generated/api.ts", ["console.log(1)"]),
      ],
      withIgnore,
    );
    expect(v).toEqual([]);
  });

  it("honors diffrails-ignore comments", () => {
    const v = evaluate([file("src/a.ts", ["console.log(1); // diffrails-ignore", "console.log(2); // diffrails-ignore: other-rule"])], config);
    expect(v.map((x) => x.line)).toEqual([2]);
  });
});

describe("isSuppressed", () => {
  it("parses rule lists", () => {
    expect(isSuppressed("x // diffrails-ignore", "a")).toBe(true);
    expect(isSuppressed("x // diffrails-ignore: a, b", "b")).toBe(true);
    expect(isSuppressed("x // diffrails-ignore: a, b", "c")).toBe(false);
    expect(isSuppressed("x", "a")).toBe(false);
  });
});
