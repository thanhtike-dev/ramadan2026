// Myanmar timezone
const TZ = "Asia/Yangon";

// ✅ Put your 30 days here.
// Date format: YYYY-MM-DD
// Time format: HH:MM (24h)
const RAMADAN = [
  // From your image (first 10 are readable)
  { day: 1, date: "2026-02-7", suhoorEnd: "05:14", iftar: "18:12" },
  { day: 2, date: "2026-02-8", suhoorEnd: "05:14", iftar: "18:12" },
  { day: 3, date: "2026-02-9", suhoorEnd: "05:13", iftar: "18:12" },
  { day: 4, date: "2026-02-22", suhoorEnd: "05:13", iftar: "18:13" },
  { day: 5, date: "2026-02-23", suhoorEnd: "05:12", iftar: "18:13" },
  { day: 6, date: "2026-02-24", suhoorEnd: "05:12", iftar: "18:13" },
  { day: 7, date: "2026-02-25", suhoorEnd: "05:11", iftar: "18:14" },
  { day: 8, date: "2026-02-26", suhoorEnd: "05:11", iftar: "18:14" },
  { day: 9, date: "2026-02-27", suhoorEnd: "05:10", iftar: "18:14" },
  { day: 10, date: "2026-02-28", suhoorEnd: "05:09", iftar: "18:14" },

  // TODO: Fill day 11–30 from your timetable
  // { day: 11, date: "2026-03-01", suhoorEnd: "05:09", iftar: "18:15" },
];

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

// Countdown date creation
// Note: If user opens from outside Myanmar timezone, countdown may be slightly off.
// Times display is still correct for Myanmar.
function makeLocalDate(ymd, hm) {
  const [Y, M, D] = ymd.split("-").map(Number);
  const [h, m] = hm.split(":").map(Number);
  return new Date(Y, M - 1, D, h, m, 0, 0);
}

function renderTable(adjust) {
  const tbody = el("tbody");
  tbody.innerHTML = "";

  const todayYMD = todayYMDinTZ(TZ);

  RAMADAN.forEach(row => {
    const tr = document.createElement("tr");
    if (row.date === todayYMD) tr.classList.add("today");

    const su = addMinutesToHHMM(row.suhoorEnd, adjust);
    const ift = addMinutesToHHMM(row.iftar, adjust);

    tr.innerHTML = `
      <td>${row.day}</td>
      <td>${row.date}</td>
      <td>${su}</td>
      <td>${ift}</td>
    `;
    tbody.appendChild(tr);
  });
}

function findTodayRow() {
  const todayYMD = todayYMDinTZ(TZ);
  return RAMADAN.find(r => r.date === todayYMD) || null;
}

