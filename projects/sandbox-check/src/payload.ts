// The probe that runs inside the framed page, standing in for untrusted, model-written HTML.
// probeMain is stringified into the frame, so it must stay self-contained: no imports, no outside helpers.
// Every probe is harmless: it reads, never writes, and only requests files from the kit's own origin.

export type ProbeId =
  | "scripts"
  | "origin"
  | "parent-dom"
  | "cookies"
  | "storage"
  | "read-api"
  | "fetch-out"
  | "image-out"
  | "service-worker"
  | "forms"
  | "features"
  | "top-nav"
  | "top-nav-click"
  | "popup-click";

export type FactValue = boolean | string | string[] | null;

export interface Fact {
  id: ProbeId;
  value: FactValue;
  note?: string;
}

export interface ProbeOptions {
  /** Ties messages to one run so stale frames can't report into a new one. */
  nonce: string;
  /** "kit": framed by this page, which planted canaries. "standalone": pasted into someone else's app. */
  mode: "kit" | "standalone";
  /** Origin that serves canary.txt and dot.png (the kit). */
  kitOrigin: string;
  /** The kit page URL without its hash, for the harmless top-navigation probe. Empty in standalone mode. */
  topUrl: string;
  /** Value of the canary cookie and localStorage key the kit planted. */
  canary: string;
  /** Permissions Policy features worth flagging when allowed. */
  sensitive: string[];
}

export interface ProbeMessage {
  kit: "sandbox-check";
  nonce: string;
  facts: Fact[];
}

export const SENSITIVE_FEATURES = [
  "camera",
  "microphone",
  "geolocation",
  "clipboard-read",
  "clipboard-write",
  "display-capture",
  "payment",
  "publickey-credentials-get",
  "usb",
  "serial",
  "hid",
  "bluetooth",
];

