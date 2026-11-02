import { leaderboard } from "../../src/store.ts";

export default async (): Promise<Response> =>
  Response.json(await leaderboard(), {
    headers: {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Netlify-CDN-Cache-Control": "public, s-maxage=15, stale-while-revalidate=60",
    },
  });

export const config = { path: "/api/leaderboard" };
