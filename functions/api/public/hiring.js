export async function onRequest(context) {
  const { request, env } = context;

  // CORS
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders()
    });
  }

  if (request.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const SUPABASE_URL = String(env.SUPABASE_URL || "").trim();
  const SUPABASE_SERVICE_ROLE_KEY = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(
      { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY on Cloudflare environment." },
      500
    );
  }

  // Pull from your view/table that is already designed for public consumption
  const url =
    `${SUPABASE_URL.replace(/\/+$/, "")}` +
    `/rest/v1/business_hiring_public` +
    `?select=business_id,business_name,state,city,zip,is_hiring,open_positions` +
    `&order=state.asc,city.asc,business_name.asc`;

  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json"
      }
    });

    const text = await resp.text();

    if (!resp.ok) {
      return json(
        {
          error: "Supabase fetch failed",
          status: resp.status,
          details: safeJson(text) ?? text
        },
        500
      );
    }

    const data = safeJson(text);
    if (!Array.isArray(data)) {
      return json({ error: "Unexpected Supabase response (not array).", raw: data ?? text }, 500);
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders(), "Content-Type": "application/json" }
    });
  } catch (e) {
    return json({ error: e?.message || "Unknown error" }, 500);
  }
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" }
  });
}

function safeJson(s) {
  try { return JSON.parse(s); } catch { return null; }
}