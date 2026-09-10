// ============================================================
// FERRIS MÜLLER KARAOKE BOX
// ============================================================

const state = {
  queue: [],
};

// Local song library — empty until the song folder is uploaded.
const LOCAL_SONGS = [];

// Sticker + stamp assets (cropped/cleaned from the user's supplied sheet)
const STICKER_ASSETS = [
  { key: "blush-bow",       src: "sticker-blush-bow.png" },
  { key: "star-gold",       src: "sticker-star-gold.png" },
  { key: "star-silver",     src: "sticker-star-silver.png" },
  { key: "butterfly",       src: "sticker-butterfly.png" },
  { key: "doodle-cat",      src: "sticker-doodle-cat.png" },
  { key: "doodle-signature",src: "sticker-doodle-signature.png" },
];

const FRAME_ASSETS = [
  { key: "leopard-pink",     label: "pink leopard",   swatch: "frame-leopard-pink.jpg",     mode: "repeat", tileSize: 220 },
  { key: "glitter-rosegold", label: "rose gold glitter", swatch: "frame-glitter-rosegold.jpg", mode: "repeat", tileSize: 180 },
  { key: "palms",            label: "sunset palms",   swatch: "frame-palms.jpg",            mode: "cover" },
  { key: "dolphins",         label: "rainbow dolphins", swatch: "frame-dolphins.jpg",        mode: "cover" },
];

// ---------- DOM refs ----------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const tvIdle = $("#tv-idle");
const tvPlaying = $("#tv-playing");
const tvVideoWrap = $("#tv-video-wrap");
const tvNoVideo = $("#tv-no-video");
const tvManualControls = $("#tv-manual-controls");
const tvTitleText = $("#tv-titletext");
const npTitle = $("#np-title");
const scoreCard = $("#score-card");
const scoreNum = $("#score-num");
const scoreLabel = $("#score-label");

const queueList = $("#queue-list");
const queueCount = $("#queue-count");

// ============================================================
// SONG LIBRARY SEARCH (empty for now — wired up for later)
// ============================================================
const libraryInput = $("#library-search-input");
const libraryResults = $("#library-results-list");

function renderLibraryResults(query){
  libraryResults.innerHTML = "";
  const q = (query || "").trim().toLowerCase();
  const matches = LOCAL_SONGS.filter(s =>
    s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)
  );

  if(LOCAL_SONGS.length === 0){
    libraryResults.innerHTML = `<li class="song-book-empty">library's empty — waiting on your song folder!</li>`;
    return;
  }
  if(matches.length === 0){
    libraryResults.innerHTML = `<li class="song-book-empty">no matches for "${query}"</li>`;
    return;
  }
  matches.forEach(song => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${song.title}<br><span class="sb-meta">${song.artist}</span></span>`;
    const btn = document.createElement("button");
    btn.textContent = "+ queue";
    btn.addEventListener("click", () => {
      const singer = prompt("Who's singing this one?", "you") || "someone";
      addToQueue(song.title, singer, song.url || "");
    });
    li.appendChild(btn);
    libraryResults.appendChild(li);
  });
}
libraryInput.addEventListener("input", (e) => renderLibraryResults(e.target.value));
renderLibraryResults("");

// ============================================================
// ADD SONG FORM (YouTube link)
// ============================================================
$("#add-song-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const title = $("#song-title-input").value.trim();
  const singer = $("#song-singer-input").value.trim();
  const url = $("#song-url-input").value.trim();
  if(!title || !singer || !url) return;
  addToQueue(title, singer, url);
  e.target.reset();
});

function addToQueue(title, singer, url){
  state.queue.push({ title, singer, url });
  renderQueue();
}

function renderQueue(){
  queueCount.textContent = state.queue.length;
  queueList.innerHTML = "";
  const startBtn = $("#btn-start-next");
  if(startBtn) startBtn.hidden = state.queue.length === 0;
  if(state.queue.length === 0){
    queueList.innerHTML = `<li class="queue-empty">queue's empty — add something!</li>`;
    return;
  }
  state.queue.forEach(item => {
    const li = document.createElement("li");
    li.innerHTML = `${item.title}<br><span class="q-singer">${item.singer}</span>`;
    queueList.appendChild(li);
  });
}

