export async function onRequest({ request, env }) {
  const cookies = Object.fromEntries(
    request.headers.get("cookie")?.split("; ").map(c => c.split("=")) ?? []
  );

  const discordId = cookies.discordId;

  if (!discordId) {
    return new Response("Access Denied (no cookie)", { status: 403 });
  }

  const isAllowed = await env.ALLOWED_USERS.get(discordId);
  if (!isAllowed) {
    return new Response("Access Denied (not whitelisted)", { status: 403 });
  }

  // Allow access
  return await env.ASSETS.fetch(request);
}
