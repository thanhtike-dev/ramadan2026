// ==============================
// Location-based Ramadan timetable (Aladhan)
// ==============================

// Default timezone is auto-detected; can be overridden by city preset.
let APP_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

// Runtime dataset (replaces hardcoded RAMADAN)
let RAMADAN = [];

// Aladhan config
const ALADHAN_BASE = "https://api.aladhan.com/v1";
const CALC_METHOD = 1; // 1 = Karachi (often closer to Myanmar local timetables)

// City presets (small starter set; users worldwide should prefer Auto GPS)
const CITY_PRESETS = {
  yangon: { name: "Yangon", lat: 16.7870, lon: 96.1656, tz: "Asia/Yangon" },
  bago: { name: "Bago", lat: 17.3369, lon: 96.4797, tz: "Asia/Yangon" },
  pathein: { name: "Pathein", lat: 16.7704, lon: 94.7321, tz: "Asia/Yangon" },
  mandalay: { name: "Mandalay", lat: 21.9588, lon: 96.0891, tz: "Asia/Yangon" },
  naypyidaw: { name: "Naypyidaw", lat: 19.7633, lon: 96.0785, tz: "Asia/Yangon" },
  taunggyi: { name: "Taunggyi", lat: 20.7892, lon: 97.0378, tz: "Asia/Yangon" },
  pyay: { name: "Pyay", lat: 18.8249, lon: 95.2222, tz: "Asia/Yangon" },
  monywa: { name: "Monywa", lat: 22.1086, lon: 95.1331, tz: "Asia/Yangon" },
  lashio: { name: "Lashio", lat: 22.9359, lon: 97.7498, tz: "Asia/Yangon" },
  magway: { name: "Magway", lat: 20.1496, lon: 94.9329, tz: "Asia/Yangon" },
  mawlamyine: { name: "Mawlamyine", lat: 16.4849, lon: 97.6260, tz: "Asia/Yangon" },
  myitkyina: { name: "Myitkyina", lat: 25.3837, lon: 97.3961, tz: "Asia/Yangon" },
  sagaing: { name: "Sagaing", lat: 21.8787, lon: 95.9780, tz: "Asia/Yangon" },
  sittwe: { name: "Sittwe", lat: 20.1462, lon: 92.8986, tz: "Asia/Yangon" },
  hpaan: { name: "Hpa-An", lat: 16.8891, lon: 97.6348, tz: "Asia/Yangon" },
  dawei: { name: "Dawei", lat: 14.0822, lon: 98.1915, tz: "Asia/Yangon" },
  myeik: { name: "Myeik", lat: 12.4395, lon: 98.6003, tz: "Asia/Yangon" },
};

const LOC_KEY = "ramadan_loc_v1";

// Optional: force Ramadan Day 1 to start from a specific Gregorian date for Myanmar.
// Useful when local moon-sighting differs by 1 day from calculated Hijri conversion.
const RAMADAN_START_OVERRIDES_MYANMAR_BY_YEAR = {
  2026: "2026-02-19",
};

function isInMyanmar(lat, lon) {
  // Rough bounding box for Myanmar
  return lat >= 9 && lat <= 29 && lon >= 92 && lon <= 102;
}

function applyRamadanStartOverride(days, year, lat, lon) {
  const start = RAMADAN_START_OVERRIDES_MYANMAR_BY_YEAR[Number(year)];
  if (!start) return days;
  if (!isInMyanmar(lat, lon)) return days;

  // Keep days starting from the override date and take first 30
  const filtered = days.filter(d => d.date >= start);
  return filtered.slice(0, 30);
}

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = value;
}

function stripTz(timeStr) {
  // Aladhan returns e.g. "05:12 (MMT)"; keep "05:12"
  return (timeStr || "").split(" ")[0].trim();
}

function cacheKey({ year, lat, lon, tz, method }) {
  return `ramadan_cache_v6_${year}_${lat.toFixed(4)}_${lon.toFixed(4)}_${tz}_${method}`;
}

