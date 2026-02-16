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


/* ================================
   Overrides & additions (v6)
==================================*/

function _$(id){ return document.getElementById(id); }
function _on(id, ev, fn){
  const el = _$(id);
  if(el) el.addEventListener(ev, fn);
}

function _fmtDateES(d){
  try{
    return d.toLocaleDateString('es-AR', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  }catch(e){ return String(d); }
}

/** Build recurring schedule events (spring/summer) until Holy Week 2026 */
function buildRecurringEvents(){
  // Range: today -> 2026-03-28 (Saturday before Palm Sunday range)
  const today = new Date();
  const end = new Date('2026-03-28T23:59:59');
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const events = [];
  const pushEv = (dateObj, title, startTime, endTime, category='Horario')=>{
    const [sh, sm] = startTime.split(':').map(n=>parseInt(n,10));
    const s = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), sh, sm, 0);
    let e = null;
    if(endTime){
      const [eh, em] = endTime.split(':').map(n=>parseInt(n,10));
      e = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), eh, em, 0);
    }
    events.push({
      id: `rec-${title}-${s.toISOString()}`,
      title,
      category,
      start: s.toISOString(),
      end: e ? e.toISOString() : null,
      date: s.toISOString().slice(0,10)
    });
  };

  for(let d = new Date(start); d <= end; d.setDate(d.getDate()+1)){
    const dow = d.getDay(); // 0 Sun .. 6 Sat
    // Masses
    if(dow>=1 && dow<=5){ // Mon-Fri
      pushEv(d, 'Misa', '08:00', null, 'Misa');
    }
    if(dow>=2 && dow<=5){ // Tue-Fri
      pushEv(d, 'Misa', '20:00', null, 'Misa');
    }
    if(dow===6){ // Sat
      pushEv(d, 'Misa', '20:00', null, 'Misa');
    }
    if(dow===0){ // Sun
      pushEv(d, 'Misa', '11:00', null, 'Misa');
      pushEv(d, 'Misa', '20:00', null, 'Misa');
    }

    // Confessions
    if(dow===2){ // Tue
      pushEv(d, 'Confesiones', '18:00', '20:00', 'Confesiones');
    }
    if(dow===5){ // Fri
      pushEv(d, 'Confesiones', '09:00', '12:00', 'Confesiones');
      pushEv(d, 'Confesiones', '17:00', '20:00', 'Confesiones');
    }

    // Adoration
    if(dow===4){ // Thu
      pushEv(d, 'Adoración Eucarística', '18:00', '19:30', 'Adoración');
    }
    if(dow===5){ // Fri
      pushEv(d, 'Adoración Eucarística', '08:30', '10:00', 'Adoración');
    }
  }
  return events;
}

function getAllEvents(){
  const base = Array.isArray(state.events) ? state.events : [];
  const recurring = buildRecurringEvents();
  // Normalize base events to include date/start fields for consistent rendering
  const normalized = base.map(ev=>{
    if(ev.date) return ev;
    if(ev.start){
      return { ...ev, date: ev.start.slice(0,10) };
    }
    return ev;
  });
  // Merge
  return [...normalized, ...recurring].sort((a,b)=>{
    const as = (a.start || (a.date ? a.date+'T00:00:00' : '9999-12-31T00:00:00'));
    const bs = (b.start || (b.date ? b.date+'T00:00:00' : '9999-12-31T00:00:00'));
    return as.localeCompare(bs);
  });
}

