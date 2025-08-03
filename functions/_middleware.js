export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // Read cookies
  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(/discordId=(\d+)/);
  const discordId = match ? match[1] : null;

  if (discordId) {
    const isWhitelisted = await env.ALLOWED_USERS.get(discordId);
    if (isWhitelisted) {
      return context.next(); // ✅ User is allowed, continue to requested resource
    }
  }

  // ⛔ Deny access if no cookie or not whitelisted
  return new Response("Access Denied", {
    status: 403,
    headers: {
      "Content-Type": "text/plain"
    }
  });
}
