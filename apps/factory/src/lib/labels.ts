import type { IdeaStatus, SignalKind } from "@factory/core";

export const kindLabels: Record<SignalKind, string> = {
  model_release: "Model release",
  tooling_release: "Tooling release",
  culture: "Pop culture",
  interest: "Interest",
  other: "Other",
};

export const ideaStatusLabels: Record<IdeaStatus, string> = {
  inbox: "Inbox",
  shortlisted: "Shortlisted",
  specced: "Specced",
  building: "Building",
  shipped: "Shipped",
  archived: "Archived",
};

export function timeAgo(date: Date, now = new Date()): string {
  const s = Math.max(0, Math.round((now.getTime() - date.getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 60) return `${d}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function hostname(url: string | null): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}