function renderCalendar(){
  const picker = _$('calendarDatePicker');
  const dayBox = _$('calendarDayEvents');
  const nextBox = _$('calendarNextEvents');
  if(!picker || !dayBox || !nextBox) return;

  const all = getAllEvents();

  // init picker default today
  if(!picker.value){
    const t = new Date();
    picker.value = t.toISOString().slice(0,10);
  }

  const renderDay = ()=>{
    const ymd = picker.value;
    dayBox.innerHTML = '';
    const items = all.filter(ev => (ev.date === ymd));
    if(items.length===0){
      dayBox.innerHTML = '<div class="muted">No hay eventos cargados para este día.</div>';
      return;
    }
    items.forEach(ev=>{
      const start = ev.start ? new Date(ev.start) : null;
      const time = start ? start.toLocaleTimeString('es-AR', {hour:'2-digit', minute:'2-digit'}) : '';
      const el = document.createElement('div');
      el.className = 'listitem';
      el.innerHTML = `<div class="listitem__title">${ev.title}</div>
                      <div class="muted small">${time} ${ev.category ? '· '+ev.category : ''}</div>`;
      dayBox.appendChild(el);
    });
  };

  const renderNext = ()=>{
    nextBox.innerHTML = '';
    const now = new Date();
    const end = new Date(now); end.setDate(end.getDate()+14);
    const items = all.filter(ev=>{
      const s = ev.start ? new Date(ev.start) : (ev.date ? new Date(ev.date+'T00:00:00') : null);
      return s && s >= new Date(now.toDateString()) && s <= end;
    }).slice(0,80);

    if(items.length===0){
      nextBox.innerHTML = '<div class="muted">Sin eventos próximos.</div>';
      return;
    }

    let currentDate = '';
    items.forEach(ev=>{
      const s = ev.start ? new Date(ev.start) : new Date(ev.date+'T00:00:00');
      const ymd = s.toISOString().slice(0,10);
      if(ymd !== currentDate){
        currentDate = ymd;
        const h = document.createElement('div');
        h.className = 'listheader';
        h.textContent = _fmtDateES(s);
        nextBox.appendChild(h);
      }
      const time = ev.start ? s.toLocaleTimeString('es-AR', {hour:'2-digit', minute:'2-digit'}) : '';
      const el = document.createElement('div');
      el.className = 'listitem';
      el.innerHTML = `<div class="listitem__title">${ev.title}</div>
                      <div class="muted small">${time} ${ev.category ? '· '+ev.category : ''}</div>`;
      nextBox.appendChild(el);
    });
  };

  renderDay();
  renderNext();
  picker.onchange = ()=>{ renderDay(); };

  // update teaser boxes
  const homeNext = _$('homeNextEvents');
  const todayNext = _$('todayNextEvents');
  const nextFew = getAllEvents().filter(ev=>{
    const s = ev.start ? new Date(ev.start) : (ev.date ? new Date(ev.date+'T00:00:00') : null);
    return s && s >= new Date(new Date().toDateString());
  }).slice(0,6);
  const line = nextFew.map(ev=>{
    const s = ev.start ? new Date(ev.start) : new Date(ev.date+'T00:00:00');
    const d = s.toLocaleDateString('es-AR', {day:'2-digit', month:'2-digit'});
    const t = ev.start ? s.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}) : '';
    return `${d} ${t} · ${ev.title}`;
  }).join('<br>');
  if(homeNext) homeNext.innerHTML = line || 'Sin eventos próximos.';
  if(todayNext) todayNext.innerHTML = line || 'Sin eventos próximos.';
}

async function updateSaintOfDay(){
  const titleEls = [_$('saintTitle'), _$('saintTitle2')].filter(Boolean);
  const bioEls = [_$('saintBio'), _$('saintBio2')].filter(Boolean);
  const linkEls = [_$('saintLink'), _$('saintLink2'), _$('homeSaintLink')].filter(Boolean);
  const teaserEl = _$('homeSaintTeaser');
  const imgWrap = _$('saintImageWrap');
  const imgEl = _$('saintImage');

  const setLoading = (txt)=>{
    titleEls.forEach(el=>el.textContent = 'Santo del día');
    bioEls.forEach(el=>el.textContent = txt);
    if(teaserEl) teaserEl.textContent = txt;
  };

  setLoading('Cargando…');

  const fallbackLocal = async ()=>{
    try{
      const r = await fetch('data/saint_of_day.json', {cache:'no-store'});
      if(!r.ok) throw new Error('no local');
      const data = await r.json();
      const title = data.name || 'Santo del día';
      const bio = data.summary || 'Abrí la página para ver el santo del día.';
      const url = data.url || 'https://www.vaticannews.va/es/santos.html';
      titleEls.forEach(el=>el.textContent = title);
      bioEls.forEach(el=>el.textContent = bio);
      if(teaserEl) teaserEl.textContent = title;
      linkEls.forEach(el=>{ el.href = url; el.textContent = el.id==='homeSaintLink' ? 'Abrir' : 'Abrir biografía'; });
      if(data.image && imgWrap && imgEl){
        imgEl.src = data.image;
        imgWrap.hidden = false;
      }else if(imgWrap){
        imgWrap.hidden = true;
      }
      return true;
    }catch(e){
      return false;
    }
  };

  try{
    // Use existing proxy if available
    const proxy = 'https://r.jina.ai/http://www.vaticannews.va/es/santos.html';
    const r = await fetch(proxy, { cache: 'no-store' });
    if(!r.ok) throw new Error('Fetch error');
    const html = await r.text();

    // very forgiving parsing
    const nameMatch = html.match(/<h1[^>]*>([^<]{3,120})<\/h1>/i) || html.match(/<title>([^<]{3,120})<\/title>/i);
    let name = (nameMatch ? nameMatch[1] : 'Santo del día').replace(/\s+/g,' ').trim();
    name = name.replace(/\s*\|\s*Vatican News\s*/i,'').trim();

    // Get first link to santo page if present
    let url = 'https://www.vaticannews.va/es/santos.html';
    const hrefMatch = html.match(/href="(\/es\/santos\/[^"]+\.html)"/i);
    if(hrefMatch) url = 'https://www.vaticannews.va' + hrefMatch[1];

    titleEls.forEach(el=>el.textContent = name);
    bioEls.forEach(el=>el.textContent = 'Tocá “Abrir” para ver la biografía completa.');
    if(teaserEl) teaserEl.textContent = name;
    linkEls.forEach(el=>{ el.href = url; el.textContent = el.id==='homeSaintLink' ? 'Abrir' : 'Abrir biografía'; });

    // Images from Vatican often block; we leave for later
    if(imgWrap) imgWrap.hidden = true;

  }catch(err){
    // Fallback local json, else link only
    const ok = await fallbackLocal();
    if(!ok){
      setLoading('No se pudo cargar. Tocá para abrir en Vatican News.');
      linkEls.forEach(el=>{ el.href = 'https://www.vaticannews.va/es/santos.html'; el.textContent = el.id==='homeSaintLink' ? 'Abrir' : 'Abrir'; });
      if(imgWrap) imgWrap.hidden = true;
    }
  }
}

