export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  const path = url.pathname;
  console.log(`🔍 Middleware triggered for: ${path}`);

  const USERS_KV = env.USERS_KV;
  const authCookie = request.headers.get("Cookie") || "";
  const match = authCookie.match(/discord_id=([0-9]+)/);

  const discordId = match?.[1];
  const isAllowed = discordId ? await USERS_KV.get(discordId) : null;

  if (!isAllowed) {
    console.log("⛔ Access denied (not whitelisted):", discordId);
    return new Response("Access denied.", { status: 403 });
  }

  console.log("✅ Access granted:", discordId);
  return await next();
}
