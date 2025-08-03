export async function onRequest(context) {
  const { request, env, next } = context;

  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(/discordId=([^;]+)/);
  const discordId = match?.[1];

  if (!discordId) {
    console.log("⛔ No discordId cookie");
    return new Response("No session. Please log in.", { status: 401 });
  }

  console.log("🍪 Found discordId cookie:", discordId);

  const isAllowed = await env.ALLOWED_USERS.get(discordId);
  if (!isAllowed) {
    console.log("⛔ User not whitelisted:", discordId);
    return new Response("Access denied", { status: 403 });
  }

  console.log("✅ User is whitelisted:", discordId);
  return next();
}
