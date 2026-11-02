import "./style.css";
import config from "../models.json";
import galleryData from "./gallery.json";
import { pickMatchup, type Matchup } from "./matchup.ts";
import { rank } from "./ranking.ts";
import type { ArenaConfig, Gallery, ModelConfig, Outcome, Standing, Vote } from "./types.ts";

const arena = config as ArenaConfig;
const gallery = galleryData as Gallery;
const models = new Map(arena.models.map((m) => [m.slug, m]));
const samples = gallery.samples.filter((s) => models.has(s.model));
const ranked = arena.models.map((m) => m.slug).filter((slug) => samples.some((s) => s.model === slug));
const featured = new Set(arena.models.filter((m) => m.featured).map((m) => m.slug));
const MY_VOTES = "pelican-bench-votes";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...kids: (Node | string)[]) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...kids);
  return node;
};

function nameplate(m: ModelConfig): Node[] {
  const nodes: Node[] = [document.createTextNode(m.name), el("small", { textContent: m.lab })];
  if (m.featured) nodes.push(el("span", { className: "badge", textContent: "New" }));
  return nodes;
}

function toast(text: string) {
  const t = $("toast");
  t.textContent = text;
  t.hidden = false;
  clearTimeout(Number(t.dataset.timer));
  t.dataset.timer = String(setTimeout(() => (t.hidden = true), 2200));
}

function myVotes(): Vote[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(MY_VOTES) ?? "[]") as Vote[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveMyVote(vote: Vote) {
  try {
    localStorage.setItem(MY_VOTES, JSON.stringify([...myVotes(), vote].slice(-500)));
  } catch {
    // Private mode: the personal board just won't persist.
  }
}

// ── Matchup ────────────────────────────────────────────────────────────────

let current: Matchup | null = null;
let voted = false;

function showMatchup() {
  current = pickMatchup(samples, featured, current);
  voted = false;
  if (!current) {
    $("pair").hidden = true;
    $("choices").hidden = true;
    $("empty").hidden = false;
    return;
  }
  for (const [id, sample] of [["left", current.left], ["right", current.right]] as const) {
    const fig = $(id);
    fig.classList.remove("won", "lost", "tied");
    fig.querySelector("img")!.src = sample.file;
    const who = fig.querySelector<HTMLElement>(".who")!;
    who.hidden = true;
    who.replaceChildren();
  }
  $("choices").hidden = false;
  $("after").hidden = true;
}

async function vote(outcome: Outcome) {
  if (!current || voted) return;
  voted = true;
  const v: Vote = { a: current.left.model, b: current.right.model, outcome };
  saveMyVote(v);

  const left = models.get(v.a)!;
  const right = models.get(v.b)!;
  for (const [id, m, side] of [["left", left, "a"], ["right", right, "b"]] as const) {
    const fig = $(id);
    fig.classList.add(outcome === "tie" ? "tied" : outcome === side ? "won" : "lost");
    const who = fig.querySelector<HTMLElement>(".who")!;
    who.replaceChildren(...nameplate(m));
    who.hidden = false;
  }
  const winner = outcome === "a" ? left : outcome === "b" ? right : null;
  $("verdict").textContent = winner ? `You picked ${winner.name}.` : `${left.name} and ${right.name}, dead heat.`;
  $("choices").hidden = true;
  $("after").hidden = false;
  $("next").focus({ preventScroll: true });
  const n = myVotes().length;
  $("count").textContent = `You've judged ${n} matchup${n === 1 ? "" : "s"}.`;
  renderMine();

  try {
    const res = await fetch("/api/vote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) });
    if (res.ok) renderEveryone(await res.json());
  } catch {
    // Offline or no functions locally; the personal board still updated.
  }
}

$("choices").addEventListener("click", (e) => {
  const outcome = (e.target as HTMLElement).closest<HTMLElement>("[data-outcome]")?.dataset.outcome as Outcome | undefined;
  if (outcome) void vote(outcome);
});
$("next").addEventListener("click", showMatchup);
document.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement).closest("input, textarea, dialog")) return;
  if (!voted && e.key === "ArrowLeft") void vote("a");
  else if (!voted && e.key === "ArrowRight") void vote("b");
  else if (!voted && e.key === "ArrowDown") void vote("tie");
  else if (voted && (e.key === "Enter" || e.key === " ") && document.activeElement !== $("next")) {
    e.preventDefault();
    showMatchup();
  } else return;
});

// ── Leaderboard ────────────────────────────────────────────────────────────

interface Board {
  standings: Standing[];
  totalVotes: number;
}

let everyone: Board | null = null;
let tab: "all" | "you" = "all";

