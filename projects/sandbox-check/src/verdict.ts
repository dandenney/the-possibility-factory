// Turns raw probe facts into graded findings with fixes. No DOM in here so it stays testable.

import { cspFor, type Config } from "./config.ts";
import type { Fact, FactValue, ProbeId } from "./payload.ts";

export type Status = "fail" | "warn" | "pass" | "info" | "pending" | "na";

export interface Finding {
  id: ProbeId | "messages";
  title: string;
  status: Status;
  detail: string;
  fix?: string;
}

export interface Observed {
  /** Probe facts reported by the frame, if scripts ran. */
  facts: Fact[];
  /** Whether the frame reported anything before the deadline. */
  settled: boolean;
  /** Top-navigation probes the kit page actually saw land in its own URL. */
  navigated: Set<"top-nav" | "top-nav-click">;
  /** The kit page's own origin. */
  origin: string;
}

const FIX_ORIGIN =
  "Drop allow-same-origin, or better, serve previews from a separate origin that has no cookies, storage or APIs worth stealing.";
const FIX_EGRESS =
  "Add a CSP to the framed HTML (connect-src and img-src 'none', or default-src 'none'). The sandbox alone never blocks requests.";

export const ORDER: Finding["id"][] = [
  "scripts",
  "origin",
  "parent-dom",
  "cookies",
  "storage",
  "read-api",
  "service-worker",
  "fetch-out",
  "image-out",
  "forms",
  "top-nav",
  "top-nav-click",
  "popup-click",
  "features",
  "messages",
];

