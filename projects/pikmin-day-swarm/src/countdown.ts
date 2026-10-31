/** Countdown to November 1 (Pikmin Day), in the viewer's local time. */
export function pikminDay(now: Date): { today: boolean; label: string; msLeft: number } {
  const year = now.getFullYear();
  if (now.getMonth() === 10 && now.getDate() === 1) return { today: true, label: "Happy Pikmin Day!", msLeft: 0 };
  let target = new Date(year, 10, 1);
  if (target.getTime() <= now.getTime()) target = new Date(year + 1, 10, 1);
  const ms = target.getTime() - now.getTime();
  const mins = Math.floor(ms / 60_000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  const label =
    days >= 2 ? `Pikmin Day in ${days} days` : days === 1 ? `Pikmin Day in 1 day ${hours}h` : `Pikmin Day in ${hours}h ${String(m).padStart(2, "0")}m`;
  return { today: false, label, msLeft: ms };
}
