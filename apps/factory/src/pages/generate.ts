import type { APIRoute } from "astro";
import { dispatchDailyRun } from "@/lib/github";

export const POST: APIRoute = async ({ redirect }) => {
  const started = await dispatchDailyRun();
  return redirect(`/interests?run=${started ? "started" : "failed"}`);
};
