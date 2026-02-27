export async function onRequestGet(context) {
  // ✅ CHANGE THIS to your real API base (NO trailing slash)
  // Examples:
  //   https://api.jobappid.com
  //   https://YOURSERVERDOMAIN.com
  const API_BASE = "https://api.jobappid.com";

  const url = new URL(context.request.url);

  // Forward query params (state, city, q, hiring)
  const upstream = new URL(API_BASE.replace(/\/+$/, "") + "/api/public/hiring");
  upstream.search = url.search; // pass through any filters

  const resp = await fetch(upstream.toString(), {
    method: "GET",
    headers: {
      "Accept": "application/json"
    }
  });

  // Pass-through response body
  const body = await resp.text();

  return new Response(body, {
    status: resp.status,
    headers: {
      "Content-Type": "application/json",
      // same-origin call now, but harmless to keep
      "Cache-Control": "no-store"
    }
  });
}
