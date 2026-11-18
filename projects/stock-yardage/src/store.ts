/** Saving, loading, and merging state. No DOM beyond the Storage interface. */
import { initialState, VENUES, type Player, type Shot, type State } from "./model.ts";

export const SAVE_KEY = "stock-yardage:v1";

export function load(storage: Pick<Storage, "getItem">): State {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return initialState();
    const s = JSON.parse(raw) as State;
    if (!Array.isArray(s.players) || !Array.isArray(s.shots) || !s.players.length) return initialState();
    if (!s.players.some((p) => p.id === s.current?.playerId)) {
      s.current = { ...initialState().current, playerId: s.players[0]!.id };
    }
    if (!VENUES.includes(s.current.venue)) s.current.venue = "range";
    return s;
  } catch {
    return initialState();
  }
}

export function save(storage: Pick<Storage, "setItem">, state: State): void {
  storage.setItem(SAVE_KEY, JSON.stringify(state));
}

/**
 * Merge another device's data in. Shots dedupe by id; a player that exists
 * on both sides keeps local clubs and gains any clubs only the other side has.
 */
export function merge(local: State, incoming: { players: Player[]; shots: Shot[] }): { state: State; added: number } {
  const players = local.players.map((p) => ({ ...p, clubs: [...p.clubs] }));
  for (const ip of incoming.players) {
    const lp = players.find((p) => p.id === ip.id);
    if (!lp) {
      players.push({ ...ip, clubs: [...ip.clubs] });
      continue;
    }
    for (const c of ip.clubs) if (!lp.clubs.some((x) => x.id === c.id)) lp.clubs.push({ ...c });
  }
  const seen = new Set(local.shots.map((s) => s.id));
  const fresh = incoming.shots.filter((s) => !seen.has(s.id) && players.some((p) => p.id === s.playerId));
  return { state: { ...local, players, shots: [...local.shots, ...fresh] }, added: fresh.length };
}
