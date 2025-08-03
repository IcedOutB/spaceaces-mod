export async function onRequest({ request }) {
  const host = new URL(request.url).hostname;

  // Block access from .pages.dev domains
  if (host.endsWith(".pages.dev")) {
    return new Response("Access denied.", { status: 403 });
  }

  // Allow request to continue
  return await fetch(request);
}