async function fetchCalendarMonth({ year, month, lat, lon, tz, method }) {
  const url = new URL(`${ALADHAN_BASE}/calendar`);
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("method", String(method));
  url.searchParams.set("month", String(month));
  url.searchParams.set("year", String(year));
  url.searchParams.set("timezonestring", tz);

  const res = await fetch(url.toString(), { cache: "no-store" });
  const json = await res.json();
  if (!json || json.code !== 200 || !Array.isArray(json.data)) {
    throw new Error("Unexpected Aladhan response");
  }
  return json.data;
}

async function fetchRamadanByLatLon({ year, lat, lon, tz, method = CALC_METHOD }) {
  // Ramadan can span across Gregorian months; fetch a safe set then filter Hijri month=9.
  const monthsToTry = [12, 1, 2, 3, 4, 5];
  const key = cacheKey({ year, lat, lon, tz, method });

  // Cache for 7 days
  const cached = localStorage.getItem(key);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (parsed?.savedAt && (Date.now() - parsed.savedAt) < 7 * 24 * 60 * 60 * 1000) {
        return parsed.data;
      }
    } catch {}
  }

  let days = [];

  for (const month of monthsToTry) {
    const cal = await fetchCalendarMonth({ year, month, lat, lon, tz, method });

    for (const item of cal) {
      const hijriMonth = Number(item?.date?.hijri?.month?.number);
      if (hijriMonth !== 9) continue;

      // Aladhan gregorian date is "DD-MM-YYYY"
      const ddmmyyyy = item?.date?.gregorian?.date;
      if (!ddmmyyyy) continue;
      const [dd, mm, yyyy] = ddmmyyyy.split("-");
      const iso = `${yyyy}-${mm}-${dd}`;

      const fajr = stripTz(item?.timings?.Fajr);
      const maghrib = stripTz(item?.timings?.Maghrib);

      days.push({
        date: iso,
        suhoorEnd: addMinutesToHHMM(fajr, -3),
        iftar: addMinutesToHHMM(maghrib, +3),
      });
    }
  }

  // Sort, optionally align Day 1 to local calendar, then assign day numbers
  days.sort((a, b) => a.date.localeCompare(b.date));
  days = applyRamadanStartOverride(days, year, lat, lon);
  days = days.map((x, i) => ({ day: i + 1, ...x }));

  localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data: days }));
  return days;
}

function saveLoc(loc) {
  localStorage.setItem(LOC_KEY, JSON.stringify(loc));
}

function loadLoc() {
  try {
    return JSON.parse(localStorage.getItem(LOC_KEY) || "null");
  } catch {
    return null;
  }
}

function getGPSLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Geolocation not supported"));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

async function loadRamadanDataForMode({ mode, cityKey, year }) {
  // Determine tz/label/coords
  if (mode === "city") {
    const preset = CITY_PRESETS[cityKey] || CITY_PRESETS.yangon;
    APP_TZ = preset.tz;
    setText("tzLabel", APP_TZ);
    setText("locLabel", preset.name);

    RAMADAN = await fetchRamadanByLatLon({ year, lat: preset.lat, lon: preset.lon, tz: APP_TZ, method: CALC_METHOD });
    saveLoc({ mode: "city", cityKey });
    return;
  }

  // Auto GPS
  APP_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  setText("tzLabel", APP_TZ);
  setText("locLabel", "Getting GPS…");

  const { lat, lon } = await getGPSLocation();
  setText("locLabel", `${lat.toFixed(3)}, ${lon.toFixed(3)}`);

  RAMADAN = await fetchRamadanByLatLon({ year, lat, lon, tz: APP_TZ, method: CALC_METHOD });
  saveLoc({ mode: "auto", lat, lon, tz: APP_TZ });
}

function getUserTZ() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

const el = (id) => document.getElementById(id);
const pad2 = (n) => String(n).padStart(2, "0");

function addMinutesToHHMM(hhmm, mins) {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + mins;
  const t = (total % (24 * 60) + (24 * 60)) % (24 * 60);
  return `${pad2(Math.floor(t / 60))}:${pad2(t % 60)}`;
}