function renderSongbooks(){
  // Keep existing select behavior if present, but also render chips.
  const select = _$('songbookSelect');
  const chips = _$('songbookChips');
  const songbooks = (state.songbooks || []).map(s=>s.name).filter(Boolean);
  if(select){
    select.innerHTML = '';
    songbooks.forEach(name=>{
      const o = document.createElement('option');
      o.value = name; o.textContent = name;
      select.appendChild(o);
    });
    if(!state.currentSongbook && songbooks.length) state.currentSongbook = songbooks[0];
    select.value = state.currentSongbook || '';
    select.onchange = ()=>{ state.currentSongbook = select.value; renderSongsList(); };
  }
  if(chips){
    chips.innerHTML = '';
    songbooks.forEach(name=>{
      const b = document.createElement('button');
      b.className = 'chip' + ((state.currentSongbook===name)?' chip--active':'');
      b.type='button';
      b.textContent = name;
      b.onclick = ()=>{
        state.currentSongbook = name;
        if(select) select.value = name;
        renderSongbooks();
        renderSongsList();
      };
      chips.appendChild(b);
    });
  }
}

function setupScrollTop(){
  const btn = _$('scrollTopBtn');
  if(!btn) return;
  const toggle = ()=>{
    if(window.scrollY > 320) btn.classList.add('scrolltop--show');
    else btn.classList.remove('scrolltop--show');
  };
  window.addEventListener('scroll', toggle, {passive:true});
  toggle();
  btn.addEventListener('click', ()=>window.scrollTo({top:0, behavior:'smooth'}));
}

function renderSchedule(){
  const m = _$('scheduleMass');
  const c = _$('scheduleConfessions');
  const a = _$('scheduleAdoration');
  const o = _$('scheduleOffice');
  if(!m||!c||!a||!o) return;
  m.innerHTML = `
    Lunes a viernes: 8 hs.<br>
    Martes a viernes: 20 hs.<br>
    Sábados: 20 hs.<br>
    Domingos: 11 y 20 hs.
  `;
  c.innerHTML = `
    Martes: de 18 a 20 hs.<br>
    Viernes: de 9 a 12 hs.<br>
    y de 17 a 20 hs.
  `;
  a.innerHTML = `
    Jueves: de 18 a 19.30 hs.<br>
    Viernes: de 8.30 a 10 hs.
  `;
  o.innerHTML = `
    Martes a viernes:<br>
    9 a 12 hs.<br>
    y de 17 a 20 hs.
  `;
}

function init(){
  // NAV
  document.querySelectorAll('[data-nav]').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      const key = btn.getAttribute('data-nav');
      showView(key);
      if(btn.tagName.toLowerCase()==='a' && btn.getAttribute('href')?.startsWith('#')) e.preventDefault();
    });
  });

  // Today date
  const todayDate = _$('todayDate');
  if(todayDate) todayDate.textContent = _fmtDateES(new Date());

  // Back buttons
  _on('btnBackToSongs','click',()=>showView('songs'));
  _on('btnBackToAnnouncements','click',()=>showView('announcements'));
  _on('btnBackToPrayers','click',()=>showView('prayers'));

  // Search + select existing handlers
  _on('songSearch','input',()=>renderSongsList());

  // Font controls song reader
  const applyFont = (targetId, delta)=>{
    const el=_$(targetId);
    if(!el) return;
    const cur = parseFloat(getComputedStyle(el).fontSize) || 16;
    el.style.fontSize = Math.max(14, Math.min(28, cur+delta)) + 'px';
  };
  _on('fontMinus','click',()=>applyFont('songLyrics',-1));
  _on('fontPlus','click',()=>applyFont('songLyrics',+1));
  _on('fontMinus2','click',()=>applyFont('prayerBody',-1));
  _on('fontPlus2','click',()=>applyFont('prayerBody',+1));

  setupScrollTop();

  // Load data and render
  loadData().then(()=>{
    renderSchedule();
    renderSongbooks();
    renderSongsList();
    renderAnnouncements();
    renderPrayers();
    renderHistory();
    renderSaints();
    renderCalendar();
    updateSaintOfDay();
  }).catch((err)=>{
    console.error(err);
  });
}
