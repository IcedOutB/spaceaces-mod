export async function onRequest(context) {
  const { request, env, next } = context;

  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/discordId=([^;]+)/);
  const discordId = match?.[1];

  if (!discordId) {
    return new Response("Access denied: no session cookie.", { status: 401 });
  }

  const isAllowed = await env.ALLOWED_USERS.get(discordId);
  if (!isAllowed) {
    return new Response("Access denied: not whitelisted.", { status: 403 });
  }

  return await next();
}
