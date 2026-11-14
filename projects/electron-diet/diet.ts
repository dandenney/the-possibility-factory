// The analysis, with no host: parse a process list, group it by app, sort each app into
// Electron, WebView2, browser or native, and estimate what a native rewrite would give back.

export type Kind = 'electron' | 'webview2' | 'browser' | 'native';

export interface ProcessLine { kb: number; command: string }

export interface AppRow {
  id: string;
  name: string;
  kind: Kind;
  kindLabel: string;
  mb: number;
  afterMb: number;
  savedMb: number;
  processes: number;
  sizeText: string;
  afterText: string;
  savedText: string;
  beforePercent: number;
  afterPercent: number;
}

export interface Report {
  processes: number;
  apps: number;
  format: string;
  totalText: string;
  electronText: string;
  savedText: string;
  afterText: string;
  savedPercent: number;
  headline: string;
  offenders: AppRow[];
  top: AppRow[];
}

/** Discord's lighter, non-Electron Windows 11 app uses about 70% less RAM; each Electron or WebView2 app is assumed to do the same. */
export const SAVING = 0.7;

const KIND_LABEL: Record<Kind, string> = { electron: 'Electron', webview2: 'WebView2', browser: 'Browser', native: 'Native' };

// Matched against the app's name or executable, lower case. Each list holds apps known to ship that way.
const ELECTRON = [
  'slack', 'discord', 'visual studio code', 'code', 'code - insiders', 'cursor', 'windsurf', 'notion', 'notion calendar', 'obsidian',
  'figma', 'signal', 'postman', 'github desktop', 'githubdesktop', '1password', 'bitwarden', 'docker desktop', 'claude',
  'linear', 'loom', 'microsoft teams classic', 'teams', 'skype', 'element', 'mattermost', 'insomnia', 'hyper', 'tidal',
  'asana', 'clickup', 'todoist', 'beeper', 'logseq', 'joplin', 'typora', 'mongodb compass', 'balenaetcher', 'zulip',
  'whatsapp beta', 'trello', 'basecamp', 'raindrop.io', 'electron', 'wavebox', 'ferdium', 'rambox', 'warp terminal',
];
const WEBVIEW2 = ['msedgewebview2', 'ms-teams', 'microsoft teams', 'olk', 'new outlook', 'widgets', 'clipchamp', 'phoneexperiencehost'];
const BROWSERS: [RegExp, string][] = [
  [/^(google chrome|chrome)$/, 'Google Chrome'], [/^chromium(-browser)?$/, 'Chromium'], [/^(microsoft edge|msedge)$/, 'Microsoft Edge'],
  [/^(brave browser|brave)$/, 'Brave'], [/^arc$/, 'Arc'], [/^(firefox|firefox-bin|firefox-esr)$/, 'Firefox'], [/^vivaldi(-bin)?$/, 'Vivaldi'],
  [/^(opera|opera gx)$/, 'Opera'], [/^safari$/, 'Safari'], [/^(com\.apple\.webkit\..*|safari & webkit)$/, 'Safari'], [/^zen( browser)?$/, 'Zen'],
];
// Executable names as Windows and Linux list them, mapped to the name people know.
const DISPLAY: Record<string, string> = {
  code: 'Visual Studio Code', msedgewebview2: 'WebView2 runtime', 'ms-teams': 'Microsoft Teams', olk: 'New Outlook', teams: 'Microsoft Teams classic',
  githubdesktop: 'GitHub Desktop', phoneexperiencehost: 'Phone Link', widgets: 'Widgets',
};

const titleCase = (s: string) => s.replace(/(^|[\s-])([a-z])/g, (_m, a: string, b: string) => a + b.toUpperCase());

/** The app a command belongs to: a Mac command's outermost `.app`, else its executable's name. */
export function appName(command: string): string {
  const path = command.trim();
  const bundle = /\/([^/]+)\.app(\/|$)/.exec(path);
  if (bundle) return bundle[1];
  if (/com\.apple\.WebKit\./.test(path)) return 'Safari';
  const base = path.split(/[\\/]/).pop() ?? path;
  const bare = base.replace(/\.exe$/i, '').replace(/ Helper( \([^)]*\))?$/, '');
  const known = DISPLAY[bare.toLowerCase()];
  return known ?? (bare === bare.toLowerCase() ? titleCase(bare) : bare);
}

export function classify(name: string, commands: string[], electronHints: Set<string>): Kind {
  const key = name.toLowerCase();
  if (BROWSERS.some(([re]) => re.test(key))) return 'browser';
  if (electronHints.has(key) || ELECTRON.includes(key)) return 'electron';
  // A bare `electron` executable; inside a bundle only its last path part counts, so "Electron Diet.app" doesn't.
  const electronBinary = (c: string) => /[\\/]electron$/i.test(c) || (!/\.app\//i.test(c) && /[\\/]electron\s/i.test(c));
  if (commands.some(c => /Electron Framework/i.test(c) || electronBinary(c))) return 'electron';
  if (WEBVIEW2.includes(key) || commands.some(c => /msedgewebview2/i.test(c))) return 'webview2';
  return 'native';
}

const browserName = (name: string) => BROWSERS.find(([re]) => re.test(name.toLowerCase()))?.[1] ?? name;

const kbOf = (text: string): number => {
  const n = Number(text.replace(/[,.\s]/g, ''));
  return Number.isFinite(n) ? n : NaN;
};

const csvFields = (line: string): string[] => [...line.matchAll(/"((?:[^"]|"")*)"|([^,]+)/g)].map(m => (m[1] ?? m[2] ?? '').replace(/""/g, '"').trim());

