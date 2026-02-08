const form = document.getElementById("requestForm");
const msg = document.getElementById("formMsg");
const btn = document.getElementById("submitBtn");
document.getElementById("year").textContent = String(new Date().getFullYear());

function setMsg(text, kind) {
  msg.className = "msg" + (kind ? " " + kind : "");
  msg.textContent = text || "";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg("", "");
  btn.disabled = true;

  const fd = new FormData(form);
  const payload = Object.fromEntries(fd.entries());

  try {
    setMsg("Sending request...", "");
    const res = await fetch("/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setMsg(data?.error || "Something went wrong. Please try again.", "err");
      btn.disabled = false;
      return;
    }

    form.reset();
    setMsg(
      "Request sent! Expect your JobAppID to arrive in 7–10 business days.",
      "ok"
    );
  } catch (err) {
    setMsg("Network error. Please try again.", "err");
  } finally {
    btn.disabled = false;
  }
});
