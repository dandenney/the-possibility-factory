import { defineMiddleware } from "astro:middleware";
import { authEnabled, isValidSession, SESSION_COOKIE } from "@/lib/auth";

const PUBLIC_PATHS = new Set(["/login"]);

export const onRequest = defineMiddleware((context, next) => {
  if (import.meta.env.PROD && !authEnabled) {
    return new Response("FACTORY_PASSWORD must be set in production.", { status: 500 });
  }
  if (PUBLIC_PATHS.has(context.url.pathname) || isValidSession(context.cookies.get(SESSION_COOKIE)?.value)) {
    return next();
  }
  const nextPath = context.url.pathname + context.url.search;
  return context.redirect(`/login?next=${encodeURIComponent(nextPath)}`);
});