export function judge(config: Config, o: Observed): Finding[] {
  const fact = new Map<ProbeId, Fact>(o.facts.map((f) => [f.id, f]));
  const val = (id: ProbeId): FactValue | undefined => fact.get(id)?.value;
  const has = (id: ProbeId) => fact.has(id);
  const tokens = new Set(config.sandbox ?? []);
  const sandboxed = config.sandbox !== null;
  const out: Finding[] = [];

  if (o.settled && !has("scripts")) {
    return [
      {
        id: "scripts",
        title: "Scripts run",
        status: "pass",
        detail:
          "Scripts never ran, so none of the other probes could either. A static preview (no allow-scripts) is the safest kind there is.",
      },
      messagesFinding(),
    ];
  }

  const pending = (id: Finding["id"], title: string, detail = "Waiting for the frame…"): Finding => ({
    id,
    title,
    status: o.settled ? "na" : "pending",
    detail: o.settled ? "The probe didn't report this one." : detail,
  });

  // scripts
  out.push({
    id: "scripts",
    title: "Scripts run",
    status: "info",
    detail: "Expected for interactive previews. Everything below is about what those scripts can reach.",
  });

  // origin
  const origin = val("origin");
  if (typeof origin !== "string") out.push(pending("origin", "Origin"));
  else if (origin === "null")
    out.push({ id: "origin", title: "Origin", status: "pass", detail: "Opaque (\"null\"). The frame is a stranger to your site." });
  else if (origin === o.origin)
    out.push({
      id: "origin",
      title: "Origin",
      status: "fail",
      detail: `The frame runs as ${origin}, your own origin. As far as the browser is concerned, it is your page.`,
      fix: FIX_ORIGIN,
    });
  else out.push({ id: "origin", title: "Origin", status: "info", detail: `Runs as ${origin}.` });

  const escape = (id: ProbeId, title: string, yes: string, no: string, fix = FIX_ORIGIN) => {
    const v = val(id);
    if (v === undefined) out.push(pending(id, title));
    else if (v === null) out.push({ id, title, status: "na", detail: fact.get(id)?.note ?? "Not measurable here." });
    else out.push(v === true ? { id, title, status: "fail", detail: yes, fix } : { id, title, status: "pass", detail: no });
  };

  escape(
    "parent-dom",
    "Reads the parent page",
    "It reached into your page's DOM. It could read anything on screen, or rewrite the page, including the iframe's own sandbox attribute.",
    "Blocked from your page's DOM.",
  );
  escape("cookies", "Reads your cookies", "It read the cookie your app set.", "Couldn't read your app's cookies.");
  escape("storage", "Reads your localStorage", "It read a value your app stored in localStorage.", "Couldn't read your app's localStorage.");
  escape(
    "read-api",
    "Reads your API responses",
    "It fetched a file from your origin with your cookies attached and read the response. Point that at /api/me and it reads the signed-in user's data.",
    "It can't read responses from your origin.",
  );
  escape(
    "service-worker",
    "Reaches service workers",
    "It has your origin's service worker API. It could install a worker that outlives the preview. (The probe only listed registrations; it didn't install one.)",
    "No service worker access.",
  );

  const leak = (id: ProbeId, title: string, how: string) => {
    const v = val(id);
    if (v === undefined) out.push(pending(id, title));
    else
      out.push(
        v === true
          ? {
              id,
              title,
              status: "warn",
              detail: `${how} went out. Anything the page knows, such as what the user typed into it or what the model put in it, can be sent to any server.`,
              fix: FIX_EGRESS,
            }
          : { id, title, status: "pass", detail: `${how} was blocked.` },
      );
  };
  leak("fetch-out", "Sends data out with fetch", "A fetch() request");
  leak("image-out", "Sends data out with an image", "An image request");

  // forms
  const forms = val("forms");
  if (forms === undefined) out.push(pending("forms", "Submits forms"));
  else if (forms !== true) out.push({ id: "forms", title: "Submits forms", status: "pass", detail: "Form submission is blocked." });
  else if (/form-action\s+'none'/.test(cspFor(config)))
    out.push({
      id: "forms",
      title: "Submits forms",
      status: "pass",
      detail: "The sandbox allows forms, but the CSP's form-action 'none' stops them going anywhere.",
    });
  else
    out.push({
      id: "forms",
      title: "Submits forms",
      status: "warn",
      detail: "It can submit forms. A fake \"session expired, sign in again\" form inside your UI is the classic phish.",
      fix: "Leave out allow-forms, or add form-action 'none' to the frame's CSP.",
    });

  // top navigation, judged by what the kit page saw
  if (!has("top-nav")) out.push(pending("top-nav", "Moves your tab"));
  else if (o.navigated.has("top-nav"))
    out.push({
      id: "top-nav",
      title: "Moves your tab",
      status: "fail",
      detail: "Without any click it changed the URL of your whole tab. It could send the user to a look-alike login page.",
      fix: "Leave out allow-top-navigation (and don't skip the sandbox attribute).",
    });
  else out.push({ id: "top-nav", title: "Moves your tab", status: "pass", detail: "Couldn't navigate your tab." });

  if (!has("top-nav-click"))
    out.push({
      id: "top-nav-click",
      title: "Moves your tab after a click",
      status: "pending",
      detail: "Click the button inside the frame. Some tokens only unlock after a real click.",
    });
  else if (o.navigated.has("top-nav-click"))
    out.push({
      id: "top-nav-click",
      title: "Moves your tab after a click",
      status: tokens.has("allow-top-navigation") || !sandboxed ? "fail" : "warn",
      detail: "After one click inside the preview, it changed the URL of your whole tab. Users click on things in previews.",
      fix: "Leave out allow-top-navigation-by-user-activation unless previews really need to link out; open links with allow-popups instead.",
    });
  else
    out.push({ id: "top-nav-click", title: "Moves your tab after a click", status: "pass", detail: "Even after a click, it couldn't navigate your tab." });

  const popup = val("popup-click");
  if (popup === undefined)
    out.push({
      id: "popup-click",
      title: "Opens popups after a click",
      status: "pending",
      detail: "Click the button inside the frame to test popups.",
    });
  else if (popup === true) {
    const escapes = !sandboxed || tokens.has("allow-popups-to-escape-sandbox");
    out.push({
      id: "popup-click",
      title: "Opens popups after a click",
      status: escapes ? "fail" : "info",
      detail: escapes
        ? "It opened a window, and that window has no sandbox. Whatever loads there runs with no restrictions."
        : "It opened a window. The popup inherits the sandbox, so this is mostly about annoyance and links out.",
      fix: escapes ? "Leave out allow-popups-to-escape-sandbox, or open external links from your own code after checking the URL." : undefined,
    });
  } else out.push({ id: "popup-click", title: "Opens popups after a click", status: "pass", detail: "Popups are blocked." });

  // permissions policy
  const features = val("features");
  if (features === undefined) out.push(pending("features", "Powerful features"));
  else if (features === null)
    out.push({
      id: "features",
      title: "Powerful features",
      status: "na",
      detail: "This browser doesn't expose the frame's Permissions Policy. Chrome and Edge do.",
    });
  else if (Array.isArray(features) && features.length)
    out.push({
      id: "features",
      title: "Powerful features",
      status: "warn",
      detail: `Allowed in the frame: ${features.join(", ")}. The user still sees a prompt for most, but the prompt shows your site's name.`,
      fix: "Keep the iframe allow attribute empty unless a preview genuinely needs a feature.",
    });
  else out.push({ id: "features", title: "Powerful features", status: "pass", detail: "No camera, microphone, clipboard or similar." });

  out.push(messagesFinding());
  return out.sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
}

