import type { NewSignal, SignalKind } from "@factory/core";

/** A collector fetches finds from one external source and maps them to signals. */
export interface Collector {
  /** Stable id, stored as the signal `source`, e.g. "rss:anthropic-news". */
  id: string;
  kind: SignalKind;
  collect(): Promise<CollectedSignal[]>;
}

/** Collectors must set `externalId` so repeated runs dedupe. */
export type CollectedSignal = Omit<NewSignal, "id" | "source" | "kind" | "status" | "createdAt"> & {
  externalId: string;
};

export const collectors: Collector[] = [];