// For display: show date in Myanmar locale, in Asia/Yangon
function formatDateInTZ(date, tz) {
  return new Intl.DateTimeFormat("my-MM", {
    timeZone: tz,
    year: "numeric",
    month: "short",
    day: "2-digit",
    weekday: "short",
  }).format(date);
}

function todayYMDinTZ(tz) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const y = parts.find(p => p.type === "year").value;
  const m = parts.find(p => p.type === "month").value;
  const d = parts.find(p => p.type === "day").value;
  return `${y}-${m}-${d}`;
}

// Countdown uses the device's local time. Display/today-highlighting uses APP_TZ.
function makeLocalDate(ymd, hm) {
  const [Y, M, D] = ymd.split("-").map(Number);
  const [h, m] = hm.split(":").map(Number);
  return new Date(Y, M - 1, D, h, m, 0, 0);
}

function renderTable() {
  const tbody = el("tbody");
  tbody.innerHTML = "";

  const todayYMD = todayYMDinTZ(APP_TZ);

  RAMADAN.forEach(row => {
    const tr = document.createElement("tr");
    if (row.date === todayYMD) tr.classList.add("today");

    const su = row.suhoorEnd;
    const ift = row.iftar;

    tr.innerHTML = `
      <td>${row.day}</td>
      <td>${row.date}</td>
      <td>${su}</td>
      <td>${ift}</td>
    `;
    tbody.appendChild(tr);
  });
}

function setTableStatus(message) {
  const tbody = el("tbody");
  if (!tbody) return;
  tbody.innerHTML = `
    <tr class="status-row">
      <td colspan="4">${message}</td>
    </tr>
  `;
}

function findTodayRow() {
  const todayYMD = todayYMDinTZ(APP_TZ);
  return RAMADAN.find(r => r.date === todayYMD) || null;
}

function setTopCards() {
  const now = new Date();
  if (el("todayLabel")) el("todayLabel").textContent = formatDateInTZ(now, APP_TZ);

  const row = findTodayRow();
  if (!row) {
    if (el("dayLabel")) el("dayLabel").textContent = "ယနေ့ရက်စွဲသည် ထည့်ထားသော ရမဇာန်ရက်စွဲများထဲတွင် မပါဝင်ပါ။";
    if (el("suhoor")) el("suhoor").textContent = "--:--";
    if (el("iftar")) el("iftar").textContent = "--:--";
    if (el("nextEvent")) el("nextEvent").textContent = "--:--";
    if (el("countdown")) el("countdown").textContent = "--:--";
    return;
  }

  if (el("dayLabel")) el("dayLabel").textContent = `ရမဇာန်နေ့ ${row.day}`;

  const su = row.suhoorEnd;
  const ift = row.iftar;
  if (el("suhoor")) el("suhoor").textContent = su;
  if (el("iftar")) el("iftar").textContent = ift;

  const suDate = makeLocalDate(row.date, su);
  const iftDate = makeLocalDate(row.date, ift);

  let nextName = "";
  let nextTime = null;

  if (now < suDate) {
    nextName = "ဝါပိတ်ရန်";
    nextTime = suDate;
  } else if (now < iftDate) {
    nextName = "ဝါဖြေရန်";
    nextTime = iftDate;
  } else {
    const idx = RAMADAN.findIndex(r => r.date === row.date);
    const tomorrow = RAMADAN[idx + 1];
    if (tomorrow) {
      nextName = "မနက်ဖြန် ဝါပိတ်ရန်";
      nextTime = makeLocalDate(tomorrow.date, tomorrow.suhoorEnd);
    } else {
      nextName = "—";
    }
  }

  el("nextEvent").textContent = `${nextName}`;

  if (!nextTime) {
    el("countdown").textContent = "--:--";
    return;
  }

  const diffMs = nextTime - now;
  const s = Math.max(0, Math.floor(diffMs / 1000));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;

  el("countdown").textContent = `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`;
}

/* =========================
   iOS Calendar (.ics) Export
   ========================= */

function ymdToICSDateTime(ymd, hhmm) {
  const [Y, M, D] = ymd.split("-");
  const [h, m] = hhmm.split(":");
  return `${Y}${M}${D}T${h}${m}00`;
}

