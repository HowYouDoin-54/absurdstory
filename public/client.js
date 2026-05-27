const socket = io();

let isMaster = false;
let currentRoom = "";
let playerName = "";
let currentQuestionIndex = 0;
let timerInterval = null;
let timeLeft = 0;
let myStoryLines = [];

const createBtn = document.getElementById("createRoomBtn");
const joinBtn = document.getElementById("joinRoomBtn");
const createRoomScreen = document.getElementById("create-room-screen");
const joinRoomScreen = document.getElementById("join-room-screen");
const lobbyScreen = document.getElementById("lobby-screen");
const gameScreen = document.getElementById("game-screen");
const resultScreen = document.getElementById("result-screen");
const playerList = document.getElementById("playerList");
const questionTitle = document.getElementById("question-title");
const answerInput = document.getElementById("answerInput");
const submitBtn = document.getElementById("submitBtn");
const storyList = document.getElementById("storyList");
const startGameBtn = document.getElementById("startGameBtn");
const timeSelectorDiv = document.getElementById("timeSelectorDiv");
const timeSelector = document.getElementById("timeSelector");
const timerBar = document.getElementById("timerBar");
const progressText = document.getElementById("progressText");
const waitingText = document.getElementById("waitingText");

const questions = ["Kim?", "Kiminle?", "Nerede?", "Ne zaman?", "Ne oldu?"];
const beep = new Audio("/beep.mp3");

// =====================
// Web Audio Ses Efektleri
// =====================
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new AudioCtx();
  return audioCtx;
}

function playDing() {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1100, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4);
  } catch(e) {}
}

function playGameStart() {
  try {
    const ctx = getAudioCtx();
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
      gain.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.2);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.2);
    });
  } catch(e) {}
}

function playFanfare() {
  try {
    const ctx = getAudioCtx();
    [392, 523, 659, 784, 1047].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);
      gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.35);
      osc.start(ctx.currentTime + i * 0.1);
      osc.stop(ctx.currentTime + i * 0.1 + 0.35);
    });
  } catch(e) {}
}

// =====================
// Bağlantı
// =====================
createBtn.disabled = true;
joinBtn.disabled = true;

socket.on("connect", () => {
  createBtn.disabled = false;
  joinBtn.disabled = false;
});

socket.on("disconnect", () => {
  createBtn.disabled = true;
  joinBtn.disabled = true;
  showToast("Bağlantı kesildi, yeniden bağlanıyor...");
});

// =====================
// Oda oluştur
// =====================
createBtn.addEventListener("click", () => {
  const name = document.getElementById("createNameInput").value.trim();
  const room = document.getElementById("createRoomInput").value.trim();
  const code = document.getElementById("createRoomCodeInput").value.trim();
  if (!name || !room || !code) return showToast("Tüm alanları doldurun!");
  playerName = name;
  currentRoom = room;
  socket.emit("create-room", { playerName: name, roomName: room, roomCode: code });
});

// =====================
// Odaya katıl
// =====================
joinBtn.addEventListener("click", () => {
  const name = document.getElementById("joinNameInput").value.trim();
  const room = document.getElementById("joinRoomInput").value.trim();
  const code = document.getElementById("joinRoomCodeInput").value.trim();
  if (!name || !room || !code) return showToast("Tüm alanları doldurun!");
  playerName = name;
  currentRoom = room;
  socket.emit("join-room", { playerName: name, roomName: room, roomCode: code });
});

socket.on("room-joined", ({ roomName, isMaster: isM, players }) => {
  currentRoom = roomName;
  isMaster = isM;
  createRoomScreen.style.display = "none";
  joinRoomScreen.style.display = "none";
  lobbyScreen.style.display = "block";
  startGameBtn.style.display = isMaster ? "block" : "none";
  timeSelectorDiv.style.display = isMaster ? "block" : "none";
  waitingText.style.display = isMaster ? "none" : "block";
  updatePlayerList(players);
});

socket.on("you-are-now-master", () => {
  isMaster = true;
  startGameBtn.style.display = "block";
  timeSelectorDiv.style.display = "block";
  waitingText.style.display = "none";
  showToast("👑 Artık sen oda sahibisin!");
});

socket.on("room-error", (msg) => showToast(msg));
socket.on("update-player-list", (players) => updatePlayerList(players));

function updatePlayerList(players) {
  playerList.innerHTML = "";
  players.forEach(p => {
    const li = document.createElement("li");
    li.textContent = p;
    playerList.appendChild(li);
  });
}

startGameBtn.addEventListener("click", () => {
  socket.emit("start-game", currentRoom, parseInt(timeSelector.value));
});