// ============================================================
// YOUTUBE IFRAME API — real playback control
// ============================================================
let ytPlayer = null;
let ytReady = false;
let currentSong = null;
let scrubDragging = false;
let progressTimer = null;

const ytScript = document.createElement("script");
ytScript.src = "https://www.youtube.com/iframe_api";
document.head.appendChild(ytScript);

window.onYouTubeIframeAPIReady = function(){
  ytPlayer = new YT.Player("yt-player", {
    height: "100%",
    width: "100%",
    playerVars: { autoplay: 0, rel: 0, modestbranding: 1, controls: 0, playsinline: 1 },
    events: {
      onReady: () => { ytReady = true; },
      onStateChange: onPlayerStateChange,
      onError: onPlayerError,
    }
  });
};

function onPlayerError(e){
  const sub = $("#tv-error-sub");
  const link = $("#tv-error-link");
  if(e.data === 101 || e.data === 150){
    sub.textContent = "the owner has disabled embedding for this video";
  } else if(e.data === 100){
    sub.textContent = "this video is private or was removed";
  } else {
    sub.textContent = "something went wrong playing this one";
  }
  if(currentSong && currentSong.url) link.href = currentSong.url;
  $("#tv-error").hidden = false;
  stopProgressTimer();
}

const ICON_PLAY = `<svg viewBox="0 0 16 16" width="16" height="16"><polygon points="4,2 14,8 4,14" fill="currentColor"/></svg>`;
const ICON_PAUSE = `<svg viewBox="0 0 16 16" width="16" height="16"><rect x="4" y="2" width="3" height="12" fill="currentColor"/><rect x="9" y="2" width="3" height="12" fill="currentColor"/></svg>`;

function onPlayerStateChange(e){
  if(e.data === YT.PlayerState.ENDED){
    finishSong();
  }
  if(e.data === YT.PlayerState.PLAYING){
    $("#tv-btn-playpause").innerHTML = ICON_PAUSE;
    startProgressTimer();
  }
  if(e.data === YT.PlayerState.PAUSED){
    $("#tv-btn-playpause").innerHTML = ICON_PLAY;
    stopProgressTimer();
  }
}

function extractYouTubeID(url){
  if(!url) return null;
  const re = /(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtu\.be\/)([A-Za-z0-9_-]{11})/;
  const m = url.match(re);
  return m ? m[1] : null;
}

function formatTime(seconds){
  if(!isFinite(seconds) || seconds < 0) seconds = 0;
  const h = Math.floor(seconds/3600);
  const m = Math.floor((seconds%3600)/60);
  const s = Math.floor(seconds%60);
  return [h,m,s].map(n => String(n).padStart(2,"0")).join(":");
}

function startProgressTimer(){
  stopProgressTimer();
  progressTimer = setInterval(updateProgress, 400);
}
function stopProgressTimer(){
  if(progressTimer) clearInterval(progressTimer);
  progressTimer = null;
}
function updateProgress(){
  if(!ytPlayer || scrubDragging || typeof ytPlayer.getCurrentTime !== "function") return;
  const cur = ytPlayer.getCurrentTime();
  const dur = ytPlayer.getDuration();
  $("#tv-time-current").textContent = formatTime(cur);
  $("#tv-time-total").textContent = formatTime(dur);
  const pct = dur > 0 ? (cur/dur)*100 : 0;
  $("#tv-scrub-fill").style.width = pct + "%";
  $("#tv-scrub-handle").style.left = pct + "%";
}

function stopVideo(){
  if(ytPlayer && typeof ytPlayer.stopVideo === "function") ytPlayer.stopVideo();
  stopProgressTimer();
  $("#tv-time-current").textContent = "00:00:00";
  $("#tv-time-total").textContent = "00:00:00";
  $("#tv-scrub-fill").style.width = "0%";
  $("#tv-scrub-handle").style.left = "0%";
  $("#tv-btn-playpause").innerHTML = ICON_PLAY;
  $("#tv-error").hidden = true;
  tvVideoWrap.hidden = true;
  tvTitleText.textContent = "ferris_player.exe";
}

