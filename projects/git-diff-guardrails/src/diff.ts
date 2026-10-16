export type FileStatus = "added" | "modified" | "deleted" | "renamed";

export interface AddedLine {
  /** 1-based line number in the new version of the file. */
  line: number;
  text: string;
}

export interface FileDiff {
  path: string;
  oldPath?: string;
  status: FileStatus;
  binary: boolean;
  added: AddedLine[];
}

const unquote = (p: string) =>
  p.startsWith('"') && p.endsWith('"') ? JSON.parse(p) as string : p;
const stripPrefix = (p: string) => unquote(p).replace(/^[ab]\//, "");

/** Parses `git diff` / `git show` unified output into per-file added lines. */
export function parseDiff(text: string): FileDiff[] {
  const files: FileDiff[] = [];
  let current: FileDiff | undefined;
  let newLine = 0;
  let inHunk = false;

  for (const raw of text.split("\n")) {
    if (raw.startsWith("diff --git ")) {
      const m = /^diff --git (?:"?a\/(.+?)"?) (?:"?b\/(.+?)"?)$/.exec(raw);
      current = { path: m?.[2] ?? "", oldPath: m?.[1], status: "modified", binary: false, added: [] };
      files.push(current);
      inHunk = false;
      continue;
    }
    if (!current) continue;

    if (!inHunk) {
      if (raw.startsWith("new file mode")) current.status = "added";
      else if (raw.startsWith("deleted file mode")) current.status = "deleted";
      else if (raw.startsWith("rename from ")) {
        current.status = "renamed";
        current.oldPath = unquote(raw.slice("rename from ".length));
      } else if (raw.startsWith("rename to ")) current.path = unquote(raw.slice("rename to ".length));
      else if (raw.startsWith("Binary files ") || raw.startsWith("GIT binary patch")) current.binary = true;
      else if (raw.startsWith("--- ")) {
        if (raw !== "--- /dev/null") current.oldPath = stripPrefix(raw.slice(4));
      } else if (raw.startsWith("+++ ")) {
        if (raw !== "+++ /dev/null") current.path = stripPrefix(raw.slice(4));
      }
    }

    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
    if (hunk) {
      inHunk = true;
      newLine = Number(hunk[1]);
      continue;
    }
    if (!inHunk) continue;

    if (raw.startsWith("+")) {
      current.added.push({ line: newLine, text: raw.slice(1) });
      newLine++;
    } else if (raw.startsWith(" ")) {
      newLine++;
    }
    // "-" lines and "\ No newline at end of file" don't advance the new-file counter.
  }

  for (const f of files) {
    if (f.status === "deleted" && f.oldPath) f.path = f.oldPath;
    if (f.status !== "renamed" && f.oldPath === f.path) delete f.oldPath;
  }
  return files;
}
