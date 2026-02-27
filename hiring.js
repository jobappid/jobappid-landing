/* hiring.js — JobAppID Who’s Hiring (State -> City -> Results)
   - No search bar
   - State dropdown shows ALL 50 states
   - City dropdown loads cities for selected state
   - Results show business name + hiring status + optional positions
*/

/** Optional API base override:
 *  - If you deploy API under same domain, leave blank.
 *  - If you need a different host, set:
 *      <meta name="jobappid-api-base" content="https://api.yourdomain.com">
 *    OR
 *      window.JOBAPPID_API_BASE = "https://api.yourdomain.com";
 */
function getApiBase() {
  const meta = document.querySelector('meta[name="jobappid-api-base"]');
  const metaBase = meta ? String(meta.getAttribute("content") || "").trim() : "";
  const winBase = typeof window !== "undefined" ? String(window.JOBAPPID_API_BASE || "").trim() : "";
  const base = metaBase || winBase || ""; // "" means same-origin
  return base.replace(/\/+$/, "");
}

// We call /api/public/* (same as your Express routes)
const API_BASE = getApiBase();

function apiUrl(path) {
  // path should start with "/api/..."
  return `${API_BASE}${path}`;
}

// 50 states (always show these in the dropdown)
const US_STATES = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" }
];

const el = (id) => document.getElementById(id);

const stateSelect = el("stateSelect");
const citySelect = el("citySelect");
const refreshBtn = el("refreshBtn");
const resultsEl = el("results");
const resultsCountEl = el("resultsCount");
const errorBoxEl = el("errorBox");

function setError(msg) {
  if (!errorBoxEl) return;
  if (!msg) {
    errorBoxEl.style.display = "none";
    errorBoxEl.textContent = "";
    return;
  }
  errorBoxEl.style.display = "block";
  errorBoxEl.textContent = msg;
}

function setCount(text) {
  if (resultsCountEl) resultsCountEl.textContent = text;
}

function setResultsHtml(html) {
  if (resultsEl) resultsEl.innerHTML = html;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toTitle(s) {
  const v = String(s || "").trim();
  if (!v) return "";
  // "pekin" -> "Pekin", "new york" -> "New York"
  return v
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function normalizeCity(s) {
  // Keep as user expects; Title Case is usually friendlier
  return toTitle(s);
}

function readSelectValue(selectEl) {
  if (!selectEl) return "";
  return String(selectEl.value || "").trim();
}

async function fetchJson(url) {
  const resp = await fetch(url, { method: "GET" });
  let json = null;
  try {
    json = await resp.json();
  } catch {
    json = null;
  }
  if (!resp.ok) {
    const msg = json?.error?.message || `Request failed (HTTP ${resp.status})`;
    throw new Error(msg);
  }
  if (!json || json.ok !== true) {
    const msg = json?.error?.message || "Request failed.";
    throw new Error(msg);
  }
  return json;
}

function fillStateDropdown() {
  if (!stateSelect) return;

  stateSelect.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select a state";
  stateSelect.appendChild(placeholder);

  for (const s of US_STATES) {
    const opt = document.createElement("option");
    opt.value = s.code;
    opt.textContent = `${s.code} — ${s.name}`;
    stateSelect.appendChild(opt);
  }
}

function resetCityDropdown() {
  if (!citySelect) return;
  citySelect.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select a city";
  citySelect.appendChild(placeholder);
  citySelect.disabled = true;
}

function fillCityDropdown(cities) {
  if (!citySelect) return;

  citySelect.innerHTML = "";

  // Allow "All cities" (empty value) once state is selected
  const allOpt = document.createElement("option");
  allOpt.value = "";
  allOpt.textContent = "All cities";
  citySelect.appendChild(allOpt);

  for (const c of cities || []) {
    const cityName = normalizeCity(c);
    if (!cityName) continue;
    const opt = document.createElement("option");
    opt.value = cityName;
    opt.textContent = cityName;
    citySelect.appendChild(opt);
  }

  citySelect.disabled = false;
}

function renderBusinesses(data, state, city) {
  const items = Array.isArray(data) ? data : [];

  if (!state) {
    setCount("Select a state to view results.");
    setResultsHtml("");
    return;
  }

  if (!items.length) {
    setCount(city ? `No businesses found in ${city}, ${state}.` : `No businesses found in ${state}.`);
    setResultsHtml(`<div class="empty">No results.</div>`);
    return;
  }

  // Group by city (helps readability without adding a search bar)
  const groups = new Map();
  for (const row of items) {
    const c = normalizeCity(row?.city || "Unknown");
    if (!groups.has(c)) groups.set(c, []);
    groups.get(c).push(row);
  }

  const groupKeys = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b));

  let html = "";
  let total = 0;

  for (const c of groupKeys) {
    const rows = groups.get(c) || [];
    total += rows.length;

    html += `<div class="city-group">
      <div class="city-title">${escapeHtml(c)}, ${escapeHtml(state)}</div>
      <div class="cards">`;

    for (const r of rows) {
      const name = String(r?.business_name || "Business").trim();
      const isHiring = !!r?.is_hiring;

      const pillClass = isHiring ? "pill pill-ok" : "pill pill-no";
      const pillText = isHiring ? "Actively Hiring" : "Not Hiring";

      // open_positions might be:
      // - array of strings
      // - array of objects
      // - string
      // - null
      let positions = [];
      const op = r?.open_positions;

      if (Array.isArray(op)) {
        positions = op
          .map((x) => {
            if (typeof x === "string") return x.trim();
            if (x && typeof x === "object") {
              // common shape guesses without breaking:
              return String(x.title || x.name || x.position || "").trim();
            }
            return "";
          })
          .filter(Boolean);
      } else if (typeof op === "string") {
        // If it's a CSV-ish string
        positions = op
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);
      }

      const positionsHtml =
        positions.length > 0
          ? `<div class="positions">
              <div class="positions-title">Open positions</div>
              <ul class="positions-list">
                ${positions.slice(0, 12).map((p) => `<li>${escapeHtml(p)}</li>`).join("")}
              </ul>
            </div>`
          : `<div class="positions muted">Positions not listed.</div>`;

      html += `<div class="biz-card">
          <div class="biz-top">
            <div class="biz-name">${escapeHtml(name)}</div>
            <div class="${pillClass}">${escapeHtml(pillText)}</div>
          </div>

          <div class="biz-sub muted">
            ${escapeHtml(normalizeCity(r?.city || ""))}${r?.zip ? ` • ${escapeHtml(r.zip)}` : ""}
          </div>

          ${positionsHtml}
        </div>`;
    }

    html += `</div></div>`;
  }

  setCount(`${total} business${total === 1 ? "" : "es"} found${city ? ` in ${city}, ${state}` : ` in ${state}`}.`);
  setResultsHtml(html);
}