function renderStandings(standings: Standing[]) {
  const thumb = (slug: string) => samples.find((s) => s.model === slug)?.file ?? "";
  $("standings").replaceChildren(
    ...standings.map((s) => {
      const m = models.get(s.model)!;
      const link = el("a", { href: `#m-${m.slug}` }, el("img", { src: thumb(m.slug), alt: "", loading: "lazy" }));
      return el(
        "li",
        {},
        link,
        el("span", { className: "name" }, ...nameplate(m)),
        el("span", { className: "score" }, String(s.score), el("small", { textContent: `${s.wins}–${s.losses}–${s.ties}` })),
      );
    }),
  );
}

function renderEveryone(board: Board) {
  everyone = board;
  if (tab === "all") showTab("all");
}

function renderMine() {
  if (tab === "you") showTab("you");
}

function showTab(next: "all" | "you") {
  tab = next;
  $("tab-all").setAttribute("aria-selected", String(next === "all"));
  $("tab-you").setAttribute("aria-selected", String(next === "you"));
  if (next === "you") {
    const mine = myVotes();
    renderStandings(rank(ranked, mine));
    $("board-note").textContent = mine.length
      ? `From your ${mine.length} vote${mine.length === 1 ? "" : "s"}, kept on this device. Wins–losses–ties.`
      : "Vote on a few matchups to see your own ranking.";
  } else if (everyone) {
    renderStandings(everyone.standings);
    $("board-note").textContent = `${everyone.totalVotes.toLocaleString()} vote${everyone.totalVotes === 1 ? "" : "s"} from everyone. Wins–losses–ties.`;
  } else {
    renderStandings(rank(ranked, []));
    $("board-note").textContent = "Loading votes…";
  }
}

$("tab-all").addEventListener("click", () => showTab("all"));
$("tab-you").addEventListener("click", () => showTab("you"));

async function loadEveryone() {
  try {
    const res = await fetch("/api/leaderboard");
    if (!res.ok) throw new Error(String(res.status));
    renderEveryone(await res.json());
  } catch {
    if (tab === "all") $("board-note").textContent = "Couldn't load everyone's votes right now. \"Just you\" still works.";
  }
}

// ── Gallery ────────────────────────────────────────────────────────────────

function renderGallery() {
  const zoom = $<HTMLDialogElement>("zoom");
  $("gallery").replaceChildren(
    ...arena.models
      .filter((m) => ranked.includes(m.slug))
      .map((m) => {
        const mine = samples.filter((s) => s.model === m.slug);
        const tokens = mine.map((s) => s.outputTokens ?? 0);
        const seconds = mine.map((s) => s.seconds);
        const avg = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / Math.max(xs.length, 1));
        const meta = `${m.id} · about ${avg(tokens).toLocaleString()} output tokens and ${avg(seconds)}s per pelican`;
        const title = el("h3", {}, ...nameplate(m));
        if (m.link) title.append(el("a", { href: m.link, target: "_blank", rel: "noopener", textContent: "announcement", className: "hint" }));
        return el(
          "article",
          { className: "model", id: `m-${m.slug}` },
          title,
          el("p", { className: "meta", textContent: meta }),
          el(
            "div",
            { className: "thumbs" },
            ...mine.map((s, i) => {
              const b = el("button", { type: "button", ariaLabel: `${m.name} pelican ${i + 1}` }, el("img", { src: s.file, alt: "", loading: "lazy" }));
              b.addEventListener("click", () => {
                zoom.querySelector("img")!.src = s.file;
                $("zoom-caption").textContent = `${m.name} (${m.lab}), pelican ${i + 1}`;
                zoom.showModal();
              });
              return b;
            }),
          ),
        );
      }),
  );
}

// ── Share ──────────────────────────────────────────────────────────────────

$("share").addEventListener("click", async () => {
  const url = location.origin + location.pathname;
  const text = "Which new model draws the best pelican riding a bicycle? Vote blind:";
  if (navigator.share) {
    try {
      await navigator.share({ title: "Pelican Bench Arena", text, url });
      return;
    } catch (err) {
      if ((err as DOMException).name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    toast("Link copied");
  } catch {
    toast(url);
  }
});

// ── Boot ───────────────────────────────────────────────────────────────────

$("prompt").textContent = arena.prompt;
if (gallery.generatedAt) {
  $("generated").textContent = ` on ${new Date(gallery.generatedAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}`;
}
const n = myVotes().length;
if (n) $("count").textContent = `You've judged ${n} matchup${n === 1 ? "" : "s"}. Keys: ← A, ↓ tie, → B, Enter for next.`;
showMatchup();
showTab("all");
renderGallery();
void loadEveryone();
