import { SIGNAL_STATUSES, setSignalStatus } from "@factory/core";
import type { APIRoute } from "astro";
import { getDb } from "@/lib/db";
import { oneOf, safeNext, str } from "@/lib/forms";

export const POST: APIRoute = async ({ params, request, redirect }) => {
  const id = Number(params.id);
  const form = await request.formData();
  const status = oneOf(str(form, "status"), SIGNAL_STATUSES);
  if (!Number.isInteger(id) || !status) return new Response("Bad request", { status: 400 });
  await setSignalStatus(getDb(), id, status);
  const referer = request.headers.get("referer");
  const back = referer ? new URL(referer) : undefined;
  return redirect(safeNext(back ? back.pathname + back.search : undefined, "/signals"));
};
