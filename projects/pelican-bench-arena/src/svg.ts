const SVG_BLOCK = /<svg[\s>][\s\S]*<\/svg>/i;

/** Pulls the first complete <svg>…</svg> out of a model reply (handles code fences and chatter). */
export function extractSvg(reply: string): string | null {
  const match = reply.match(SVG_BLOCK);
  if (!match) return null;
  let svg = match[0];
  // A reply can contain several SVGs; keep the first one only.
  const firstClose = svg.toLowerCase().indexOf("</svg>");
  const nested = svg.slice(4).search(/<svg[\s>]/i);
  if (nested !== -1 && nested + 4 > firstClose) svg = svg.slice(0, firstClose + 6);
  return svg;
}

/** Removes anything that could run code or load remote content, and makes the SVG scale to its box. */
export function sanitizeSvg(svg: string): string {
  let out = svg
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<script[^>]*\/>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(?:xlink:)?href\s*=\s*("|')\s*(?:javascript:|https?:|\/\/)[^"']*\1/gi, "")
    .replace(/@import[^;]*;?/gi, "")
    .replace(/url\(\s*['"]?\s*(?:https?:|\/\/|javascript:)[^)]*\)/gi, "none");

  const open = out.match(/<svg\b[^>]*>/i);
  if (open) {
    let tag = open[0];
    if (!/\sxmlns\s*=/.test(tag)) tag = tag.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
    if (!/\sviewBox\s*=/.test(tag)) {
      const w = Number.parseFloat(tag.match(/\swidth\s*=\s*["']?([\d.]+)/i)?.[1] ?? "");
      const h = Number.parseFloat(tag.match(/\sheight\s*=\s*["']?([\d.]+)/i)?.[1] ?? "");
      if (w > 0 && h > 0) tag = tag.replace(/<svg\b/i, `<svg viewBox="0 0 ${w} ${h}"`);
    }
    out = out.replace(open[0], tag);
  }
  return out.trim() + "\n";
}

/** Rough "is this actually a drawing" check so empty or broken replies count as failures. */
export function looksDrawable(svg: string): boolean {
  const shapes = svg.match(/<(path|circle|ellipse|rect|line|polyline|polygon)\b/gi);
  return (shapes?.length ?? 0) >= 3;
}
