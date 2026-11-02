import type { Sample } from "./types.ts";

export interface Matchup {
  left: Sample;
  right: Sample;
}

/**
 * Picks two samples from different models. At least one side is a featured (new this week) model
 * most of the time, and the pair just shown is avoided when there's an alternative.
 */
export function pickMatchup(
  samples: Sample[],
  featured: Set<string>,
  previous: Matchup | null = null,
  random: () => number = Math.random,
): Matchup | null {
  const byModel = new Map<string, Sample[]>();
  for (const s of samples) byModel.set(s.model, [...(byModel.get(s.model) ?? []), s]);
  const models = [...byModel.keys()];
  if (models.length < 2) return null;

  const pick = <T>(list: T[]): T => list[Math.floor(random() * list.length)]!;
  const lastPair = previous ? [previous.left.model, previous.right.model].sort().join("|") : "";

  for (let attempt = 0; attempt < 12; attempt++) {
    const featuredModels = models.filter((m) => featured.has(m));
    const first = featuredModels.length > 0 && random() < 0.75 ? pick(featuredModels) : pick(models);
    const second = pick(models.filter((m) => m !== first));
    const pair = [first, second].sort().join("|");
    if (pair === lastPair && attempt < 11) continue;
    const [leftModel, rightModel] = random() < 0.5 ? [first, second] : [second, first];
    return { left: pick(byModel.get(leftModel)!), right: pick(byModel.get(rightModel)!) };
  }
  return null;
}
