import { describe, expect, it } from "vitest";
import { parseDiff } from "./diff.ts";

const sample = `diff --git a/src/app.ts b/src/app.ts
index 1111111..2222222 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -3,0 +4,2 @@ import x from "x";
+console.log("hi");
+const y = 1;
@@ -10 +12 @@ function f() {
-  old();
+  neu();
diff --git a/.env b/.env
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/.env
@@ -0,0 +1 @@
+SECRET=1
diff --git a/gone.ts b/gone.ts
deleted file mode 100644
index 4444444..0000000
--- a/gone.ts
+++ /dev/null
@@ -1 +0,0 @@
-bye
diff --git a/old/name.ts b/new/name.ts
similarity index 90%
rename from old/name.ts
rename to new/name.ts
index 5555555..6666666 100644
--- a/old/name.ts
+++ b/new/name.ts
@@ -1 +1 @@
-a
+b
diff --git a/logo.png b/logo.png
new file mode 100644
index 0000000..7777777
Binary files /dev/null and b/logo.png differ
`;

describe("parseDiff", () => {
  const files = parseDiff(sample);

  it("tracks added lines with new-file line numbers", () => {
    expect(files[0]).toMatchObject({ path: "src/app.ts", status: "modified" });
    expect(files[0]!.added).toEqual([
      { line: 4, text: 'console.log("hi");' },
      { line: 5, text: "const y = 1;" },
      { line: 12, text: "  neu();" },
    ]);
  });

  it("detects added, deleted, renamed, and binary files", () => {
    expect(files.map((f) => [f.path, f.status])).toEqual([
      ["src/app.ts", "modified"],
      [".env", "added"],
      ["gone.ts", "deleted"],
      ["new/name.ts", "renamed"],
      ["logo.png", "added"],
    ]);
    expect(files[3]!.oldPath).toBe("old/name.ts");
    expect(files[4]!.binary).toBe(true);
    expect(files[2]!.added).toEqual([]);
  });

  it("does not mistake added lines starting with +++ or --- for headers", () => {
    const [f] = parseDiff(`diff --git a/a.md b/a.md
--- a/a.md
+++ b/a.md
@@ -1,0 +2,2 @@
++++ not a header
+--- also content
`);
    expect(f!.added.map((l) => l.text)).toEqual(["+++ not a header", "--- also content"]);
  });

  it("returns nothing for an empty diff", () => {
    expect(parseDiff("")).toEqual([]);
  });
});
