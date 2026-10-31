import * as Sentry from "@sentry/nextjs";
type BeforeSend = NonNullable<
  NonNullable<Parameters<typeof Sentry.init>[0]>["beforeSend"]
>;
type SentryEvent = Parameters<BeforeSend>[0];
function scrub(event: SentryEvent) {
  delete event.user;
  delete event.extra;
  delete event.contexts;
  delete event.tags;
  delete event.transaction;
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.headers;
    const requestUrl = event.request.url;
    if (requestUrl) {
      event.request.url = requestUrl
        .split("?")[0]!
        .replace(/(certificates|students|reports)\/[^/]+/g, "$1/[id]");
    }
    if (event.request.query_string) event.request.query_string = "[redacted]";
  }
  if (event.message) event.message = "[redacted application error]";
  if (event.logentry?.message)
    event.logentry.message = "[redacted application error]";
  for (const exception of event.exception?.values ?? [])
    if (exception.value) exception.value = "[redacted]";
  for (const crumb of event.breadcrumbs ?? []) {
    delete crumb.data;
    if (crumb.message) crumb.message = "[redacted]";
  }
  return event;
}
export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" ||
    process.env.NEXT_RUNTIME === "edge"
  ) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0,
      sendDefaultPii: false,
      beforeSend: scrub,
    });
  }
}
export const onRequestError = Sentry.captureRequestError;