// =====================
// Soru soruldu
// =====================
socket.on("ask-question", ({ questionIndex, questionTime }) => {
  currentQuestionIndex = questionIndex;
  gameScreen.style.display = "block";
  lobbyScreen.style.display = "none";
  resultScreen.style.display = "none";
  questionTitle.textContent = questions[questionIndex];
  answerInput.value = "";
  answerInput.disabled = false;
  answerInput.style.display = "block";
  submitBtn.disabled = false;
  submitBtn.style.display = "block";
  submitBtn.textContent = "✅ Gönder";
  progressText.textContent = "0/0 oyuncu cevapladı";
  if (questionIndex === 0) playGameStart();
  startTimer(questionTime || 30);
  setTimeout(() => answerInput.focus(), 100);
});

submitBtn.addEventListener("click", () => sendAnswer(answerInput.value.trim()));

answerInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); sendAnswer(answerInput.value.trim()); }
});

function sendAnswer(answer) {
  if (!answer) answer = "...";
  socket.emit("submit-answer", { roomName: currentRoom, questionIndex: currentQuestionIndex, answer });
  answerInput.disabled = true;
  submitBtn.disabled = true;
  submitBtn.textContent = "✔ Gönderildi";
  playDing();
  clearInterval(timerInterval);
  timerBar.style.width = "0%";
}

// =====================
// Tüm oyuncular cevapladı
// =====================
socket.on("waiting-master", () => {
  clearInterval(timerInterval);
  gameScreen.style.display = "block";
  lobbyScreen.style.display = "none";
  questionTitle.textContent = "Oyun kurucu hikayeyi başlatıyor...";
  answerInput.style.display = "none";
  submitBtn.style.display = "none";
  timerBar.style.width = "0";
  progressText.textContent = "Tüm oyuncular cevapladı 🎉";

  if (isMaster) {
    let startBtn = document.getElementById("startStoryBtn");
    if (!startBtn) {
      startBtn = document.createElement("button");
      startBtn.id = "startStoryBtn";
      startBtn.className = "btn btn-success";
      startBtn.textContent = "📖 Hikayeyi Başlat";
      startBtn.style.marginTop = "20px";
      startBtn.onclick = () => {
        socket.emit("master-start-story", currentRoom);
        startBtn.style.display = "none";
      };
      gameScreen.appendChild(startBtn);
    } else {
      startBtn.style.display = "block";
    }
  }
});

// =====================
// Kendi hikayesi gizlice geldi
// =====================
socket.on("your-story", ({ lines }) => {
  myStoryLines = lines;
});

// =====================
// Hikaye ekranı açıldı
// =====================
socket.on("show-story", ({ masterId, totalPlayers }) => {
  const amIMaster = socket.id === masterId;
  isMaster = amIMaster;
  gameScreen.style.display = "none";
  resultScreen.style.display = "block";
  storyList.innerHTML = "";
  playFanfare();

  if (amIMaster) {
    const info = document.createElement("p");
    info.id = "readerInfo";
    info.textContent = "Hazır! Sırayla okutmaya başla 👇";
    info.style.cssText = "text-align:center; font-weight:bold; margin-bottom:12px;";
    storyList.appendChild(info);

    const nextReaderBtn = document.createElement("button");
    nextReaderBtn.id = "nextReaderBtn";
    nextReaderBtn.className = "btn btn-primary";
    nextReaderBtn.textContent = "▶️ Sıradaki Okusun";
    nextReaderBtn.onclick = () => socket.emit("next-reader", currentRoom);
    storyList.appendChild(nextReaderBtn);
  } else {
    const waitText = document.createElement("p");
    waitText.id = "waitStoryText";
    waitText.textContent = "⏳ Sıranı bekle...";
    waitText.style.cssText = "text-align:center; color:#888; font-style:italic; font-size:18px;";
    storyList.appendChild(waitText);
  }
});

// =====================
// Kimin okuyacağı herkese bildirildi
// =====================
socket.on("reader-announced", ({ playerName, isLast }) => {
  const info = document.getElementById("readerInfo");
  if (info) info.textContent = `🎤 ${playerName} okuyor...`;

  const waitText = document.getElementById("waitStoryText");
  if (waitText) waitText.textContent = `🎤 ${playerName} okuyor...`;

  if (isLast) {
    const nextReaderBtn = document.getElementById("nextReaderBtn");
    if (nextReaderBtn) nextReaderBtn.style.display = "none";
  }
});