const LYRIC_LINES = ["♪ ♪ ♪", "oooooh yeah", "sing it back", "one more time", "la la la"];

function playNextSong(){
  scoreCard.hidden = true;
  if(state.queue.length === 0){
    tvIdle.hidden = false;
    tvPlaying.hidden = true;
    tvManualControls.hidden = true;
    stopVideo();
    return;
  }
  const song = state.queue.shift();
  currentSong = song;
  renderQueue();
  tvIdle.hidden = true;
  tvPlaying.hidden = false;

  const videoId = extractYouTubeID(song.url);
  if(videoId && ytReady){
    tvNoVideo.hidden = true;
    tvManualControls.hidden = true;
    tvVideoWrap.hidden = false;
    $("#tv-error").hidden = true;
    tvTitleText.textContent = `${song.title} — ${song.singer}`;
    ytPlayer.loadVideoById(videoId);
    ytPlayer.playVideo();
  } else {
    stopVideo();
    tvNoVideo.hidden = false;
    tvManualControls.hidden = false;
    npTitle.textContent = `${song.title} — ${song.singer}`;
    $("#np-lyric").textContent = LYRIC_LINES[Math.floor(Math.random()*LYRIC_LINES.length)];
  }
}

const PRAISE = [
  "PERFECT DIVA ENERGY", "STAR OF THE NIGHT", "MIC DROP MOMENT",
  "CHART TOPPER", "ENCORE WORTHY", "ROOM SHAKING PERFORMANCE"
];

function finishSong(){
  const score = 70 + Math.floor(Math.random()*31);
  scoreNum.textContent = `${score}%`;
  scoreLabel.textContent = PRAISE[Math.floor(Math.random()*PRAISE.length)];
  scoreCard.hidden = false;
  tvPlaying.hidden = true;
  tvIdle.hidden = false;
  tvManualControls.hidden = true;
  stopVideo();
  if(score >= 90) showEncore();
  burstConfetti();
}

function showEncore(){
  const overlay = $("#encore-overlay");
  overlay.classList.remove("show");
  void overlay.offsetWidth;
  overlay.classList.add("show");
  setTimeout(() => overlay.classList.remove("show"), 900);
}

$("#tv-btn-playpause").addEventListener("click", () => {
  if(!ytPlayer || tvVideoWrap.hidden) return;
  const s = ytPlayer.getPlayerState();
  if(s === YT.PlayerState.PLAYING) ytPlayer.pauseVideo();
  else ytPlayer.playVideo();
});
$("#tv-btn-restart").addEventListener("click", () => {
  if(ytPlayer && !tvVideoWrap.hidden) ytPlayer.seekTo(0, true);
});
$("#tv-btn-back").addEventListener("click", () => {
  if(ytPlayer && !tvVideoWrap.hidden) ytPlayer.seekTo(Math.max(0, ytPlayer.getCurrentTime()-10), true);
});
$("#tv-btn-fwd").addEventListener("click", () => {
  if(ytPlayer && !tvVideoWrap.hidden) ytPlayer.seekTo(ytPlayer.getCurrentTime()+10, true);
});
$("#tv-btn-skip").addEventListener("click", () => {
  if(!tvVideoWrap.hidden || !tvNoVideo.hidden){
    playNextSong();
  }
});
$("#tv-error-skip").addEventListener("click", () => playNextSong());

const scrubTrack = $("#tv-scrub-track");
function seekFromEvent(e){
  if(!ytPlayer || tvVideoWrap.hidden) return;
  const rect = scrubTrack.getBoundingClientRect();
  const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
  const pct = Math.min(1, Math.max(0, x / rect.width));
  const dur = ytPlayer.getDuration();
  ytPlayer.seekTo(pct * dur, true);
  $("#tv-scrub-fill").style.width = (pct*100) + "%";
  $("#tv-scrub-handle").style.left = (pct*100) + "%";
}
scrubTrack.addEventListener("mousedown", (e) => { scrubDragging = true; seekFromEvent(e); });
window.addEventListener("mousemove", (e) => { if(scrubDragging) seekFromEvent(e); });
window.addEventListener("mouseup", () => { scrubDragging = false; });

