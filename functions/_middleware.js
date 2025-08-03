export async function onRequest({ request, env }) {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/discordId=([^;]+)/);
  const discordId = match?.[1];

  if (!discordId) {
    return new Response("Access denied: Not logged in", { status: 403 });
  }

  const isAllowed = await env.ALLOWED_USERS.get(discordId);
  if (!isAllowed) {
    return new Response("Access denied: You are not whitelisted", { status: 403 });
  }

  return; // Allow request
}
