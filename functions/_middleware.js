export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  const path = url.pathname;

  const USERS_KV = env.USERS_KV;
  const authCookie = request.headers.get("Cookie") || "";
  const match = authCookie.match(/discord_id=([0-9]+)/);

  const discordId = match?.[1];
  const isAllowed = discordId ? await USERS_KV.get(discordId) : null;

  if (!isAllowed) {
    return new Response("Access denied.", { status: 403 });
  }

  // Allow request to proceed to static file or route
  return await next();
}
