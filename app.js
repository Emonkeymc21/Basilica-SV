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
  songbooks: [],
  events: [],
  currentSongbook: "all",
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

function updateNavStrip(activeKey){
  $all(".navstrip__item").forEach(btn => {
    const k = btn.dataset.nav;
    btn.classList.toggle("is-active", k === activeKey);
  });
}

function nav(key){
  state.lastListView = key;
  showView(key);
  updateNavStrip(key);
  if (key === "today") updateSaintOfDay();
  if (key === "calendar") renderCalendar();
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

/* -------------------- Cancionero -------------------- */

function renderSongbooksSelect(){
  const sel = document.getElementById("songbookSelect");
  const hint = document.getElementById("songbookHint");
  if (!sel) return;

  const books = state.songbooks || [];
  sel.innerHTML = books.map(b => `<option value="${b.id}">${b.title}</option>`).join("");
  sel.value = state.currentSongbook || "all";
  const current = books.find(b => b.id === sel.value);
  if (hint) hint.textContent = current?.description || "";

  sel.addEventListener("change", () => {
    state.currentSongbook = sel.value;
    const c = books.find(b => b.id === sel.value);
    if (hint) hint.textContent = c?.description || "";
    renderSongsList();
  });
}


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
    const book = state.currentSongbook || "all";
    const sb = s.songbooks || ["all"];
    const songbookOk = book === "all" || sb.includes(book);
    if (!songbookOk) return false;

    if (!q) return true;
    const hay = normalize(s.title) + "\n" + normalize(s.lyrics) + "\n" + normalize((s.tags || []).join(" "));
    return hay.includes(q);
  });

  filtered.sort((a,b) => (a.title || "").localeCompare((b.title || ""), "es"));

  list.innerHTML = "";
  if (filtered.length === 0){
    list.innerHTML = `<div class="note">No encontré canciones en este cancionero 😅</div>`;
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
  const panel = $("#historyPanel");
  if (!panel) return;

  if (!state.history){
    panel.textContent = "Historia (pendiente). Editá data/history.json";
    return;
  }

  // Compatibilidad: si existe "text" lo mostramos; si no, usamos secciones.
  if (state.history.text){
    const title = state.history?.title ? `${state.history.title}

` : "";
    panel.textContent = title + state.history.text;
    return;
  }

  panel.innerHTML = "";
  if (state.history.title){
    const h = document.createElement("h2");
    h.textContent = state.history.title;
    panel.appendChild(h);
  }
  if (state.history.subtitle){
    const p = document.createElement("div");
    p.className = "muted";
    p.style.marginTop = "-6px";
    p.style.marginBottom = "12px";
    p.textContent = state.history.subtitle;
    panel.appendChild(p);
  }

  (state.history.sections || []).forEach(sec => {
    const card = document.createElement("div");
    card.className = "card card--pad";
    const head = sec.heading ? `<div class="card__title">${escapeHTML(sec.heading)}</div>` : "";
    const body = sec.body ? `<div class="card__text">${escapeHTML(sec.body)}</div>` : "";
    card.innerHTML = head + body;
    panel.appendChild(card);
  });
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
  renderScheduleSummer();
}