function messagesFinding(): Finding {
  return {
    id: "messages",
    title: "Messages your page",
    status: "info",
    detail:
      "A framed page can always postMessage your window, whatever the sandbox says. Recent HTML-preview account takeovers went through a message handler on the parent page, not through the sandbox itself.",
    fix: "In every message listener, check event.source === iframe.contentWindow (or use a MessageChannel). An origin check alone fails here: every sandboxed frame reports \"null\". Never pass message data to innerHTML.",
  };
}

/** Failures that mean the frame is effectively your page. */
const IDENTITY = new Set<Finding["id"]>(["origin", "parent-dom", "cookies", "storage", "read-api", "service-worker"]);

export interface Summary {
  fails: number;
  warns: number;
  passes: number;
  pending: number;
  title: string;
  blurb: string;
  tone: "bad" | "meh" | "good" | "wait";
}

export function summarize(findings: Finding[]): Summary {
  const n = (s: Status) => findings.filter((f) => f.status === s).length;
  const fails = n("fail"), warns = n("warn"), passes = n("pass"), pending = n("pending");
  const loading = findings.some((f) => f.status === "pending" && f.id !== "top-nav-click" && f.id !== "popup-click");
  if (loading) return { fails, warns, passes, pending, title: "Probing…", blurb: "The framed page is checking what it can reach.", tone: "wait" };
  if (fails)
    return {
      fails,
      warns,
      passes,
      pending,
      title: "The sandbox leaks",
      blurb: `${fails} ${fails === 1 ? "probe got" : "probes got"} out. ${
        findings.some((f) => f.status === "fail" && IDENTITY.has(f.id))
          ? "Untrusted HTML rendered this way can act as your site."
          : "It can't act as your site, but it can reach beyond the frame."
      }`,
      tone: "bad",
    };
  if (warns)
    return {
      fails,
      warns,
      passes,
      pending,
      title: "Contained, with open doors",
      blurb: `It can't act as your site, but ${warns} ${warns === 1 ? "door is" : "doors are"} open.`,
      tone: "meh",
    };
  const untested = n("na");
  if (untested)
    return {
      fails,
      warns,
      passes,
      pending,
      title: "Nothing got out, but not everything ran",
      blurb: `${untested} ${untested === 1 ? "probe" : "probes"} couldn't run here. Check the n/a rows before calling it safe.`,
      tone: "meh",
    };
  return { fails, warns, passes, pending, title: "Locked down", blurb: "Nothing got out.", tone: "good" };
}

const MARK: Record<Status, string> = { fail: "FAIL", warn: "WARN", pass: "PASS", info: "INFO", pending: "----", na: "N/A " };

export function toMarkdown(config: Config, findings: Finding[], snippetText: string, url: string): string {
  const s = summarize(findings);
  const lines = [
    `## Sandbox Check: ${s.title}`,
    "",
    s.blurb,
    "",
    "```html",
    snippetText,
    "```",
    "",
    "| Result | Probe | What happened |",
    "| --- | --- | --- |",
    ...findings.map((f) => `| ${MARK[f.status].trim()} | ${f.title} | ${f.detail.replace(/\|/g, "\\|")} |`),
  ];
  const fixes = findings.filter((f) => f.fix && (f.status === "fail" || f.status === "warn"));
  if (fixes.length) lines.push("", "### Fixes", "", ...fixes.map((f) => `- **${f.title}:** ${f.fix}`));
  lines.push("", `Embed: ${config.embed}. Re-run it: ${url}`);
  return lines.join("\n");
}
