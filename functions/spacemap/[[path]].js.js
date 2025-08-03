export async function onRequest({ request, env }) {
  const cookies = Object.fromEntries(
    request.headers.get("cookie")?.split("; ").map(c => c.trim().split("=")) ?? []
  );

  const discordId = cookies.discordId;
  if (!discordId) {
    return new Response("Access Denied (no cookie)", {
      status: 403,
      headers: {
        "Access-Control-Allow-Origin": "*", // optional for debugging, see below
      },
    });
  }

  const isAllowed = await env.ALLOWED_USERS.get(discordId);
  if (!isAllowed) {
    return new Response("Access Denied (not whitelisted)", {
      status: 403,
      headers: {
        "Access-Control-Allow-Origin": "*", // optional for debugging, see below
      },
    });
  }

  // ✅ Allow cross-origin if user is whitelisted
  const assetResponse = await env.ASSETS.fetch(request);
  const newHeaders = new Headers(assetResponse.headers);
  newHeaders.set("Access-Control-Allow-Origin", "*"); // or set to 'https://www.space-aces.com' for tighter control

  return new Response(assetResponse.body, {
    status: assetResponse.status,
    headers: newHeaders,
  });
}
