import { GITHUB_DISPATCH_TOKEN } from "astro:env/server";

const REPO = "dandenney/the-possibility-factory";
const WORKFLOW = "daily.yml";

export const RUNS_URL = `https://github.com/${REPO}/actions/workflows/${WORKFLOW}`;
export const canDispatch = Boolean(GITHUB_DISPATCH_TOKEN);

/** Starts the daily collect + generate workflow; resolves to whether GitHub accepted it. */
export async function dispatchDailyRun(): Promise<boolean> {
  if (!GITHUB_DISPATCH_TOKEN) return false;
  const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GITHUB_DISPATCH_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "possibility-factory",
    },
    body: JSON.stringify({ ref: "main", inputs: { generate: true } }),
  });
  return res.status === 204;
}
