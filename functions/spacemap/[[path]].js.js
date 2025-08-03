export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const cookies = Object.fromEntries(
    request.headers.get("cookie")?.split("; ").map(c => c.trim().split("=")) ?? []
  );

  const discordId = cookies.discordId;

  if (!discordId) {
    return errorResponse("Missing login cookie", url.pathname);
  }

  const isAllowed = await env.ALLOWED_USERS.get(discordId);
  if (!isAllowed) {
    return errorResponse("Not whitelisted", url.pathname);
  }

  // ✅ Serve asset with CORS headers
  const response = await env.ASSETS.fetch(request);
  const headers = new Headers(response.headers);

  // Allow the game to fetch from your domain
  headers.set("Access-Control-Allow-Origin", "https://www.space-aces.com");
  headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  headers.set("Access-Control-Allow-Credentials", "true");

  return new Response(response.body, {
    status: response.status,
    headers
  });
}

// 🧠 Smart error formatting based on file type requested
function errorResponse(message, pathname) {
  if (pathname.endsWith(".json")) {
    return new Response(JSON.stringify({ error: message }), {
      status: 403,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }

  if (pathname.endsWith(".js")) {
    return new Response(`console.error(${JSON.stringify(message)});`, {
      status: 403,
      headers: {
        "Content-Type": "application/javascript",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }

  if (pathname.endsWith(".css")) {
    return new Response("/* Access Denied */", {
      status: 403,
      headers: {
        "Content-Type": "text/css",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }

  return new Response("Access Denied", {
    status: 403,
    headers: {
      "Content-Type": "text/plain",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
