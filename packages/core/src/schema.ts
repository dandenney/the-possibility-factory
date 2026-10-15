import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const SIGNAL_KINDS = ["model_release", "tooling_release", "culture", "interest", "other"] as const;
export const SIGNAL_STATUSES = ["new", "used", "dismissed"] as const;
export const IDEA_STATUSES = ["inbox", "shortlisted", "specced", "building", "shipped", "archived"] as const;
export const ORIGINS = ["manual", "automation"] as const;

export type SignalKind = (typeof SIGNAL_KINDS)[number];
export type SignalStatus = (typeof SIGNAL_STATUSES)[number];
export type IdeaStatus = (typeof IDEA_STATUSES)[number];
export type Origin = (typeof ORIGINS)[number];

const createdAt = () =>
  integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`);

export const signals = sqliteTable(
  "signals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    kind: text("kind", { enum: SIGNAL_KINDS }).notNull().default("other"),
    status: text("status", { enum: SIGNAL_STATUSES }).notNull().default("new"),
    title: text("title").notNull(),
    url: text("url"),
    note: text("note"),
    /** "manual" or a collector id such as "rss:anthropic-news". */
    source: text("source").notNull().default("manual"),
    /** Stable id from the source, used to dedupe automated finds. */
    externalId: text("external_id"),
    publishedAt: integer("published_at", { mode: "timestamp" }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("signals_source_external_id").on(t.source, t.externalId),
    index("signals_status_created").on(t.status, t.createdAt),
  ],
);

export const ideas = sqliteTable(
  "ideas",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    pitch: text("pitch"),
    notes: text("notes"),
    status: text("status", { enum: IDEA_STATUSES }).notNull().default("inbox"),
    origin: text("origin", { enum: ORIGINS }).notNull().default("manual"),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`)
      .$onUpdate(() => new Date()),
  },
  (t) => [index("ideas_status").on(t.status)],
);

export const ideaSignals = sqliteTable(
  "idea_signals",
  {
    ideaId: integer("idea_id")
      .notNull()
      .references(() => ideas.id, { onDelete: "cascade" }),
    signalId: integer("signal_id")
      .notNull()
      .references(() => signals.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.ideaId, t.signalId] })],
);

export type Signal = typeof signals.$inferSelect;
export type NewSignal = typeof signals.$inferInsert;
export type Idea = typeof ideas.$inferSelect;
export type NewIdea = typeof ideas.$inferInsert;
