import type { IdeaWithSignals } from "@factory/core";

type PromptIdea = Pick<IdeaWithSignals, "id" | "title" | "pitch" | "notes" | "origin" | "signals">;

const REPO = "dandenney/the-possibility-factory";
const GITHUB_REPO_ID = 1421231316;
const NETLIFY_INSTALLATION_ID = 839253;

export function suggestSlug(title: string): string {
  return (
    (title.split(":")[0] ?? title)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40)
      .replace(/-+$/, "") || "new-project"
  );
}

function ideaBlock(idea?: PromptIdea): string {
  if (!idea) {
    return [
      "- Number: #<N>",
      "- Title: <title>",
      "- Origin: <automation | manual>",
      "- Pitch: <pitch>",
      "- Why now: <why now>",
      "- Sparked by: <links>",
    ].join("\n");
  }
  const links = idea.signals.filter((s, i, all) => all.findIndex((o) => o.title === s.title) === i);
  return [
    `- Number: #${idea.id}`,
    `- Title: ${idea.title}`,
    `- Origin: ${idea.origin}`,
    `- Pitch: ${idea.pitch?.trim() || "(none)"}`,
    `- ${idea.origin === "automation" ? "Why now" : "Notes"}: ${idea.notes?.trim() || "(none)"}`,
    "- Sparked by:",
    ...(links.length ? links.map((s) => `  - ${s.url ? `[${s.title}](${s.url})` : s.title}`) : ["  - (none)"]),
  ].join("\n");
}

/** The prompt Dan pastes into any coding agent to build and deploy one shortlisted idea. */
export function buildPrompt(idea?: PromptIdea): string {
  const n = idea ? String(idea.id) : "<N>";
  const slug = idea ? suggestSlug(idea.title) : "<slug>";
  return `You're building one idea from my Possibility Factory into a small, public, shareable web toy, then deploying it. Repo: \`${REPO}\` (clone it or use your local checkout, on \`main\`). Read \`AGENTS.md\`, \`projects/README.md\`, and \`projects/deslop-detector/\` end to end before writing code; it's the reference project.

## Idea
${ideaBlock(idea)}

## Hard rules
- Commit straight to \`main\` and push. Do not open a branch or a PR, even if your defaults say to.
- Everything lives in \`projects/${slug}/\` (rename the slug if you have a better short kebab-case name; it is also the Netlify site name and URL). Touch nothing outside it.
- No hosted model calls, analytics, or paid API calls on the public site or by you. If the toy needs LLM output, add a script that pre-generates it, and list it in the handoff instead of running it.
- Don't touch the factory database or the idea's status. Dan marks it shipped on the board.

## Build
- Match the existing projects: static Vite + TypeScript with its own \`package.json\`, \`pnpm-lock.yaml\`, \`pnpm-workspace.yaml\` and \`tsconfig.json\`. No imports from \`apps/\` or \`packages/\`, and it isn't a root workspace member.
- Keep v0.1 small and fun. Write the scope into SPEC.md before building.
- Mobile-first (no horizontal scroll at 390px) and shareable: a share card or link if it fits, plus the og/twitter \`<meta>\` block from \`projects/deslop-detector/index.html\` pointing at \`https://${slug}.netlify.app/og.png\`.
- UI taste: light paper background, one accent color, thin rules, a quiet layout. Think Grammarly, not a dashboard; no dark many-color palettes. If you have the Impeccable skill (pbakaus/impeccable), make it your only design skill: run its \`init\` (answer from SPEC.md, mark guesses as inferred; it writes \`PRODUCT.md\`) and a critique pass before the first push.
- If it needs data a web page can't read (local machine stats and the like), serve a small script from the site that opens the page pre-filled via URL params, with manual entry as the fallback. No honor-system forms.

## Required files (dandenney.com/factory parses these, so keep the format exact)
- \`SPEC.md\`: \`# <Idea title>\`, then \`Idea #${n} from the factory board (origin: <automation|manual>, shortlisted by Dan).\`, then \`## Pitch\`, \`## Why now\`, \`## Sparked by\` (markdown links) and \`## Scope for v0.1\` (bullets).
- \`README.md\`: \`# <Project name>\`, a one-paragraph plain-English description, a line \`Live: https://${slug}.netlify.app\`, then a few bullets.
- \`AGENTS.md\`: install/dev/gate commands, the deploy note (Netlify site \`${slug}\`, base directory \`projects/${slug}\`), layout and rules, shaped like deslop-detector's.
- \`netlify.toml\`: copy deslop-detector's, change the comment, and keep \`ignore = "git diff --quiet $CACHED_COMMIT_REF $COMMIT_REF -- ."\`.

## Gate and push
- In the project dir, \`pnpm check\` must pass (typecheck, Vitest cases for the non-UI logic, build).
- Run \`pnpm install\` once at the repo root so the diffrails pre-commit hook is active. Fix violations; never use \`--no-verify\`.
- Commit \`feat(<scope>): <what it is> for idea #${n}\` and push to \`main\`.

## Deploy (needs \`NETLIFY_AUTH_TOKEN\`; if you don't have it, skip to the handoff)
1. After the push, create the site linked to the repo so \`main\` builds it from now on:
   \`\`\`
   curl -sS -X POST https://api.netlify.com/api/v1/dandenney/sites \\
     -H "Authorization: Bearer $NETLIFY_AUTH_TOKEN" -H "Content-Type: application/json" \\
     -d '{"name":"${slug}","repo":{"provider":"github","repo":"${REPO}","id":${GITHUB_REPO_ID},"installation_id":${NETLIFY_INSTALLATION_ID},"branch":"main","base":"projects/${slug}","cmd":"pnpm install --frozen-lockfile && pnpm build","dir":"projects/${slug}/dist"}}'
   \`\`\`
   If the name is taken, pick another and update the URLs in README.md and index.html.
2. If no build starts within a minute, \`POST https://api.netlify.com/api/v1/sites/<site id>/builds\`. Poll \`GET /api/v1/sites/<site id>/deploys?per_page=1\` until \`state\` is \`ready\`. Don't upload with \`netlify deploy\`; the live site must come from the Git build.
3. Open the live URL in a real browser at desktop and 390px width and fix anything broken.
4. Render \`public/og.png\` (exactly 1200x630) from the live site in its best-looking state; don't hand-draw it. Commit it as \`chore(<scope>): render social preview card from the live site\` and push. That rebuilds the site.

## Finish with this block, exactly
\`\`\`
FACTORY HANDOFF
idea: #${n}
slug: ${slug}
commits: <shas on main>
pnpm check: <pass | fail>
netlify: <live at https://... from a Git build | not created (why)>
og.png: <rendered from the live site | not yet>
needs pre-generation: <none | script + command>
known gaps: <anything not done or worth a second look>
\`\`\`
`;
}