async function loadCitiesForState(stateCode) {
  setError("");
  resetCityDropdown();

  if (!stateCode) return;

  setCount("Loading cities…");
  try {
    const json = await fetchJson(apiUrl(`/api/public/cities?state=${encodeURIComponent(stateCode)}`));
    const cities = Array.isArray(json.cities) ? json.cities : [];
    fillCityDropdown(cities);
    setCount("Select a city (or All cities).");
  } catch (e) {
    setError(e?.message || "Failed to load cities.");
    setCount("Error loading cities.");
  }
}

async function loadHiringResults() {
  setError("");

  const state = readSelectValue(stateSelect);
  const city = readSelectValue(citySelect);

  if (!state) {
    renderBusinesses([], "", "");
    return;
  }

  setCount("Loading…");
  setResultsHtml("");

  const qs = new URLSearchParams();
  qs.set("state", state);
  if (city) qs.set("city", city);

  const url = apiUrl(`/api/public/hiring?${qs.toString()}`);

  try {
    const json = await fetchJson(url);
    renderBusinesses(json.data || [], state, city);
  } catch (e) {
    setError(e?.message || "Failed to load results.");
    setCount("Error loading results.");
    setResultsHtml("");
  }
}

function attachEvents() {
  if (stateSelect) {
    stateSelect.addEventListener("change", async () => {
      const state = readSelectValue(stateSelect);

      // reset city each time state changes
      resetCityDropdown();

      if (!state) {
        setCount("Select a state to view results.");
        setResultsHtml("");
        return;
      }

      await loadCitiesForState(state);
      await loadHiringResults(); // show "All cities" results immediately
    });
  }

  if (citySelect) {
    citySelect.addEventListener("change", async () => {
      await loadHiringResults();
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      await loadHiringResults();
    });
  }
}

async function init() {
  fillStateDropdown();
  resetCityDropdown();
  attachEvents();

  // Default UI text
  setCount("Select a state to view results.");
  setResultsHtml("");

  // Optional: if you ever want to auto-select a state via URL (?state=IL&city=Chicago)
  const url = new URL(window.location.href);
  const qsState = String(url.searchParams.get("state") || "").trim().toUpperCase();
  const qsCity = String(url.searchParams.get("city") || "").trim();

  if (qsState && stateSelect) {
    stateSelect.value = qsState;
    await loadCitiesForState(qsState);

    if (citySelect) {
      // Try to match city
      const wanted = normalizeCity(qsCity);
      if (wanted) {
        const opts = Array.from(citySelect.options).map((o) => String(o.value || ""));
        if (opts.includes(wanted)) citySelect.value = wanted;
      }
    }

    await loadHiringResults();
  }
}

init();