$("#tv-volume-slider").addEventListener("input", (e) => {
  if(ytPlayer && typeof ytPlayer.setVolume === "function") ytPlayer.setVolume(Number(e.target.value));
});

$("#btn-sing").addEventListener("click", () => finishSong());
$("#btn-skip").addEventListener("click", () => playNextSong());
$("#tv-idle").addEventListener("click", () => { if(state.queue.length) playNextSong(); });
$("#btn-start-next").addEventListener("click", (e) => { e.stopPropagation(); playNextSong(); });

// ============================================================
// MODALS
// ============================================================
function openModal(id){ $(id).classList.add("active"); }
function closeModal(el){
  el.classList.remove("active");
  if(el.id === "modal-photobooth" && camStream){
    camStream.getTracks().forEach(t => t.stop());
    camStream = null;
    camVideo.srcObject = null;
    btnCamStart.hidden = false;
    btnCamShoot.hidden = true;
    btnCamRetake.hidden = true;
    btnCamDownload.hidden = true;
    camStatus.textContent = "allow camera access to begin";
  }
}

$("#btn-guestbook").addEventListener("click", () => openModal("#modal-guestbook"));
$("#btn-photobooth").addEventListener("click", () => openModal("#modal-photobooth"));
$$(".modal-close").forEach(btn => btn.addEventListener("click", (e) => closeModal(e.target.closest(".modal-overlay"))));
$$(".modal-overlay").forEach(ov => ov.addEventListener("click", (e) => { if(e.target === ov) closeModal(ov); }));

