import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { Db } from "./db.ts";
import {
  ideaSignals,
  ideas,
  settings,
  signals,
  type Idea,
  type IdeaStatus,
  type NewIdea,
  type NewSignal,
  type Signal,
  type SignalKind,
  type SignalStatus,
} from "./schema.ts";

export interface SignalFilter {
  kind?: SignalKind;
  status?: SignalStatus;
  limit?: number;
}

export function listSignals(db: Db, { kind, status, limit = 200 }: SignalFilter = {}) {
  const where = and(kind ? eq(signals.kind, kind) : undefined, status ? eq(signals.status, status) : undefined);
  return db.select().from(signals).where(where).orderBy(desc(signals.createdAt), desc(signals.id)).limit(limit);
}

/** New signals created since `since`, newest first: the input for idea generation. */
export function listFreshSignals(db: Db, since: Date, limit = 100): Promise<Signal[]> {
  return db
    .select()
    .from(signals)
    .where(and(eq(signals.status, "new"), gte(signals.createdAt, since)))
    .orderBy(desc(signals.createdAt), desc(signals.id))
    .limit(limit);
}

export async function getSignalsByIds(db: Db, ids: number[]): Promise<Signal[]> {
  if (ids.length === 0) return [];
  return db.select().from(signals).where(inArray(signals.id, ids));
}

export async function createSignal(db: Db, input: NewSignal): Promise<Signal> {
  const [row] = await db.insert(signals).values(input).returning();
  return row!;
}

/** Insert automated finds, skipping any (source, externalId) already stored. Returns inserted rows. */
export async function upsertSignals(db: Db, inputs: NewSignal[]): Promise<Signal[]> {
  if (inputs.length === 0) return [];
  return db.insert(signals).values(inputs).onConflictDoNothing().returning();
}

export async function setSignalStatus(db: Db, id: number, status: SignalStatus) {
  await db.update(signals).set({ status }).where(eq(signals.id, id));
}

export async function countSignalsByStatus(db: Db) {
  const rows = await db
    .select({ status: signals.status, count: sql<number>`count(*)` })
    .from(signals)
    .groupBy(signals.status);
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.count)])) as Partial<Record<SignalStatus, number>>;
}

export type IdeaWithSignalCount = Idea & { signalCount: number };

export async function listIdeas(db: Db): Promise<IdeaWithSignalCount[]> {
  const rows = await db
    .select({ idea: ideas, signalCount: sql<number>`count(${ideaSignals.signalId})` })
    .from(ideas)
    .leftJoin(ideaSignals, eq(ideaSignals.ideaId, ideas.id))
    .groupBy(ideas.id)
    .orderBy(desc(ideas.updatedAt), desc(ideas.id));
  return rows.map((r) => ({ ...r.idea, signalCount: Number(r.signalCount) }));
}

export type IdeaWithSignals = Idea & { signals: Signal[] };

/** Ideas in one status with their linked signals, newest first. */
export async function listIdeasWithSignals(db: Db, status: IdeaStatus): Promise<IdeaWithSignals[]> {
  const rows = await db
    .select()
    .from(ideas)
    .where(eq(ideas.status, status))
    .orderBy(desc(ideas.createdAt), desc(ideas.id));
  if (rows.length === 0) return [];
  const links = await db
    .select({ ideaId: ideaSignals.ideaId, signal: signals })
    .from(ideaSignals)
    .innerJoin(signals, eq(signals.id, ideaSignals.signalId))
    .where(
      inArray(
        ideaSignals.ideaId,
        rows.map((r) => r.id),
      ),
    )
    .orderBy(desc(signals.createdAt), desc(signals.id));
  const byIdea = new Map<number, Signal[]>();
  for (const { ideaId, signal } of links) byIdea.set(ideaId, [...(byIdea.get(ideaId) ?? []), signal]);
  return rows.map((idea) => ({ ...idea, signals: byIdea.get(idea.id) ?? [] }));
}

export async function countIdeasByStatus(db: Db) {
  const rows = await db
    .select({ status: ideas.status, count: sql<number>`count(*)` })
    .from(ideas)
    .groupBy(ideas.status);
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.count)])) as Partial<Record<IdeaStatus, number>>;
}

export async function getIdea(db: Db, id: number) {
  const idea = await db.query.ideas.findFirst({ where: eq(ideas.id, id) });
  if (!idea) return undefined;
  const linked = await db
    .select({ signal: signals })
    .from(ideaSignals)
    .innerJoin(signals, eq(signals.id, ideaSignals.signalId))
    .where(eq(ideaSignals.ideaId, id))
    .orderBy(desc(signals.createdAt));
  return { ...idea, signals: linked.map((l) => l.signal) };
}

export async function createIdea(db: Db, input: NewIdea, signalIds: number[] = []): Promise<Idea> {
  const [idea] = await db.insert(ideas).values(input).returning();
  await linkSignals(db, idea!.id, signalIds);
  return idea!;
}

export async function updateIdea(db: Db, id: number, patch: Partial<Pick<Idea, "title" | "pitch" | "notes" | "status">>) {
  await db.update(ideas).set(patch).where(eq(ideas.id, id));
}

export async function setIdeaStatus(db: Db, id: number, status: IdeaStatus) {
  await updateIdea(db, id, { status });
}

export async function setIdeasStatus(db: Db, ids: number[], status: IdeaStatus) {
  if (ids.length === 0) return;
  await db.update(ideas).set({ status }).where(inArray(ideas.id, ids));
}

export async function deleteIdea(db: Db, id: number) {
  await db.delete(ideaSignals).where(eq(ideaSignals.ideaId, id));
  await db.delete(ideas).where(eq(ideas.id, id));
}

/** Link signals to an idea and mark them as used. */
export async function linkSignals(db: Db, ideaId: number, signalIds: number[]) {
  if (signalIds.length === 0) return;
  await db
    .insert(ideaSignals)
    .values(signalIds.map((signalId) => ({ ideaId, signalId })))
    .onConflictDoNothing();
  await db.update(signals).set({ status: "used" }).where(inArray(signals.id, signalIds));
}

export async function unlinkSignal(db: Db, ideaId: number, signalId: number) {
  await db.delete(ideaSignals).where(and(eq(ideaSignals.ideaId, ideaId), eq(ideaSignals.signalId, signalId)));
}

export async function getSetting(db: Db, key: string): Promise<string | undefined> {
  const [row] = await db.select().from(settings).where(eq(settings.key, key));
  return row?.value;
}

export async function setSetting(db: Db, key: string, value: string) {
  await db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}
