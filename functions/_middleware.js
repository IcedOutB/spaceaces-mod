export async function onRequest({ request }) {
  const referer = request.headers.get("referer") || "";
  const origin = request.headers.get("origin") || "";
  const allowedHost = "https://boc-vanilla.com";

  if (!referer.startsWith(allowedHost) && !origin.startsWith(allowedHost)) {
    return new Response("Access Denied", { status: 403 });
  }

  return await fetch(request);
}