function nowUTCStamp() {
  const d = new Date();
  const Y = d.getUTCFullYear();
  const M = String(d.getUTCMonth() + 1).padStart(2, "0");
  const D = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  const s = String(d.getUTCSeconds()).padStart(2, "0");
  return `${Y}${M}${D}T${h}${m}${s}Z`;
}

function buildEvent({ title, description, ymd, timeHHMM, alarmMinutes, uidSuffix }) {
  const dtstamp = nowUTCStamp();
  const dtstart = ymdToICSDateTime(ymd, timeHHMM);

  // 5-minute duration
  const [h, m] = timeHHMM.split(":").map(Number);
  const endTotal = h * 60 + m + 5;
  const endH = String(Math.floor(endTotal / 60) % 24).padStart(2, "0");
  const endM = String(endTotal % 60).padStart(2, "0");
  const dtend = ymdToICSDateTime(ymd, `${endH}:${endM}`);

  const uid = `ramadan-mm-${ymd}-${timeHHMM.replace(":","")}-${uidSuffix}@local`;

  return [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    "BEGIN:VALARM",
    `TRIGGER:-PT${alarmMinutes}M`,
    "ACTION:DISPLAY",
    `DESCRIPTION:${title}`,
    "END:VALARM",
    "END:VEVENT"
  ].join("\r\n");
}

