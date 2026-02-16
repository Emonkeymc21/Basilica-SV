const VIEWS = {
  home: "viewHome",
  announcements: "viewAnnouncements",
  announcementDetail: "viewAnnouncementDetail",
  songs: "viewSongs",
  songReader: "viewSongReader",
  prayers: "viewPrayers",
  saints: "viewSaints",
  history: "viewHistory",
  schedule: "viewSchedule",
  today: "viewToday",
  calendar: "viewCalendar",
};

let state = {
  songs: [],
  prayers: [],
  saints: [],
  history: null,
  schedule: null,
  announcements: [],
  events: [],
  today: null,
  category: "Todas",
  query: "",
  fontSize: 18,
  wakeLock: null,
  lastListView: "home",
};

function $(sel) { return document.querySelector(sel); }
function $all(sel) { return Array.from(document.querySelectorAll(sel)); }

function showView(key){
  $all(".view").forEach(v => v.classList.remove("view--active"));
  const id = VIEWS[key];
  if (!id) return;
  document.getElementById(id).classList.add("view--active");
}

function nav(key){
  state.lastListView = key;
  showView(key);
}

async function loadJSON(path){
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudo cargar " + path);
  return res.json();
}

function normalize(s){
  return (s || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function escapeHTML(str){
  return (str || "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}



/* -------------------- Utilidades de fecha -------------------- */
function pad2(n){ return String(n).padStart(2,"0"); }
function formatDateAR(date){
  // date: Date
  const d = pad2(date.getDate());
  const m = pad2(date.getMonth()+1);
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}
function formatTimeAR(date){
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}
function parseISO(iso){
  try { return new Date(iso); } catch { return null; }
}

/* -------------------- Hoy (Santo del día) -------------------- */
async function fetchSaintOfDay(){
  try{
    const res = await fetch("/.netlify/functions/saint-of-day", { cache: "no-store" });
    if(!res.ok) throw new Error("bad");
    return res.json();
  }catch(e){
    // fallback: link a un sitio confiable si la función no está disponible
    return {
      title: "Santo del día",
      url: "https://www.vaticannews.va/es.html",
      source: "fallback"
    };
  }
}

async function renderToday(){
  const now = new Date();
  const dateLabel = now.toLocaleDateString("es-AR", { weekday:"long", year:"numeric", month:"long", day:"numeric" });
  $("#todayDate").textContent = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);

  $("#todaySaintTitle").textContent = "Cargando…";
  $("#todaySaintHint").textContent = "";

  const data = await fetchSaintOfDay();
  state.today = data;

  $("#todaySaintTitle").textContent = data.title || "Santo del día";
  const link = $("#todaySaintLink");
  link.href = data.url || "#";

  const hint = data.source === "fallback"
    ? "No pude leer el santo automático ahora. Te dejo un enlace confiable."
    : (data.source ? `Fuente: ${data.source}` : "");
  $("#todaySaintHint").textContent = hint;
}

/* -------------------- Calendario -------------------- */
let calCursor = new Date();

function sameMonth(a,b){ return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth(); }

function eventBadgeColor(ev){
  const c = (ev.category||"").toLowerCase();
  return c.includes("formacion") ? "dot--gold" : "";
}

function renderCalendarAgenda(){
  const host = $("#calendarAgenda");
  const monthStart = new Date(calCursor.getFullYear(), calCursor.getMonth(), 1);
  const monthEnd = new Date(calCursor.getFullYear(), calCursor.getMonth()+1, 0, 23,59,59);

  const items = (state.events || [])
    .map(ev => ({...ev, _start: parseISO(ev.start), _end: parseISO(ev.end)}))
    .filter(ev => ev._start && ev._start >= monthStart && ev._start <= monthEnd)
    .sort((a,b)=> a._start - b._start);

  if(!items.length){
    host.innerHTML = '<div class="note">No hay actividades cargadas para este mes.</div>';
    return;
  }

  host.innerHTML = "";
  for(const ev of items){
    const el = document.createElement("div");
    el.className = "calendar__event";
    const day = formatDateAR(ev._start);
    const t1 = formatTimeAR(ev._start);
    const t2 = ev._end ? formatTimeAR(ev._end) : "";
    el.innerHTML = `
      <div class="calendar__eventTitle">${escapeHTML(ev.title || "Actividad")}</div>
      <div class="calendar__eventMeta">${escapeHTML(day)} · ${escapeHTML(t1)}${t2 ? "–"+escapeHTML(t2) : ""}${ev.location ? " · " + escapeHTML(ev.location) : ""}</div>
      ${ev.details ? `<div class="calendar__eventDetails">${escapeHTML(ev.details)}</div>` : ""}
    `;
    host.appendChild(el);
  }
}

function renderCalendarMonth(){
  const host = $("#calendarMonth");
  host.innerHTML = "";

  const first = new Date(calCursor.getFullYear(), calCursor.getMonth(), 1);
  const startDow = (first.getDay() + 6) % 7; // lunes=0
  const daysInMonth = new Date(calCursor.getFullYear(), calCursor.getMonth()+1, 0).getDate();

  // padding
  for(let i=0;i<startDow;i++){
    const pad = document.createElement("div");
    pad.className = "daycell";
    pad.style.opacity = "0";
    host.appendChild(pad);
  }

  const byDay = {};
  (state.events||[]).forEach(ev=>{
    const d = parseISO(ev.start);
    if(!d) return;
    if(d.getFullYear()===calCursor.getFullYear() && d.getMonth()===calCursor.getMonth()){
      const k = d.getDate();
      byDay[k] = byDay[k] || [];
      byDay[k].push(ev);
    }
  });

  for(let day=1; day<=daysInMonth; day++){
    const cell = document.createElement("div");
    cell.className = "daycell";
    const dots = (byDay[day]||[]).slice(0,4).map(ev => `<span class="dot ${eventBadgeColor(ev)}"></span>`).join("");
    cell.innerHTML = `<div class="daycell__n">${day}</div><div class="daycell__dots">${dots}</div>`;
    host.appendChild(cell);
  }
}

function updateCalendarHeader(){
  const label = calCursor.toLocaleDateString("es-AR", { month:"long", year:"numeric" });
  $("#calMonthLabel").textContent = label.charAt(0).toUpperCase() + label.slice(1);
}

function renderCalendar(){
  updateCalendarHeader();
  renderCalendarAgenda();
  renderCalendarMonth();
}

/* -------------------- Cancionero -------------------- */
function renderCategoryChips(){
  const el = $("#categoryChips");
  const cats = new Set(["Todas"]);
  state.songs.forEach(s => cats.add(s.category || "Sin categoría"));
  el.innerHTML = "";

  for (const c of cats){
    const b = document.createElement("button");
    b.className = "chip" + (state.category === c ? " chip--active" : "");
    b.textContent = c;
    b.addEventListener("click", () => {
      state.category = c;
      renderCategoryChips();
      renderSongsList();
    });
    el.appendChild(b);
  }
}

function renderSongsList(){
  const list = $("#songsList");
  const q = normalize(state.query);

  const filtered = state.songs.filter(s => {
    const catOk = state.category === "Todas" || (s.category || "Sin categoría") === state.category;
    if (!catOk) return false;

    if (!q) return true;
    const hay = normalize(s.title) + "\n" + normalize(s.lyrics) + "\n" + normalize((s.tags || []).join(" "));
    return hay.includes(q);
  });

  filtered.sort((a,b) => (a.title || "").localeCompare((b.title || ""), "es"));

  list.innerHTML = "";
  if (filtered.length === 0){
    list.innerHTML = `<div class="note">No encontré nada con ese filtro 😅</div>`;
    return;
  }

  filtered.forEach(song => {
    const item = document.createElement("button");
    item.className = "item item--pressable";
    item.innerHTML = `
      <div class="item__title">${escapeHTML(song.title)}</div>
      <div class="item__meta">${escapeHTML(song.category || "Sin categoría")}</div>
    `;
    item.addEventListener("click", () => openSong(song));
    list.appendChild(item);
  });
}

function openSong(song){
  $("#songTitle").textContent = song.title || "Canción";
  $("#songLyrics").textContent = song.lyrics || "";
  $("#songLyrics").style.fontSize = state.fontSize + "px";
  showView("songReader");
}

/* -------------------- Oraciones -------------------- */
function renderPrayers(){
  const list = $("#prayersList");
  list.innerHTML = "";
  state.prayers.forEach(p => {
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <div class="item__title">${escapeHTML(p.title)}</div>
      <div class="item__meta">${escapeHTML(p.category || "")}</div>
      <div style="margin-top:10px; white-space:pre-wrap; line-height:1.6">${escapeHTML(p.text)}</div>
    `;
    list.appendChild(item);
  });
}

/* -------------------- Santos -------------------- */
function renderSaints(){
  const today = new Date();
  const key = `${today.getMonth()+1}-${today.getDate()}`;
  const sod = state.saints.find(s => s.key === key) || null;

  $("#saintOfDay").textContent = sod
    ? `Santo del día: ${sod.name}\n\n${sod.short || ""}\n\nOración:\n${sod.prayer || ""}`
    : "Santo del día: (pendiente)\n\nPodés cargarlo en data/saints.json";

  const list = $("#saintsList");
  list.innerHTML = "";
  state.saints
    .slice()
    .sort((a,b) => (a.name||"").localeCompare((b.name||""), "es"))
    .forEach(s => {
      const item = document.createElement("div");
      item.className = "item";
      item.innerHTML = `
        <div class="item__title">${escapeHTML(s.name)}</div>
        <div class="item__meta">${escapeHTML(s.key || "")}</div>
        <div style="margin-top:10px; white-space:pre-wrap; line-height:1.6">${escapeHTML(s.short || "")}</div>
      `;
      list.appendChild(item);
    });
}

/* -------------------- Historia -------------------- */
function renderHistory(){
  const title = state.history?.title ? `${state.history.title}\n\n` : "";
  $("#historyPanel").textContent = title + (state.history?.text || "Historia (pendiente)\n\nEditá data/history.json");
}

/* -------------------- Horarios -------------------- */
function renderSchedule(){
  const panel = $("#schedulePanel");
  const address = $("#scheduleAddress");
  panel.innerHTML = "";

  if (!state.schedule){
    panel.innerHTML = `<div class="note">Horarios (pendiente). Editá data/schedule.json</div>`;
    return;
  }

  state.schedule.sections.forEach(sec => {
    const card = document.createElement("div");
    card.className = "schedule-card";
    card.innerHTML = `<div class="schedule-title">${escapeHTML(sec.title)}</div>`;
    sec.items.forEach(it => {
      const row = document.createElement("div");
      row.className = "schedule-item";
      row.innerHTML = `<span>${escapeHTML(it.label)}</span><strong>${escapeHTML(it.value)}</strong>`;
      card.appendChild(row);
    });
    panel.appendChild(card);
  });

  address.textContent = state.schedule.address || "";
}

/* -------------------- Novedades -------------------- */
function renderAnnouncements(){
  const list = $("#announcementsList");
  list.innerHTML = "";

  if (!state.announcements.length){
    list.innerHTML = `<div class="note">Todavía no hay novedades cargadas.</div>`;
    return;
  }

  state.announcements.forEach(a => {
    const item = document.createElement("button");
    item.className = "item item--pressable";
    item.innerHTML = `
      <div class="item__title">${escapeHTML(a.title)}</div>
      <div class="item__meta">${escapeHTML(a.when || "")}</div>
    `;
    item.addEventListener("click", () => openAnnouncement(a));
    list.appendChild(item);
  });
}

function openAnnouncement(a){
  $("#announcementImg").src = a.image || "";
  $("#announcementImg").alt = a.title || "Novedad";
  $("#announcementTitle").textContent = a.title || "";
  $("#announcementSubtitle").textContent = a.subtitle || "";
  $("#announcementWhen").textContent = a.when ? `🗓 ${a.when}` : "";
  $("#announcementWhere").textContent = a.where ? `📍 ${a.where}` : "";
  $("#announcementDetails").textContent = a.details || "";
  showView("announcementDetail");
}

/* -------------------- Wake Lock (pantalla encendida) -------------------- */
async function toggleWakeLock(){
  try{
    if (!("wakeLock" in navigator)){
      alert("Tu navegador no soporta mantener la pantalla encendida.");
      return;
    }
    if (state.wakeLock){
      await state.wakeLock.release();
      state.wakeLock = null;
      $("#btnWake").textContent = "Pantalla";
      return;
    }
    state.wakeLock = await navigator.wakeLock.request("screen");
    $("#btnWake").textContent = "Pantalla ✓";
    state.wakeLock.addEventListener("release", () => {
      state.wakeLock = null;
      $("#btnWake").textContent = "Pantalla";
    });
  }catch(e){
    alert("No pude activar pantalla encendida: " + e.message);
  }
}

/* -------------------- PWA install -------------------- */
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = $("#btnInstall");
  btn.hidden = false;
  btn.addEventListener("click", async () => {
    btn.hidden = true;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
  }, { once: true });
});

/* -------------------- Service Worker -------------------- */
if ("serviceWorker" in navigator){
  navigator.serviceWorker.register("sw.js").catch(()=>{});
}

/* -------------------- Init -------------------- */
async function init(){
  state.songs = await loadJSON("data/songs.json");
  state.prayers = await loadJSON("data/prayers.json");
  state.saints = await loadJSON("data/saints.json");
  state.history = await loadJSON("data/history.json");
  state.schedule = await loadJSON("data/schedule.json");
  state.announcements = await loadJSON("data/announcements.json");
  state.events = await loadJSON("data/events.json");

  renderCategoryChips();
  renderSongsList();
  renderPrayers();
  renderSaints();
  renderHistory();
  renderSchedule();
  renderAnnouncements();
  renderToday();
  renderCalendar();

  // Navegación general
  $all("[data-nav]").forEach(btn => {
    btn.addEventListener("click", () => nav(btn.dataset.nav));
  });

  // Botones "volver"
  $all("[data-back]").forEach(btn => {
    const target = btn.getAttribute("data-back") || "home";
    btn.addEventListener("click", () => showView(target));
  });

  $("#btnBackToSongs").addEventListener("click", () => showView("songs"));
  $("#btnBackToAnnouncements").addEventListener("click", () => showView("announcements"));

  // Buscador
  $("#songSearch").addEventListener("input", (e) => {
    state.query = e.target.value;
    renderSongsList();
  });

  // Fuente
  $("#fontMinus").addEventListener("click", () => {
    state.fontSize = Math.max(14, state.fontSize - 2);
    $("#songLyrics").style.fontSize = state.fontSize + "px";
  });
  $("#fontPlus").addEventListener("click", () => {
    state.fontSize = Math.min(34, state.fontSize + 2);
    $("#songLyrics").style.fontSize = state.fontSize + "px";
  });

  $("#btnWake").addEventListener("click", toggleWakeLock);

  // Hoy
  $("#btnReloadToday").addEventListener("click", renderToday);

  // Calendario
  $("#calPrev").addEventListener("click", () => { calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth()-1, 1); renderCalendar(); });
  $("#calNext").addEventListener("click", () => { calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth()+1, 1); renderCalendar(); });
  $("#btnAgenda").addEventListener("click", () => {
    $("#btnAgenda").classList.add("chip--active");
    $("#btnMonth").classList.remove("chip--active");
    $("#calendarAgenda").hidden = false;
    $("#calendarMonth").hidden = true;
  });
  $("#btnMonth").addEventListener("click", () => {
    $("#btnMonth").classList.add("chip--active");
    $("#btnAgenda").classList.remove("chip--active");
    $("#calendarAgenda").hidden = true;
    $("#calendarMonth").hidden = false;
  });
}

init().catch(err => {
  console.error(err);
  alert("Error cargando datos. Revisá la carpeta /data y los archivos JSON.");
});