function setTopCards(adjust) {
  const now = new Date();
  el("todayLabel").textContent = formatDateInTZ(now, TZ);

  const row = findTodayRow();
  if (!row) {
    el("dayLabel").textContent = "ယနေ့ရက်စွဲသည် ထည့်ထားသော ရမဇာန်ရက်စွဲများထဲတွင် မပါဝင်ပါ။";
    el("suhoor").textContent = "—";
    el("iftar").textContent = "—";
    el("nextEvent").textContent = "နောက်တစ်ခု: —";
    el("countdown").textContent = "—";
    return;
  }

  el("dayLabel").textContent = `ရမဇာန်နေ့ ${row.day} • ရက်စွဲ ${row.date}`;

  const su = addMinutesToHHMM(row.suhoorEnd, adjust);
  const ift = addMinutesToHHMM(row.iftar, adjust);
  el("suhoor").textContent = su;
  el("iftar").textContent = ift;

  const suDate = makeLocalDate(row.date, su);
  const iftDate = makeLocalDate(row.date, ift);

  let nextName = "";
  let nextTime = null;

  if (now < suDate) {
    nextName = "ဆူဟူးရ်ပြီးချိန်";
    nextTime = suDate;
  } else if (now < iftDate) {
    nextName = "အီဖ်တာရ်";
    nextTime = iftDate;
  } else {
    const idx = RAMADAN.findIndex(r => r.date === row.date);
    const tomorrow = RAMADAN[idx + 1];
    if (tomorrow) {
      nextName = "မနက်ဖြန် ဆူဟူးရ်ပြီးချိန်";
      nextTime = makeLocalDate(tomorrow.date, addMinutesToHHMM(tomorrow.suhoorEnd, adjust));
    } else {
      nextName = "—";
    }
  }

  el("nextEvent").textContent = `နောက်တစ်ခု: ${nextName}`;

  if (!nextTime) {
    el("countdown").textContent = "—";
    return;
  }

  const diffMs = nextTime - now;
  const s = Math.max(0, Math.floor(diffMs / 1000));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;

  el("countdown").textContent = `ကျန်ချိန် ${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`;
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

// Minimal timezone definition for Asia/Yangon (no DST, UTC+06:30)
function buildVTIMEZONE_AsiaYangon() {
  return [
    "BEGIN:VTIMEZONE",
    "TZID:Asia/Yangon",
    "X-LIC-LOCATION:Asia/Yangon",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:+0630",
    "TZOFFSETTO:+0630",
    "TZNAME:MMT",
    "DTSTART:19700101T000000",
    "END:STANDARD",
    "END:VTIMEZONE"
  ].join("\r\n");
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
    `DTSTART;TZID=Asia/Yangon:${dtstart}`,
    `DTEND;TZID=Asia/Yangon:${dtend}`,
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

function downloadICS({ includeSuhoor, includeIftar, adjustMinutes = 0, alarmMinutes = 10 }) {
  const lines = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//Ramadan Myanmar//Timetable//EN");
  lines.push("CALSCALE:GREGORIAN");
  lines.push("METHOD:PUBLISH");
  lines.push(buildVTIMEZONE_AsiaYangon());

  RAMADAN.forEach((row) => {
    const su = addMinutesToHHMM(row.suhoorEnd, adjustMinutes);
    const ift = addMinutesToHHMM(row.iftar, adjustMinutes);

    const dateLabel = `ရမဇာန်နေ့ ${row.day} (${row.date}) — Timezone: Asia/Yangon`;

    if (includeSuhoor) {
      lines.push(buildEvent({
        title: `ဆူဟူးရ်ပြီးချိန် • ${su}`,
        description: dateLabel,
        ymd: row.date,
        timeHHMM: su,
        alarmMinutes,
        uidSuffix: "suhoor"
      }));
    }

    if (includeIftar) {
      lines.push(buildEvent({
        title: `အီဖ်တာရ် • ${ift}`,
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
  // Load saved adjustment
  const saved = localStorage.getItem("adjustMinutes");
  if (saved !== null) el("adjust").value = saved;

  const apply = () => {
    const adjust = parseInt(el("adjust").value, 10) || 0;
    localStorage.setItem("adjustMinutes", String(adjust));
    renderTable(adjust);
    setTopCards(adjust);
  };

  el("adjust").addEventListener("change", apply);
  el("reset").addEventListener("click", () => {
    el("adjust").value = "0";
    apply();
  });

  el("printBtn").addEventListener("click", () => window.print());

  // ICS buttons
  const icsBtn = document.getElementById("icsBtn");
  const icsBothBtn = document.getElementById("icsBothBtn");

  if (icsBtn) {
    icsBtn.addEventListener("click", () => {
      const adjust = parseInt(document.getElementById("adjust").value, 10) || 0;
      // 10 minutes before by default
      downloadICS({ includeIftar: true, includeSuhoor: false, adjustMinutes: adjust, alarmMinutes: 10 });
    });
  }

  if (icsBothBtn) {
    icsBothBtn.addEventListener("click", () => {
      const adjust = parseInt(document.getElementById("adjust").value, 10) || 0;
      downloadICS({ includeIftar: true, includeSuhoor: true, adjustMinutes: adjust, alarmMinutes: 10 });
    });
  }

  // Show iOS calendar hint only on iOS
  (function showIosHint() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const hint = document.getElementById("iosHint");
    if (isIOS && hint) hint.style.display = "block";
  })();

  apply();

  // Update countdown every second
  setInterval(() => {
    const adjust = parseInt(el("adjust").value, 10) || 0;
    setTopCards(adjust);
  }, 1000);
}

init();