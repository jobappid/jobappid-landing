export async function onRequestPost(context) {
  try {
    const RESEND_API_KEY = context.env.RESEND_API_KEY;
    const EMAIL_TO = context.env.EMAIL_TO || "requestjobappid@gmail.com";
    const EMAIL_FROM = context.env.EMAIL_FROM || "JobAppID <noreply@jobappid.com>";

    if (!RESEND_API_KEY) {
      return json({ error: "Server missing RESEND_API_KEY." }, 500);
    }

    const body = await context.request.json();

    const first_name = s(body.first_name);
    const last_name = s(body.last_name);
    const email = s(body.email);
    const phone = s(body.phone);
    const street = s(body.street);
    const city = s(body.city);
    const state = s(body.state);
    const zip = s(body.zip);
    const notes = s(body.notes);

    if (!first_name || !last_name || !email || !street || !city || !state || !zip) {
      return json({ error: "Please fill out all required fields." }, 400);
    }
    if (!isEmail(email)) {
      return json({ error: "Please enter a valid email." }, 400);
    }

    const submittedAt = new Date().toISOString();

    const subject = `New JobAppID Request — ${first_name} ${last_name}`;

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.4">
        <h2>New JobAppID Request</h2>
        <p><strong>Submitted:</strong> ${escapeHtml(submittedAt)}</p>

        <h3>Contact</h3>
        <p>
          <strong>Name:</strong> ${escapeHtml(first_name)} ${escapeHtml(last_name)}<br/>
          <strong>Email:</strong> ${escapeHtml(email)}<br/>
          <strong>Phone:</strong> ${escapeHtml(phone || "(not provided)")}
        </p>

        <h3>Mailing Address</h3>
        <p>
          ${escapeHtml(street)}<br/>
          ${escapeHtml(city)}, ${escapeHtml(state)} ${escapeHtml(zip)}
        </p>

        <h3>Notes</h3>
        <p>${escapeHtml(notes || "(none)")}</p>

        <hr/>
        <p style="color:#666;font-size:12px">
          This request was submitted from jobappid.com
        </p>
      </div>
    `;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [EMAIL_TO],
        subject,
        html,
        reply_to: email, // so you can hit reply to contact the patron
      }),
    });

    if (!r.ok) {
      const t = await r.text().catch(() => "");
      return json({ error: "Email failed to send.", details: t }, 502);
    }

    return json({ ok: true }, 200);
  } catch (e) {
    return json({ error: "Server error." }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function s(v) {
  return String(v ?? "").trim();
}

function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || "").trim());
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