export function probeMain(o: ProbeOptions): void {
  const facts: Fact[] = [];
  const kitMode = o.mode === "kit";
  const labels: Record<string, string> = {
    scripts: "Scripts run",
    origin: "Origin",
    "parent-dom": "Reads the parent page",
    cookies: kitMode ? "Reads the app's cookie" : "Can use cookies",
    storage: kitMode ? "Reads the app's localStorage" : "Can use localStorage",
    "read-api": "Reads same-site API responses",
    "fetch-out": "Sends data out with fetch",
    "image-out": "Sends data out with an image",
    "service-worker": "Reaches service workers",
    forms: "Submits forms",
    features: "Powerful features allowed",
    "top-nav": "Navigates the top page",
    "top-nav-click": "Navigates the top page after a click",
    "popup-click": "Opens a popup after a click",
  };

  const list = document.createElement("ul");
  const style = document.createElement("style");
  style.textContent =
    "body{margin:0;font:13px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;color:#1c1b19;background:#fbfaf7}" +
    "main{padding:12px 14px}h1{font-size:13px;margin:0 0 8px}ul{list-style:none;margin:0 0 10px;padding:0}" +
    "li{display:flex;justify-content:space-between;gap:12px;padding:3px 0;border-bottom:1px solid #e7e3da}" +
    "li b{font-weight:600;text-align:right;overflow-wrap:anywhere}" +
    "button{font:inherit;padding:6px 10px;border:1px solid #1c1b19;border-radius:6px;background:#fff;cursor:pointer}" +
    "p{margin:8px 0 0;color:#6b675e}";
  const main = document.createElement("main");
  const title = document.createElement("h1");
  title.textContent = "Untrusted page: what I can reach";
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Click to test popups and navigation";
  const hint = document.createElement("p");
  hint.textContent = kitMode
    ? "Some sandbox tokens only unlock after a real click inside the frame."
    : "Paste this page into any HTML preview. Nothing here changes the host page.";
  main.append(title, list, button, hint);
  document.head.append(style);
  document.body.append(main);

  const show = (v: FactValue): string =>
    v === null ? "n/a" : v === true ? "yes" : v === false ? "no" : Array.isArray(v) ? v.join(", ") || "none" : v;

  function record(id: ProbeId, value: FactValue, note?: string) {
    const fact: Fact = note ? { id, value, note } : { id, value };
    const existing = facts.findIndex((f) => f.id === id);
    if (existing >= 0) facts[existing] = fact;
    else facts.push(fact);
    let row = list.querySelector<HTMLLIElement>(`li[data-id="${id}"]`);
    if (!row) {
      row = document.createElement("li");
      row.dataset.id = id;
      row.append(document.createElement("span"), document.createElement("b"));
      list.append(row);
    }
    row.firstChild!.textContent = labels[id] ?? id;
    row.lastChild!.textContent = show(value);
    report();
  }

  function report() {
    const msg: ProbeMessage = { kit: "sandbox-check", nonce: o.nonce, facts: facts.slice() };
    try {
      parent.postMessage(msg, "*");
    } catch {
      /* no parent */
    }
  }

  function safe<T>(fn: () => T): T | Error {
    try {
      return fn();
    } catch (err) {
      return err as Error;
    }
  }

  function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
    return Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);
  }

  record("scripts", true);
  record("origin", String(self.origin));

  const title2 = safe(() => parent !== self && typeof parent.document.title === "string");
  record("parent-dom", title2 === true, title2 instanceof Error ? title2.name : undefined);

  const cookie = safe(() => document.cookie);
  if (cookie instanceof Error) record("cookies", false, cookie.name);
  else record("cookies", kitMode ? cookie.includes(`sck_canary=${o.canary}`) : true);

  const store = safe(() => window.localStorage.getItem("sck-canary"));
  if (store instanceof Error) record("storage", false, store.name);
  else record("storage", kitMode ? store === o.canary : true);

  const sw = safe(() => navigator.serviceWorker);
  if (sw instanceof Error || !sw) record("service-worker", false, sw instanceof Error ? sw.name : "unavailable");
  else {
    withTimeout(
      sw.getRegistrations().then(
        () => true,
        () => false,
      ),
      1500,
      false,
    ).then((ok) => record("service-worker", ok));
  }

  const policy = (document as Document & { featurePolicy?: { allowedFeatures(): string[] } }).featurePolicy;
  record("features", policy ? policy.allowedFeatures().filter((f) => o.sensitive.includes(f)) : null);

  // Forms: the sandbox check happens before the submit event fires, so the event alone answers it.
  const form = document.createElement("form");
  form.action = "about:blank";
  form.hidden = true;
  let submitted = false;
  form.addEventListener("submit", (e) => {
    submitted = true;
    e.preventDefault();
  });
  document.body.append(form);
  safe(() => form.requestSubmit());
  setTimeout(() => {
    record("forms", submitted);
    form.remove();
  }, 50);

  const bust = () => `sck=${o.nonce}-${Math.random().toString(36).slice(2, 8)}`;

  if (kitMode) {
    withTimeout(
      fetch(`${o.kitOrigin}/canary.txt?${bust()}`, { credentials: "include", cache: "no-store" })
        .then((r) => r.text())
        .then((t) => t.startsWith("sandbox-check canary")),
      3000,
      false,
    ).then(
      (ok) => record("read-api", ok),
      () => record("read-api", false),
    );
  } else {
    record("read-api", null, "Only measurable inside the kit");
  }

  withTimeout(
    fetch(`${o.kitOrigin}/dot.png?${bust()}`, { mode: "no-cors", cache: "no-store" }).then(
      () => true,
      () => false,
    ),
    3000,
    false,
  ).then((ok) => record("fetch-out", ok));

  withTimeout(
    new Promise<boolean>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = `${o.kitOrigin}/dot.png?${bust()}`;
    }),
    3000,
    false,
  ).then((ok) => record("image-out", ok));

  // Top navigation: point the top page at its own URL plus a fragment. That changes only the hash, so the kit
  // page notices and cleans up without reloading. The kit page decides the verdict from what it saw.
  function tryTopNav(id: "top-nav" | "top-nav-click") {
    if (!kitMode || !o.topUrl) {
      record(id, null, "Only measurable inside the kit");
      return;
    }
    const r = safe(() => {
      top!.location.href = `${o.topUrl}#sck-${id}-${o.nonce}`;
      return "attempted";
    });
    record(id, r instanceof Error ? "blocked" : r, r instanceof Error ? r.name : undefined);
  }
  tryTopNav("top-nav");

  button.addEventListener("click", () => {
    const w = safe(() => window.open("about:blank", "_blank", "popup,width=240,height=160"));
    const opened = !!w && !(w instanceof Error);
    if (opened) safe(() => (w as Window).close());
    record("popup-click", opened, w instanceof Error ? w.name : undefined);
    tryTopNav("top-nav-click");
    button.disabled = true;
    button.textContent = "Clicked";
  });
}
