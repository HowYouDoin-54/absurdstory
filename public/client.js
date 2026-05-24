const socket = io();

let isMaster = false;
let currentRoom = "";
let playerName = "";
let currentQuestionIndex = 0;
let timerInterval = null;
let timeLeft = 0;

// DOM Elements
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

// Ses efekti
const beep = new Audio("/beep.mp3");

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

// =====================
// Odaya katıldı
// =====================
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

// =====================
// Yeni master atanırsa
// =====================
socket.on("you-are-now-master", () => {
  isMaster = true;
  startGameBtn.style.display = "block";
  timeSelectorDiv.style.display = "block";
  waitingText.style.display = "none";
  showToast("👑 Artık sen oda sahibisin!");
});

// =====================
// Hata mesajı
// =====================
socket.on("room-error", (msg) => showToast(msg));

// =====================
// Oyuncu listesi güncelle
// =====================
socket.on("update-player-list", (players) => updatePlayerList(players));

function updatePlayerList(players) {
  playerList.innerHTML = "";
  players.forEach(p => {
    const li = document.createElement("li");
    li.textContent = p;
    playerList.appendChild(li);
  });
}

// =====================
// Oyunu başlat (master)
// =====================
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

  progressText.textContent = `0/0 oyuncu cevapladı`;

  startTimer(questionTime || 30);

  // Mobilde klavyeyi aç
  setTimeout(() => answerInput.focus(), 100);
});

// =====================
// Cevap gönder
// =====================
submitBtn.addEventListener("click", () => sendAnswer(answerInput.value.trim()));

// Enter tuşuyla gönder
answerInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    sendAnswer(answerInput.value.trim());
  }
});

function sendAnswer(answer) {
  if (!answer) answer = "...";
  socket.emit("submit-answer", {
    roomName: currentRoom,
    questionIndex: currentQuestionIndex,
    answer
  });
  answerInput.disabled = true;
  submitBtn.disabled = true;
  submitBtn.textContent = "✔ Gönderildi";
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
// Hikayeyi göster
// =====================
socket.on("show-story", ({ stories }) => {
  gameScreen.style.display = "none";
  resultScreen.style.display = "block";
  storyList.innerHTML = "";

  // Master için kontrol butonları
  if (isMaster) {
    const btnWrapper = document.createElement("div");
    btnWrapper.id = "storyBtnWrapper";
    btnWrapper.style.display = "flex";
    btnWrapper.style.gap = "10px";
    btnWrapper.style.marginBottom = "16px";

    const nextBtn = document.createElement("button");
    nextBtn.className = "btn btn-primary";
    nextBtn.textContent = "➡️ Sonraki";
    nextBtn.style.flex = "1";
    nextBtn.onclick = () => socket.emit("story-next", currentRoom);

    const allBtn = document.createElement("button");
    allBtn.className = "btn btn-success";
    allBtn.textContent = "📖 Tümünü Göster";
    allBtn.style.flex = "1";
    allBtn.onclick = () => socket.emit("story-all", currentRoom);

    btnWrapper.appendChild(nextBtn);
    btnWrapper.appendChild(allBtn);
    storyList.appendChild(btnWrapper);
  } else {
    const waitText = document.createElement("p");
    waitText.id = "waitStoryText";
    waitText.textContent = "⏳ Oyun kurucu hikayeyi açıyor...";
    waitText.style.textAlign = "center";
    waitText.style.color = "#888";
    waitText.style.fontStyle = "italic";
    storyList.appendChild(waitText);
  }
});

// Sunucudan tek satır geldi
socket.on("story-line", ({ line, index, total }) => {
  const waitText = document.getElementById("waitStoryText");
  if (waitText) waitText.remove();

  const btnWrapper = document.getElementById("storyBtnWrapper");
  const li = document.createElement("li");
  li.textContent = line;
  if (btnWrapper) {
    storyList.insertBefore(li, btnWrapper);
  } else {
    storyList.appendChild(li);
  }
});

// Tüm satırlar geldi
socket.on("story-all-lines", ({ lines }) => {
  const waitText = document.getElementById("waitStoryText");
  if (waitText) waitText.remove();

  const btnWrapper = document.getElementById("storyBtnWrapper");
  
  // Önce mevcut satırları temizle
  const existingItems = storyList.querySelectorAll("li");
  existingItems.forEach(item => item.remove());

  lines.forEach(line => {
    const li = document.createElement("li");
    li.textContent = line;
    if (btnWrapper) {
      storyList.insertBefore(li, btnWrapper);
    } else {
      storyList.appendChild(li);
    }
  });
});
  const waitText = document.getElementById("waitStoryText");
  if (waitText) waitText.remove();

  const btnWrapper = document.getElementById("storyBtnWrapper");

  lines.forEach(line => {
    const li = document.createElement("li");
    li.textContent = line;
    if (btnWrapper) {
      storyList.insertBefore(li, btnWrapper);
    } else {
      storyList.appendChild(li);
    }
  });
});

// Hikaye bitti
socket.on("story-done", () => {
  const btnWrapper = document.getElementById("storyBtnWrapper");
  if (btnWrapper) btnWrapper.remove();

  if (isMaster) {
    const restartBtn = document.createElement("button");
    restartBtn.className = "btn btn-warning";
    restartBtn.textContent = "🔄 Tekrar Oyna";
    restartBtn.style.marginTop = "12px";
    restartBtn.onclick = () => socket.emit("restart-game", currentRoom);
    storyList.appendChild(restartBtn);
  } else {
    const doneText = document.createElement("p");
    doneText.textContent = "🎉 Hikaye bitti!";
    doneText.style.textAlign = "center";
    doneText.style.fontWeight = "bold";
    storyList.appendChild(doneText);
  }
});

// =====================
// Oyun tekrar başlatıldı
// =====================
socket.on("game-restarted", () => {
  resultScreen.style.display = "none";
  lobbyScreen.style.display = "block";
  storyList.innerHTML = "";
  answerInput.style.display = "block";
  submitBtn.style.display = "block";
  questionTitle.textContent = "";
  progressText.textContent = "";
});

// =====================
// İlerleme güncelleme
// =====================
socket.on("update-progress", ({ answered, total }) => {
  progressText.textContent = `${answered}/${total} oyuncu cevapladı`;
});

// =====================
// Timer fonksiyonu
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
      if (!answerInput.disabled) {
        sendAnswer(answerInput.value.trim());
      }
    }
  }, 1000);
}

function updateTimerDisplay(timeLeft, total) {
  const percent = (timeLeft / total) * 100;
  timerBar.style.width = percent + "%";

  // Renk: yeşil → sarı → kırmızı
  if (percent > 50) {
    timerBar.style.backgroundColor = "#4caf50";
  } else if (percent > 25) {
    timerBar.style.backgroundColor = "#ff9800";
  } else {
    timerBar.style.backgroundColor = "#f44336";
  }

  progressText.textContent = `⏰ ${timeLeft} saniye kaldı`;
}

// =====================
// Toast bildirimi
// =====================
function showToast(msg) {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.style.cssText = `
      position: fixed;
      bottom: 30px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.82);
      color: #fff;
      padding: 12px 22px;
      border-radius: 99px;
      font-size: 14px;
      z-index: 9999;
      transition: opacity 0.3s;
      white-space: nowrap;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = "1";
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => toast.style.opacity = "0", 2800);
}
