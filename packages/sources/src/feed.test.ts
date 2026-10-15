import { describe, expect, it } from "vitest";
import { parseFeed, stripHtml } from "./feed.ts";

const rss = `<?xml version="1.0"?>
<rss version="2.0" xmlns:ht="https://trends.google.com/trending/rss"><channel><title>T</title>
  <item><title><![CDATA[Show HN: A thing]]></title><link>https://example.com/a</link>
    <guid isPermaLink="false">hn-1</guid><pubDate>Thu, 15 Oct 2026 14:10:00 -0700</pubDate>
    <description><![CDATA[<p>Hello &amp; <b>welcome</b></p>]]></description>
    <ht:approx_traffic>2000+</ht:approx_traffic></item>
</channel></rss>`;

const atom = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom"><title>R</title>
  <entry><id>tag:github.com,2008:Repository/1/v2.0.0</id><updated>2026-10-15T19:22:06Z</updated>
    <link rel="alternate" type="text/html" href="https://github.com/o/r/releases/tag/v2.0.0"/>
    <title>v2.0.0</title><content type="html">&lt;ul&gt;&lt;li&gt;Added things&lt;/li&gt;&lt;/ul&gt;</content></entry>
  <entry><id>tag:github.com,2008:Repository/1/v1.9.0</id><updated>2026-10-01T00:00:00Z</updated>
    <link rel="alternate" href="https://github.com/o/r/releases/tag/v1.9.0"/><title>v1.9.0</title></entry>
</feed>`;

describe("parseFeed", () => {
  it("parses RSS items and keeps raw namespaced fields", () => {
    const [item] = parseFeed(rss);
    expect(item).toMatchObject({ id: "hn-1", title: "Show HN: A thing", link: "https://example.com/a", summary: "Hello & welcome" });
    expect(item?.publishedAt?.toISOString()).toBe("2026-10-15T21:10:00.000Z");
    expect(item?.raw["ht:approx_traffic"]).toBe("2000+");
  });

  it("parses Atom entries with alternate links", () => {
    const items = parseFeed(atom);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      id: "tag:github.com,2008:Repository/1/v2.0.0",
      title: "v2.0.0",
      link: "https://github.com/o/r/releases/tag/v2.0.0",
      summary: "Added things",
    });
  });

  it("rejects unknown documents", () => {
    expect(() => parseFeed("<html></html>")).toThrow();
  });
});

describe("stripHtml", () => {
  it("truncates long text", () => {
    expect(stripHtml("a".repeat(400), 10)).toBe(`${"a".repeat(9)}…`);
  });
});
