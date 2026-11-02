import { leaderboard, recordVote, validVote } from "../../src/store.ts";

export default async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return new Response("POST a vote", { status: 405, headers: { Allow: "POST" } });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Send JSON" }, { status: 400 });
  }
  const vote = validVote(body);
  if (!vote) return Response.json({ error: "Unknown models or outcome" }, { status: 400 });
  const key = await recordVote(vote);
  return Response.json(await leaderboard(key), { headers: { "Cache-Control": "no-store" } });
};

export const config = { path: "/api/vote" };