// =====================
// O oyuncuya "şimdi oku" sinyali geldi
// =====================
socket.on("read-now", ({ isLast }) => {
  if (isMaster) {
    // Master için hikayeyi butonun altında göster, butonu koruma
    const existing = document.getElementById("masterStoryArea");
    if (existing) existing.remove();
    
    const area = document.createElement("div");
    area.id = "masterStoryArea";
    area.style.marginTop = "16px";
    
    const title = document.createElement("p");
    title.textContent = "📖 Senin Hikayenin:";
    title.style.cssText = "font-weight:bold; font-size:16px; text-align:center;";
    area.appendChild(title);
    
    myStoryLines.forEach(line => {
      const li = document.createElement("li");
      li.textContent = line;
      area.appendChild(li);
    });
    
    storyList.appendChild(area);
    return;
  }
  
  storyList.innerHTML = "";
  resultScreen.scrollTop = 0;
  window.scrollTo(0, 0);

  const title = document.createElement("p");
  title.textContent = "📖 Senin Hikayenin:";
  title.style.cssText = "font-weight:bold; font-size:18px; text-align:center; margin-bottom:12px;";
  storyList.appendChild(title);

  myStoryLines.forEach(line => {
    const li = document.createElement("li");
    li.textContent = line;
    storyList.appendChild(li);
  });

  if (!isLast) {
    const doneReadingBtn = document.createElement("button");
    doneReadingBtn.className = "btn btn-success";
    doneReadingBtn.textContent = "✅ Okudum";
    doneReadingBtn.style.marginTop = "12px";
    doneReadingBtn.onclick = () => {
      doneReadingBtn.disabled = true;
      doneReadingBtn.textContent = "⏳ Sıradaki bekleniyor...";
    };
    storyList.appendChild(doneReadingBtn);
  }
});

// =====================
// Hikaye bitti
// =====================
socket.on("story-done", () => {
  if (isMaster) {
    const nextReaderBtn = document.getElementById("nextReaderBtn");
    if (nextReaderBtn) nextReaderBtn.remove();
    const info = document.getElementById("readerInfo");
    if (info) info.textContent = "🎉 Tüm hikayeler okundu!";
    const restartBtn = document.createElement("button");
    restartBtn.className = "btn btn-warning";
    restartBtn.textContent = "🔄 Tekrar Oyna";
    restartBtn.style.marginTop = "12px";
    restartBtn.onclick = () => socket.emit("restart-game", currentRoom);
    storyList.appendChild(restartBtn);
  } else {
    storyList.innerHTML = "";
    const doneText = document.createElement("p");
    doneText.textContent = "🎉 Tüm hikayeler okundu!";
    doneText.style.cssText = "text-align:center; font-weight:bold; font-size:18px;";
    storyList.appendChild(doneText);
  }
});

// =====================
// Oyun tekrar başlatıldı
// =====================
socket.on("game-restarted", () => {
  myStoryLines = [];
  resultScreen.style.display = "none";
  lobbyScreen.style.display = "block";
  storyList.innerHTML = "";
  answerInput.style.display = "block";
  submitBtn.style.display = "block";
  questionTitle.textContent = "";
  progressText.textContent = "";
});

socket.on("update-progress", ({ answered, total }) => {
  progressText.textContent = `${answered}/${total} oyuncu cevapladı`;
});

// =====================
// Timer
// =====================
function startTimer(seconds) {
  clearInterval(timerInterval);
  timeLeft = seconds;
  timerBar.style.width = "100%";
  timerBar.style.backgroundColor = "#4caf50";
  updateTimerDisplay(seconds, seconds);
  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerDisplay(timeLeft, seconds);
    if (timeLeft <= 5 && timeLeft > 0) {
      try { beep.currentTime = 0; beep.play(); } catch(e) {}
    }
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      if (!answerInput.disabled) sendAnswer(answerInput.value.trim());
    }
  }, 1000);
}

function updateTimerDisplay(timeLeft, total) {
  const percent = (timeLeft / total) * 100;
  timerBar.style.width = percent + "%";
  if (percent > 50) timerBar.style.backgroundColor = "#4caf50";
  else if (percent > 25) timerBar.style.backgroundColor = "#ff9800";
  else timerBar.style.backgroundColor = "#f44336";
  progressText.textContent = `⏰ ${timeLeft} saniye kaldı`;
}

// =====================
// Toast
// =====================
function showToast(msg) {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.style.cssText = `
      position: fixed; bottom: 30px; left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.82); color: #fff;
      padding: 12px 22px; border-radius: 99px;
      font-size: 14px; z-index: 9999;
      transition: opacity 0.3s; white-space: nowrap;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = "1";
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => toast.style.opacity = "0", 2800);
}