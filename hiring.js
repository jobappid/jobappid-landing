(() => {
  const API_BASE = window.JOBAPPID_API_BASE || "https://api.jobappid.com";

  const US_STATES = [
    ["AL","Alabama"],["AK","Alaska"],["AZ","Arizona"],["AR","Arkansas"],["CA","California"],
    ["CO","Colorado"],["CT","Connecticut"],["DE","Delaware"],["FL","Florida"],["GA","Georgia"],
    ["HI","Hawaii"],["ID","Idaho"],["IL","Illinois"],["IN","Indiana"],["IA","Iowa"],["KS","Kansas"],
    ["KY","Kentucky"],["LA","Louisiana"],["ME","Maine"],["MD","Maryland"],["MA","Massachusetts"],
    ["MI","Michigan"],["MN","Minnesota"],["MS","Mississippi"],["MO","Missouri"],["MT","Montana"],
    ["NE","Nebraska"],["NV","Nevada"],["NH","New Hampshire"],["NJ","New Jersey"],["NM","New Mexico"],
    ["NY","New York"],["NC","North Carolina"],["ND","North Dakota"],["OH","Ohio"],["OK","Oklahoma"],
    ["OR","Oregon"],["PA","Pennsylvania"],["RI","Rhode Island"],["SC","South Carolina"],
    ["SD","South Dakota"],["TN","Tennessee"],["TX","Texas"],["UT","Utah"],["VT","Vermont"],
    ["VA","Virginia"],["WA","Washington"],["WV","West Virginia"],["WI","Wisconsin"],["WY","Wyoming"]
  ];

  const $ = (id) => document.getElementById(id);

  const stateSelect = $("stateSelect");
  const citySelect = $("citySelect");
  const refreshBtn = $("refreshBtn");
  const results = $("results");
  const resultsCount = $("resultsCount");
  const errorBox = $("errorBox");

  function setError(msg) {
    if (!errorBox) return;
    if (!msg) {
      errorBox.style.display = "none";
      errorBox.textContent = "";
      return;
    }
    errorBox.style.display = "block";
    errorBox.textContent = msg;
  }

  function setCount(msg) {
    if (resultsCount) resultsCount.textContent = msg || "";
  }

  function clearResults() {
    if (results) results.innerHTML = "";
  }

  function escapeHtml(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // Extract position names from array that might contain strings OR objects
  function positionsText(row) {
    const hiring = !!row.is_hiring;
    if (!hiring) return "No positions listed";

    const raw = Array.isArray(row.open_positions) ? row.open_positions : [];

    const names = raw
      .map((p) => {
        if (typeof p === "string") return p.trim();
        if (!p || typeof p !== "object") return "";
        return String(
          p.title ||
          p.name ||
          p.position_title ||
          p.position ||
          ""
        ).trim();
      })
      .filter(Boolean);

    return names.length ? names.join(", ") : "No positions listed";
  }

  // Renders a single business row as a bullet line
  function renderBizRow(row) {
  const hiring = !!row.is_hiring;

  const pillClass = hiring ? "pill pill-ok" : "pill pill-off";
  const pillText = hiring ? "Hiring" : "Not hiring";
  const posText = positionsText(row);

  return `
    <div class="biz-row">
      <div class="biz-row-head">
        <div class="biz-row-title">
          <span class="biz-bullet">•</span>
          <span class="biz-name">${escapeHtml(row.business_name || "")}</span>
          <span class="${pillClass}" style="margin-left:10px;">${pillText}</span>
        </div>
      </div>

      <div class="biz-row-sub">
        ${escapeHtml(row.city || "")}, ${escapeHtml(row.state || "")} ${escapeHtml(row.zip || "")}
      </div>

      <div class="biz-row-pos">
        <span class="label">Positions:</span> ${escapeHtml(posText)}
      </div>

      <div class="biz-divider"></div>
    </div>
  `;
}

  // Group by "City, ST"
  function groupRows(rows) {
    const map = new Map(); // key -> array

    rows.forEach((r) => {
      const city = String(r.city || "").trim() || "Unknown City";
      const st = String(r.state || "").trim() || "??";
      const key = `${city}|||${st}`;

      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    });

    // Convert to array sorted by city
    const groups = Array.from(map.entries()).map(([key, list]) => {
      const [city, st] = key.split("|||");
      // sort businesses alphabetically
      list.sort((a, b) => String(a.business_name || "").localeCompare(String(b.business_name || "")));
      return { city, st, list };
    });

    groups.sort((a, b) => {
      if (a.st !== b.st) return a.st.localeCompare(b.st);
      return a.city.localeCompare(b.city);
    });

    return groups;
  }

  function renderGrouped(rows) {
  const groups = groupRows(rows);

  return groups.map((g) => {
    const header = `${g.city}, ${g.st}`;
    return `
      <div class="group">
        <div class="group-title">• ${escapeHtml(header)}</div>
        <div class="group-body">
          ${g.list.map(renderBizRow).join("")}
        </div>
      </div>
    `;
  }).join("");
}

  async function apiGet(path, params) {
    const url = new URL(API_BASE + path);

    Object.entries(params || {}).forEach(([k, v]) => {
      if (v == null) return;
      const s = String(v).trim();
      if (!s) return;
      url.searchParams.set(k, s);
    });

    const resp = await fetch(url.toString(), { method: "GET" });
    const json = await resp.json().catch(() => ({}));

    if (!resp.ok || !json || json.ok !== true) {
      const msg = json?.error?.message || `Request failed (${resp.status})`;
      throw new Error(msg);
    }

    return json;
  }

  async function loadCitiesForState(stateCode) {
    if (!citySelect) return;

    const prev = citySelect.value || "";

    citySelect.disabled = true;
    citySelect.innerHTML = `<option value="">Loading cities…</option>`;

    const json = await apiGet("/api/public/cities", { state: stateCode });
    const cities = Array.isArray(json.data) ? json.data : [];

    citySelect.innerHTML = `<option value="">All cities</option>`;
    cities.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      citySelect.appendChild(opt);
    });

    if (prev && cities.includes(prev)) citySelect.value = prev;

    citySelect.disabled = false;

    setCount(`Loaded ${cities.length} cities. Choose a city (optional) or click Refresh.`);
  }

  async function loadHiring() {
    setError("");
    clearResults();
    setCount("Loading…");

    const st = stateSelect?.value || "";
    const city = citySelect?.value || "";

    const json = await apiGet("/api/public/hiring", { state: st, city });
    const rows = Array.isArray(json.data) ? json.data : [];

    setCount(`${rows.length} business${rows.length === 1 ? "" : "es"} found`);

    if (!rows.length) {
      results.innerHTML = `<div class="empty">No businesses found for this selection.</div>`;
      return;
    }

    // ✅ NEW: grouped output
    results.innerHTML = renderGrouped(rows);
  }

  function initStateDropdown() {
    if (!stateSelect) return;

    stateSelect.innerHTML = `<option value="">Select a state</option>`;
    US_STATES.forEach(([code, name]) => {
      const opt = document.createElement("option");
      opt.value = code;
      opt.textContent = `${code} — ${name}`;
      stateSelect.appendChild(opt);
    });
  }

  async function onStateChange() {
    setError("");
    clearResults();
    setCount("Loading…");

    const st = stateSelect?.value || "";
    if (!st) {
      citySelect.disabled = true;
      citySelect.innerHTML = `<option value="">Select a state first</option>`;
      setCount("Select a state to begin.");
      return;
    }

    try {
      await loadCitiesForState(st);
      await loadHiring();
    } catch (e) {
      setError(e?.message || "Failed to load cities.");
      citySelect.disabled = true;
      citySelect.innerHTML = `<option value="">(Cities unavailable)</option>`;
    }
  }

  function wire() {
    initStateDropdown();

    if (citySelect) {
      citySelect.disabled = true;
      citySelect.innerHTML = `<option value="">Select a state first</option>`;
    }

    if (stateSelect) stateSelect.addEventListener("change", () => onStateChange());
    if (citySelect) citySelect.addEventListener("change", () => loadHiring().catch((e) => setError(e.message)));
    if (refreshBtn) refreshBtn.addEventListener("click", () => loadHiring().catch((e) => setError(e.message)));

    setCount("Select a state to begin.");
  }

  wire();
})();