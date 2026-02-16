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
};

let state = {
  songs: [],
  prayers: [],
  saints: [],
  history: null,
  schedule: null,
  announcements: [],
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

  renderCategoryChips();
  renderSongsList();
  renderPrayers();
  renderSaints();
  renderHistory();
  renderSchedule();
  renderAnnouncements();

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
}

init().catch(err => {
  console.error(err);
  alert("Error cargando datos. Revisá la carpeta /data y los archivos JSON.");
});