function renderScheduleSummer(){
  const panel = $("#schedulePanel");
  if (!panel || !state.scheduleSummer) return;
  const sec = state.scheduleSummer;
  const card = document.createElement("div");
  card.className = "schedule-card";
  card.innerHTML = `<div class="schedule-title">${escapeHTML(sec.title || "Horarios de Verano 2026")}</div>`;
  (sec.items||[]).forEach(it => {
    const row = document.createElement("div");
    row.className = "schedule-item";
    row.innerHTML = `<span>${escapeHTML(it.label)}</span><strong>${escapeHTML(it.value)}</strong>`;
    card.appendChild(row);
  });
  if (sec.note){
    const note = document.createElement("div");
    note.className = "note";
    note.style.marginTop = "10px";
    note.textContent = sec.note;
    card.appendChild(note);
  }
  panel.appendChild(card);
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

// --- Santo del día (Vatican News) ---
function pad2(n){ return String(n).padStart(2,"0"); }

function arDate(){
  // Aproximación Argentina (UTC-3) para evitar que cambie cerca de medianoche
  const d = new Date();
  d.setHours(d.getHours() - 3);
  return d;
}

async function fetchSaintMeta(vaticanUrl){
  // Usamos r.jina.ai para evitar problemas de CORS al leer el HTML
  const prox = "https://r.jina.ai/http://"+vaticanUrl.replace(/^https?:\/\//,"");
  const res = await fetch(prox, { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudo leer el santo del día");
  const html = await res.text();

  const ogTitle = (html.match(/property=\"og:title\" content=\"([^\"]+)\"/i) || [])[1];
  const ogImage = (html.match(/property=\"og:image\" content=\"([^\"]+)\"/i) || [])[1];

  return { ogTitle, ogImage };
}

async function updateSaintOfDay(){
  const nameEl = document.getElementById("saintOfDayName");
  const imgEl  = document.getElementById("saintOfDayImg");
  const linkEl = document.getElementById("saintOfDayLink");
  if (!nameEl || !imgEl || !linkEl) return;

  nameEl.textContent = "Cargando…";

  try{
    const d = arDate();
    const mm = pad2(d.getMonth()+1);
    const dd = pad2(d.getDate());
    const url = `https://www.vaticannews.va/es/santos/${mm}/${dd}.html`;
    linkEl.href = url;

    const meta = await fetchSaintMeta(url);
    const title = (meta.ogTitle || "").replace(/^Santos?:\s*/i,"").trim() || "Santo del día";
    nameEl.textContent = title;

    if (meta.ogImage){
      imgEl.src = meta.ogImage;
    }
  }catch(err){
    nameEl.textContent = "Ver santo del día";
    linkEl.href = "https://www.vaticannews.va/es/santos.html";
  }
}

// --- Calendario simple (eventos) ---
function monthName(m){
  return ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"][m];
}

function ymd(d){
  const y=d.getFullYear();
  const m=pad2(d.getMonth()+1);
  const da=pad2(d.getDate());
  return `${y}-${m}-${da}`;
}

function eventsByDay(){
  const map = {};
  (state.events||[]).forEach(ev => {
    if (!ev || !ev.date) return;
    map[ev.date] = map[ev.date] || [];
    map[ev.date].push(ev);
  });
  return map;
}

function renderCalendar(){
  const grid = document.getElementById("calGrid");
  const title = document.getElementById("calTitle");
  const list = document.getElementById("calEvents");
  if (!grid || !title || !list) return;

  const today = arDate();
  if (!state.calMonth){
    state.calMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  }
  const base = state.calMonth;
  title.textContent = `${monthName(base.getMonth())} ${base.getFullYear()}`;

  const first = new Date(base.getFullYear(), base.getMonth(), 1);
  const startDow = (first.getDay()+6)%7; // lunes=0
  const start = new Date(first);
  start.setDate(start.getDate() - startDow);

  const byDay = eventsByDay();
  grid.innerHTML = "";
  list.innerHTML = "";

  let selected = ymd(today);

  for (let i=0;i<42;i++){
    const d = new Date(start);
    d.setDate(start.getDate()+i);
    const cell = document.createElement("button");
    cell.className = "calcell";
    const iso = ymd(d);
    const inMonth = d.getMonth() === base.getMonth();
    cell.style.opacity = inMonth ? "1" : ".45";

    if (iso === ymd(today)) cell.classList.add("is-today");
    if (byDay[iso] && byDay[iso].length) cell.classList.add("has-event");

    cell.innerHTML = `<div class="calcell__n">${d.getDate()}</div>`;
    cell.addEventListener("click", () => {
      selected = iso;
      renderEventsList(selected);
    });
    grid.appendChild(cell);
  }

  function renderEventsList(iso){
    const evs = byDay[iso] || [];
    if (!evs.length){
      list.innerHTML = `<div class="item"><div class="item__title">Sin eventos cargados</div><div class="item__sub">${iso}</div></div>`;
      return;
    }
    list.innerHTML = evs.map(ev => `
      <div class="item">
        <div class="item__title">${ev.title || "Evento"}</div>
        <div class="item__sub">${ev.time || ""} ${ev.place ? "· "+ev.place : ""}</div>
      </div>
    `).join("");
  }
  renderEventsList(selected);
}


async function init(){
  state.songs = await loadJSON("data/songs.json");
  state.songbooks = await loadJSON("data/songbooks.json");
  state.events = await loadJSON("data/events.json");
  state.scheduleSummer = await loadJSON("data/schedule_summer_2026.json");
  state.prayers = await loadJSON("data/prayers.json");
  state.saints = await loadJSON("data/saints.json");
  state.history = await loadJSON("data/history.json");
  state.schedule = await loadJSON("data/schedule.json");
  state.announcements = await loadJSON("data/announcements.json");

  renderSongbooksSelect();
  renderSongsList();
  renderPrayers();
  renderSaints();
  renderHistory();
  renderSchedule();
  renderAnnouncements();

  updateNavStrip("home");

  // Navegación general
  $("#calPrev")?.addEventListener("click", () => { state.calMonth = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth()-1, 1); renderCalendar(); });
  $("#calNext")?.addEventListener("click", () => { state.calMonth = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth()+1, 1); renderCalendar(); });

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
}

init().catch(err => {
  console.error(err);
  alert("Error cargando datos. Revisá la carpeta /data y los archivos JSON.");
});