function downloadICS({ includeSuhoor, includeIftar, alarmMinutes = 10 }) {
  const lines = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//Ramadan Myanmar//Timetable//EN");
  lines.push("CALSCALE:GREGORIAN");
  lines.push("METHOD:PUBLISH");

  RAMADAN.forEach((row) => {
    const su = row.suhoorEnd;
    const ift = row.iftar;

    const dateLabel = `ရမဇာန်နေ့ ${row.day} (${row.date}) — Timezone: ${APP_TZ}`;

    if (includeSuhoor) {
      lines.push(buildEvent({
        title: `ဝါပိတ်ချိန် • ${su}`,
        description: dateLabel,
        ymd: row.date,
        timeHHMM: su,
        alarmMinutes,
        uidSuffix: "suhoor"
      }));
    }

    if (includeIftar) {
      lines.push(buildEvent({
        title: `ဝါဖြေချိန် • ${ift}`,
        description: dateLabel,
        ymd: row.date,
        timeHHMM: ift,
        alarmMinutes,
        uidSuffix: "iftar"
      }));
    }
  });

  lines.push("END:VCALENDAR");

  const ics = lines.join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = includeSuhoor && includeIftar ? "ramadan-mm-iftar-suhoor.ics" : "ramadan-mm-iftar.ics";
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/* =========
   Init App
   ========= */

function init() {
  // Clear old caches on update
  const CACHE_VERSION = "v2";
  const lastVersion = localStorage.getItem("appCacheVersion");
  if (lastVersion !== CACHE_VERSION) {
    localStorage.clear();
    localStorage.setItem("appCacheVersion", CACHE_VERSION);
  }
  el("printBtn").addEventListener("click", () => window.print());

  // ICS buttons
  const icsBtn = document.getElementById("icsBtn");
  const icsBothBtn = document.getElementById("icsBothBtn");

  if (icsBtn) {
    icsBtn.addEventListener("click", () => {
      // 10 minutes before by default
      downloadICS({ includeIftar: true, includeSuhoor: false, alarmMinutes: 10 });
    });
  }

  if (icsBothBtn) {
    icsBothBtn.addEventListener("click", () => {
      downloadICS({ includeIftar: true, includeSuhoor: true, alarmMinutes: 10 });
    });
  }

  // Show iOS calendar hint only on iOS
  (function showIosHint() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const hint = document.getElementById("iosHint");
    if (isIOS && hint) hint.style.display = "block";
  })();

  // Location controls (added in index.html)
  const locationMode = document.getElementById("locationMode");
  const citySelect = document.getElementById("citySelect");
  const cityField = document.getElementById("cityField");
  const useLocationBtn = document.getElementById("useLocation");
  const themeToggle = document.getElementById("themeToggle");

  // Hydrate saved location choice
  const savedLoc = loadLoc();
  if (savedLoc?.mode === "city" && locationMode) locationMode.value = "city";
  if (savedLoc?.mode === "city" && savedLoc?.cityKey && citySelect) citySelect.value = savedLoc.cityKey;

  function syncLocationUI() {
    const mode = locationMode?.value || "auto";
    if (!citySelect || !useLocationBtn) return;

    if (mode === "city") {
      if (cityField) cityField.style.display = "";
      citySelect.style.display = "";
      useLocationBtn.style.display = "none";
    } else {
      citySelect.style.display = "none";
      if (cityField) cityField.style.display = "none";
      useLocationBtn.style.display = "";
    }
  }

  function setTheme(theme) {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    if (themeToggle) {
      const isDark = theme === "dark";
      themeToggle.setAttribute("aria-checked", isDark ? "true" : "false");
    }
  }

  function initTheme() {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
      return;
    }
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(prefersDark ? "dark" : "light");
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const next = current === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
  }

  function setUseLocationLoading(isLoading) {
    if (!useLocationBtn) return;
    if (!useLocationBtn.dataset.label) {
      useLocationBtn.dataset.label = useLocationBtn.textContent || "📍 အသုံးပြုမယ်";
    }
    useLocationBtn.disabled = !!isLoading;
    useLocationBtn.classList.toggle("loading", !!isLoading);
    useLocationBtn.setAttribute("aria-busy", isLoading ? "true" : "false");
    useLocationBtn.textContent = isLoading ? "Loading..." : useLocationBtn.dataset.label;
  }

  async function refreshDataAndRender() {
    const mode = locationMode?.value || "auto";
    const cityKey = citySelect?.value || "yangon";
    const cityName = CITY_PRESETS[cityKey]?.name || "ရွေးထားသောမြို့";

    // Default: current Gregorian year (works for most use; you can add a year selector later)
    const year = new Date().getFullYear();

    // Disable controls while loading
    if (useLocationBtn) useLocationBtn.disabled = true;
    if (locationMode) locationMode.disabled = true;
    if (citySelect) citySelect.disabled = true;
    if (mode === "city") {
      setTableStatus(`${cityName} အတွက် ဒေတာ ရယူနေပါတယ်…`);
    } else {
      setTableStatus("လက်ရှိတည်နေရာအတွက် ဒေတာ ရယူနေပါတယ်…");
    }

    try {
      await loadRamadanDataForMode({ mode, cityKey, year });

      renderTable();
      setTopCards();
    } catch (err) {
      console.error(err);
      setTableStatus("ဒေတာ ရယူမရပါ။ ခဏနောက်ထပ်စမ်းကြည့်ပါ။");
      alert("Failed to load timetable for your location. Please check internet/GPS permissions and try again.");
    } finally {
      if (useLocationBtn) useLocationBtn.disabled = false;
      if (locationMode) locationMode.disabled = false;
      if (citySelect) citySelect.disabled = false;
    }
  }

  if (locationMode) {
    locationMode.addEventListener("change", () => {
      syncLocationUI();
      if (locationMode.value === "city") refreshDataAndRender();
      else {
        setText("tzLabel", getUserTZ());
        setText("locLabel", "latitude/longitude");
      }
    });
  }

  if (citySelect) citySelect.addEventListener("change", refreshDataAndRender);
  if (useLocationBtn) {
    useLocationBtn.addEventListener("click", async () => {
      setUseLocationLoading(true);
      try {
        await refreshDataAndRender();
      } finally {
        setUseLocationLoading(false);
      }
    });
  }

  if (themeToggle) {
    themeToggle.addEventListener("click", toggleTheme);
    themeToggle.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleTheme();
      }
    });
  }

  initTheme();

  syncLocationUI();

  // Initial data load
  (async () => {
    // If saved city mode, load immediately; otherwise show hint until user taps 📍
    if (savedLoc?.mode === "city") {
      await refreshDataAndRender();
    } else {
      setText("tzLabel", getUserTZ());
      setText("locLabel", "latitude/longitude");
    }
  })();

  // Update countdown every second
  setInterval(() => {
    setTopCards();
  }, 1000);
}

init();
