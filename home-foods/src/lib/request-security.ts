/** Check a browser mutation against the public host when Next is behind a proxy. */
export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    const requestUrl = new URL(request.url);
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const host = forwardedHost || request.headers.get("host") || requestUrl.host;
    const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const protocol = forwardedProto ? `${forwardedProto.replace(/:$/, "")}:` : requestUrl.protocol;
    const publicOrigin = new URL(`${protocol}//${host}`).origin;
    return new URL(origin).origin === publicOrigin || new URL(origin).origin === requestUrl.origin;
  } catch {
    return false;
  }
}
