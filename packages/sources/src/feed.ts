import { XMLParser } from "fast-xml-parser";

export interface FeedItem {
  id: string;
  title: string;
  link?: string;
  publishedAt?: Date;
  summary?: string;
  /** The raw parsed item, for feeds with extra namespaced fields. */
  raw: Record<string, unknown>;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  textNodeName: "#text",
  isArray: (name) => name === "item" || name === "entry" || name === "link",
});

const asArray = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

export function text(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "string" || typeof v === "number") return String(v).trim() || undefined;
  if (typeof v === "object" && "#text" in v) return text((v as Record<string, unknown>)["#text"]);
  return undefined;
}

function date(v: unknown): Date | undefined {
  const s = text(v);
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function stripHtml(html: string | undefined, max = 280): string | undefined {
  if (!html) return undefined;
  const plain = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return undefined;
  return plain.length > max ? `${plain.slice(0, max - 1).trimEnd()}…` : plain;
}

function atomLink(links: unknown): string | undefined {
  const all = asArray(links as Record<string, string>[]);
  const alt = all.find((l) => !l["@rel"] || l["@rel"] === "alternate") ?? all[0];
  return alt?.["@href"];
}

/** Parses RSS 2.0 or Atom into a common item shape. */
export function parseFeed(xml: string): FeedItem[] {
  const doc = parser.parse(xml) as Record<string, any>;
  if (doc.rss) {
    return asArray(doc.rss.channel?.item as Record<string, unknown>[]).flatMap((item) => {
      const title = text(item.title);
      const link = text(asArray(item.link as unknown[])[0]);
      const id = text(item.guid) ?? link ?? title;
      if (!title || !id) return [];
      return [{ id, title, link, publishedAt: date(item.pubDate), summary: stripHtml(text(item.description)), raw: item }];
    });
  }
  if (doc.feed) {
    return asArray(doc.feed.entry as Record<string, unknown>[]).flatMap((entry) => {
      const title = text(entry.title);
      const link = atomLink(entry.link);
      const id = text(entry.id) ?? link;
      if (!title || !id) return [];
      return [
        {
          id,
          title,
          link,
          publishedAt: date(entry.published ?? entry.updated),
          summary: stripHtml(text(entry.summary) ?? text(entry.content)),
          raw: entry,
        },
      ];
    });
  }
  throw new Error("Unrecognized feed format");
}

export async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "user-agent": "the-possibility-factory/1.0 (+https://github.com/dandenney/the-possibility-factory)" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`${url} responded ${res.status}`);
  return res.text();
}

export async function fetchJson<T>(url: string): Promise<T> {
  return JSON.parse(await fetchText(url)) as T;
}

export const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);