// ---------- guestbook (reaction emojis — kept here by request) ----------
const STAMPS = ["⭐","💖","🎤","✨","🌸","🍓"];
let selectedStamp = STAMPS[0];
const stampPicker = $("#stamp-picker");
STAMPS.forEach((s, i) => {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = s;
  if(i===0) btn.classList.add("active");
  btn.addEventListener("click", () => {
    selectedStamp = s;
    $$("#stamp-picker button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  });
  stampPicker.appendChild(btn);
});

function loadGuestbook(){
  const list = $("#guestbook-list");
  list.innerHTML = "";
  const entries = JSON.parse(localStorage.getItem("ferris-muller-guestbook") || "[]");
  entries.slice().reverse().forEach(addGuestbookEntryToDOM);
}

function addGuestbookEntryToDOM(entry){
  const list = $("#guestbook-list");
  const li = document.createElement("li");
  li.innerHTML = `<span class="gb-stamp">${entry.stamp}</span><span class="gb-name">${entry.name}</span><br>${entry.note}`;
  list.prepend(li);
}

$("#guestbook-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("#guestbook-name").value.trim();
  const note = $("#guestbook-note").value.trim();
  if(!name || !note) return;
  const entry = { name, note, stamp: selectedStamp };
  const entries = JSON.parse(localStorage.getItem("ferris-muller-guestbook") || "[]");
  entries.push(entry);
  localStorage.setItem("ferris-muller-guestbook", JSON.stringify(entries));
  addGuestbookEntryToDOM(entry);
  e.target.reset();
});
loadGuestbook();

// ============================================================
// PHOTO BOOTH — webcam capture, freeform draggable stickers, texture frames
// ============================================================
const stickerRow = $("#sticker-row");
const frameRow = $("#frame-row");
let chosenFrame = FRAME_ASSETS[0];
let placedStickers = []; // {id, key, src, xPct, yPct, sizePct}
let stickerIdSeq = 1;

STICKER_ASSETS.forEach(s => {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.innerHTML = `<img src="${s.src}" alt="${s.key}">`;
  btn.title = "add to strip";
  btn.addEventListener("click", () => addStickerToStrip(s));
  stickerRow.appendChild(btn);
});

FRAME_ASSETS.forEach((f, i) => {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.title = f.label;
  btn.innerHTML = `<span class="frame-swatch" style="background-image:url('${f.swatch}')"></span>`;
  if(i===0) btn.classList.add("active");
  btn.addEventListener("click", () => {
    chosenFrame = f;
    $$("#frame-row button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    applyFrameClass();
  });
  frameRow.appendChild(btn);
});

function applyFrameClass(){
  const wrap = $("#photostrip-wrap");
  FRAME_ASSETS.forEach(f => wrap.classList.remove("frame-" + f.key));
  wrap.classList.add("frame-" + chosenFrame.key);
}

const camVideo = $("#cam-video");
const camCanvas = $("#cam-canvas");
const camStatus = $("#cam-status");
const camCountdown = $("#cam-countdown");
const camFlash = $("#cam-flash");
const btnCamStart = $("#btn-cam-start");
const btnCamShoot = $("#btn-cam-shoot");
const btnCamRetake = $("#btn-cam-retake");
const btnCamDownload = $("#btn-cam-download");

let camStream = null;
let capturedShots = [];

btnCamStart.addEventListener("click", async () => {
  try{
    camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
    camVideo.srcObject = camStream;
    camStatus.textContent = "say cheese — you've got 3 shots coming";
    btnCamStart.hidden = true;
    btnCamShoot.hidden = false;
  } catch(err){
    camStatus.textContent = "couldn't reach the camera — check your browser permissions";
  }
});

btnCamShoot.addEventListener("click", () => {
  capturedShots = [];
  placedStickers = [];
  renderPhotostrip();
  btnCamShoot.disabled = true;
  takeShotsSequence(3);
});

function takeShotsSequence(remaining){
  if(remaining === 0){
    btnCamShoot.disabled = false;
    camStatus.textContent = "strip's ready — add stickers, drag them around, or save it";
    btnCamShoot.hidden = true;
    btnCamRetake.hidden = false;
    btnCamDownload.hidden = false;
    return;
  }
  runCountdown(3, () => {
    snapPhoto();
    setTimeout(() => takeShotsSequence(remaining - 1), 500);
  });
}

function runCountdown(from, done){
  camCountdown.hidden = false;
  camCountdown.textContent = from;
  let n = from;
  const iv = setInterval(() => {
    n--;
    if(n > 0){
      camCountdown.textContent = n;
    } else {
      clearInterval(iv);
      camCountdown.hidden = true;
      done();
    }
  }, 700);
}

function snapPhoto(){
  const w = camVideo.videoWidth || 480;
  const h = camVideo.videoHeight || 360;
  camCanvas.width = w;
  camCanvas.height = h;
  const ctx = camCanvas.getContext("2d");
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  ctx.filter = "sepia(.3) saturate(1.25) contrast(1.05) brightness(1.03)";
  ctx.drawImage(camVideo, 0, 0, w, h);
  capturedShots.push(camCanvas.toDataURL("image/jpeg", 0.92));
  renderPhotostrip();
  camFlash.classList.remove("flash-on");
  void camFlash.offsetWidth;
  camFlash.classList.add("flash-on");
}

function renderPhotostrip(){
  applyFrameClass();
  const strip = $("#photostrip");
  strip.innerHTML = "";
  if(capturedShots.length === 0){
    strip.innerHTML = `<p class="photostrip-empty">your strip will appear here</p>`;
    return;
  }
  capturedShots.forEach(src => {
    const img = document.createElement("img");
    img.className = "strip-photo";
    img.src = src;
    strip.appendChild(img);
  });
  placedStickers.forEach(renderPlacedSticker);
}

function addStickerToStrip(stickerAsset){
  if(capturedShots.length === 0) return; // need a strip to place onto
  const jitterX = (Math.random()*20 - 10);
  const jitterY = (Math.random()*20 - 10);
  const placed = {
    id: stickerIdSeq++,
    key: stickerAsset.key,
    src: stickerAsset.src,
    xPct: 50 + jitterX,
    yPct: 50 + jitterY,
    sizePct: 20,
  };
  placedStickers.push(placed);
  renderPlacedSticker(placed);
}

function renderPlacedSticker(placed){
  const strip = $("#photostrip");
  const img = document.createElement("img");
  img.src = placed.src;
  img.className = "placed-sticker";
  img.dataset.id = placed.id;
  img.style.left = placed.xPct + "%";
  img.style.top = placed.yPct + "%";
  img.style.width = placed.sizePct + "%";
  makeStickerDraggable(img, placed);
  strip.appendChild(img);
}

function makeStickerDraggable(el, placed){
  let dragging = false;
  let lastX = 0, lastY = 0;

  el.addEventListener("pointerdown", (e) => {
    dragging = true;
    el.setPointerCapture(e.pointerId);
    lastX = e.clientX; lastY = e.clientY;
    el.style.zIndex = 10;
  });
  el.addEventListener("pointermove", (e) => {
    if(!dragging) return;
    const strip = $("#photostrip");
    const rect = strip.getBoundingClientRect();
    const dxPct = ((e.clientX - lastX) / rect.width) * 100;
    const dyPct = ((e.clientY - lastY) / rect.height) * 100;
    placed.xPct += dxPct;
    placed.yPct += dyPct;
    el.style.left = placed.xPct + "%";
    el.style.top = placed.yPct + "%";
    lastX = e.clientX; lastY = e.clientY;
  });
  el.addEventListener("pointerup", () => { dragging = false; });
  el.addEventListener("pointercancel", () => { dragging = false; });
  el.addEventListener("dblclick", () => {
    placedStickers = placedStickers.filter(p => p.id !== placed.id);
    el.remove();
  });
}

$("#btn-clear-stickers").addEventListener("click", () => {
  placedStickers = [];
  renderPhotostrip();
});

renderPhotostrip();

btnCamRetake.addEventListener("click", () => {
  capturedShots = [];
  placedStickers = [];
  renderPhotostrip();
  btnCamShoot.hidden = false;
  btnCamRetake.hidden = true;
  btnCamDownload.hidden = true;
  camStatus.textContent = "ready when you are";
});

function loadImage(src){
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

btnCamDownload.addEventListener("click", async () => {
  if(capturedShots.length === 0) return;

  const innerPad = 10, gap = 8, frameBorder = 18;
  const w = camCanvas.width || 480;
  const shotH = camCanvas.height || 360;
  const n = capturedShots.length;
  const whiteCardW = w + innerPad*2;
  const whiteCardH = shotH*n + gap*(n-1) + innerPad*2;
  const canvasW = whiteCardW + frameBorder*2;
  const canvasH = whiteCardH + frameBorder*2;

  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = canvasW;
  exportCanvas.height = canvasH;
  const ctx = exportCanvas.getContext("2d");

  // frame texture background
  const frameImg = await loadImage(chosenFrame.swatch);
  if(chosenFrame.mode === "repeat"){
    const pattern = ctx.createPattern(frameImg, "repeat");
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, canvasW, canvasH);
  } else {
    // cover: scale image to fill the canvas, center-cropped
    const imgRatio = frameImg.width / frameImg.height;
    const canvasRatio = canvasW / canvasH;
    let drawW, drawH, dx, dy;
    if(imgRatio > canvasRatio){
      drawH = canvasH;
      drawW = drawH * imgRatio;
      dx = (canvasW - drawW) / 2;
      dy = 0;
    } else {
      drawW = canvasW;
      drawH = drawW / imgRatio;
      dx = 0;
      dy = (canvasH - drawH) / 2;
    }
    ctx.drawImage(frameImg, dx, dy, drawW, drawH);
  }

  // white card
  ctx.fillStyle = "#fff";
  ctx.fillRect(frameBorder, frameBorder, whiteCardW, whiteCardH);

  // photos
  const photoImgs = await Promise.all(capturedShots.map(loadImage));
  photoImgs.forEach((img, i) => {
    const y = frameBorder + innerPad + i*(shotH+gap);
    ctx.drawImage(img, frameBorder+innerPad, y, w, shotH);
  });

  // stickers, positioned relative to the white card box
  const stickerImgs = await Promise.all(placedStickers.map(p => loadImage(p.src)));
  placedStickers.forEach((p, i) => {
    const img = stickerImgs[i];
    const sizePx = (p.sizePct/100) * whiteCardW;
    const aspect = img.height / img.width;
    const wPx = sizePx, hPx = sizePx*aspect;
    const cx = frameBorder + (p.xPct/100) * whiteCardW;
    const cy = frameBorder + (p.yPct/100) * whiteCardH;
    ctx.drawImage(img, cx - wPx/2, cy - hPx/2, wPx, hPx);
  });

  const link = document.createElement("a");
  link.download = `ferris-muller-karaoke-strip-${Date.now()}.jpg`;
  link.href = exportCanvas.toDataURL("image/jpeg", 0.95);
  link.click();
});

// ============================================================
// CONFETTI
// ============================================================
const confettiCanvas = $("#confetti-canvas");
const cctx = confettiCanvas.getContext("2d");
let confettiParticles = [];

function resizeCanvases(){
  [confettiCanvas, sparkleCanvas].forEach(c => {
    c.width = window.innerWidth;
    c.height = window.innerHeight;
  });
}
window.addEventListener("resize", resizeCanvases);

function burstConfetti(){
  const colors = ["#f2a6c6","#f0cd8e","#a9e0c9","#d9769f","#ffffff"];
  for(let i=0;i<90;i++){
    confettiParticles.push({
      x: window.innerWidth/2,
      y: window.innerHeight*0.35,
      vx: (Math.random()-0.5)*14,
      vy: Math.random()*-10 - 4,
      size: Math.random()*7+4,
      color: colors[Math.floor(Math.random()*colors.length)],
      rot: Math.random()*360,
      vr: (Math.random()-0.5)*12,
      life: 0,
    });
  }
}

function animateConfetti(){
  cctx.clearRect(0,0,confettiCanvas.width, confettiCanvas.height);
  confettiParticles.forEach(p => {
    p.vy += 0.35;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    p.life++;
    cctx.save();
    cctx.translate(p.x, p.y);
    cctx.rotate(p.rot * Math.PI/180);
    cctx.fillStyle = p.color;
    cctx.fillRect(-p.size/2, -p.size/2, p.size, p.size*0.6);
    cctx.restore();
  });
  confettiParticles = confettiParticles.filter(p => p.life < 160 && p.y < confettiCanvas.height + 40);
  requestAnimationFrame(animateConfetti);
}

// ============================================================
// SPARKLE CURSOR TRAIL (the one animated flourish we keep — user loves this one)
// ============================================================
const sparkleCanvas = $("#sparkle-canvas");
const sctx = sparkleCanvas.getContext("2d");
let sparkles = [];
const SPARKLE_CHARS = ["✨","💖","⭐"];

function spawnSparkle(x,y){
  sparkles.push({
    x, y,
    char: SPARKLE_CHARS[Math.floor(Math.random()*SPARKLE_CHARS.length)],
    life: 0,
    size: Math.random()*8 + 10,
  });
}

let lastSparkleTime = 0;
window.addEventListener("pointermove", (e) => {
  const now = Date.now();
  if(now - lastSparkleTime < 45) return;
  lastSparkleTime = now;
  spawnSparkle(e.clientX, e.clientY);
});

function animateSparkles(){
  sctx.clearRect(0,0,sparkleCanvas.width, sparkleCanvas.height);
  sparkles.forEach(s => {
    s.life++;
    const alpha = Math.max(0, 1 - s.life/30);
    sctx.globalAlpha = alpha;
    sctx.font = `${s.size}px sans-serif`;
    sctx.fillText(s.char, s.x, s.y - s.life*0.6);
  });
  sctx.globalAlpha = 1;
  sparkles = sparkles.filter(s => s.life < 30);
  requestAnimationFrame(animateSparkles);
}

// ============================================================
// INIT
// ============================================================
resizeCanvases();
animateConfetti();
animateSparkles();
renderQueue();