/** Reads `ps -axo rss=,comm=`, `ps aux`, `tasklist` (table or `/fo csv`), or the Mac app's scan. */
export function parse(text: string): { lines: ProcessLine[]; format: string } {
  const lines: ProcessLine[] = [];
  let format = '';
  let psAux = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/^USER\s+PID\s+%CPU/i.test(line)) { psAux = true; format = 'ps aux'; continue; }
    if (/^"?Image Name"?/i.test(line) || /^RSS\s+(COMM|COMMAND)/i.test(line) || /^=+/.test(line)) continue;
    if (line.startsWith('"')) {
      const f = csvFields(line);
      const mem = f.find(x => /^[\d,. ]+\s*K$/i.test(x));
      if (f[0] && mem) { lines.push({ kb: kbOf(mem.replace(/K$/i, '')), command: f[0] }); format ||= 'tasklist'; }
      continue;
    }
    const table = /^(.+?)\s+\d+\s+\S+\s+\d+\s+([\d,. ]+)\s*K$/i.exec(line);
    if (table) { lines.push({ kb: kbOf(table[2]), command: table[1] }); format ||= 'tasklist'; continue; }
    if (psAux) {
      const f = line.split(/\s+/);
      if (f.length >= 11 && /^\d+$/.test(f[5])) lines.push({ kb: Number(f[5]), command: f.slice(10).join(' ') });
      continue;
    }
    const ps = /^(\d+)\s+(.+)$/.exec(line);
    if (ps) { lines.push({ kb: Number(ps[1]), command: ps[2] }); format ||= 'ps'; }
  }
  return { lines: lines.filter(l => Number.isFinite(l.kb) && l.kb > 0), format };
}

/** "1.4 GB" or "640 MB". */
export function size(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(mb >= 10240 ? 0 : 1)} GB`;
  return `${Math.round(mb)} MB`;
}

export function analyze(text: string, electronApps: string[] = []): Report {
  const { lines, format } = parse(text);
  const hints = new Set(electronApps.map(a => a.toLowerCase()));
  const groups = new Map<string, { name: string; kb: number; commands: string[] }>();
  for (const l of lines) {
    let name = appName(l.command);
    if (BROWSERS.some(([re]) => re.test(name.toLowerCase()))) name = browserName(name);
    const g = groups.get(name.toLowerCase()) ?? { name, kb: 0, commands: [] };
    g.kb += l.kb;
    g.commands.push(l.command);
    groups.set(name.toLowerCase(), g);
  }
  const rows = [...groups.values()].map(g => {
    const kind = classify(g.name, g.commands, hints);
    const mb = g.kb / 1024;
    const savedMb = kind === 'electron' || kind === 'webview2' ? mb * SAVING : 0;
    return { name: g.name, kind, mb, savedMb, processes: g.commands.length };
  }).sort((a, b) => b.mb - a.mb || a.name.localeCompare(b.name));
  type Row = (typeof rows)[number];
  const scale = (xs: Row[]) => Math.max(1, ...xs.map(r => r.mb));
  const row = (max: number) => (r: Row): AppRow => ({
    id: r.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name: r.name,
    kind: r.kind,
    kindLabel: KIND_LABEL[r.kind],
    mb: Math.round(r.mb),
    afterMb: Math.round(r.mb - r.savedMb),
    savedMb: Math.round(r.savedMb),
    processes: r.processes,
    sizeText: size(r.mb),
    afterText: size(r.mb - r.savedMb),
    savedText: size(r.savedMb),
    beforePercent: Math.max(1, Math.round((r.mb / max) * 100)),
    afterPercent: Math.max(1, Math.round(((r.mb - r.savedMb) / max) * 100)),
  });
  const total = rows.reduce((t, r) => t + r.mb, 0);
  const heavy = rows.filter(r => r.savedMb > 0);
  const heavyMb = heavy.reduce((t, r) => t + r.mb, 0);
  const saved = heavy.reduce((t, r) => t + r.savedMb, 0);
  const headline = heavy.length === 0
    ? 'No Electron or WebView2 apps found. Your RAM is on a diet already.'
    : `${heavy.length === 1 ? heavy[0].name : `${heavy.length} Electron apps`} could give back ${size(saved)} of RAM if ${heavy.length === 1 ? 'it went' : 'they went'} native.`;
  return {
    processes: lines.length,
    apps: rows.length,
    format,
    totalText: size(total),
    electronText: size(heavyMb),
    savedText: size(saved),
    afterText: size(total - saved),
    savedPercent: total > 0 ? Math.round((saved / total) * 100) : 0,
    headline,
    offenders: [...heavy].sort((a, b) => b.savedMb - a.savedMb).slice(0, 8).map(row(scale(heavy))),
    top: rows.slice(0, 12).map(row(scale(rows))),
  };
}
