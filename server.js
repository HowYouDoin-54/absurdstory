const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const QUESTIONS = ["Kim?", "Kiminle?", "Nerede?", "Ne zaman?", "Ne oldu?"];
const rooms = {};

io.on("connection", (socket) => {
  console.log("Yeni bağlantı:", socket.id);

  socket.on("create-room", ({ playerName, roomName, roomCode }) => {
    if (rooms[roomName]) return socket.emit("room-error", "Bu oda zaten var.");

    rooms[roomName] = {
      code: roomCode,
      players: [{ id: socket.id, name: playerName }],
      masterId: socket.id,
      currentQuestion: 0,
      playerStories: {},
      answersReceived: 0,
      storyMatrix: [],
      storyIndex: 0,
      questionTime: 30
    };

    socket.join(roomName);
    socket.emit("room-joined", {
      roomName,
      isMaster: true,
      players: rooms[roomName].players.map(p => p.name)
    });
    io.to(roomName).emit("update-player-list", rooms[roomName].players.map(p => p.name));
  });

  socket.on("join-room", ({ playerName, roomName, roomCode }) => {
    const room = rooms[roomName];
    if (!room) return socket.emit("room-error", "Oda bulunamadı.");
    if (room.code !== roomCode) return socket.emit("room-error", "Oda kodu yanlış.");

    // Aynı isimde oyuncu varsa masterId güncelle (reconnect)
    const existing = room.players.find(p => p.name === playerName);
    if (existing) {
      const wasMaster = existing.id === room.masterId;
      existing.id = socket.id;
      if (wasMaster) room.masterId = socket.id;
    } else {
      room.players.push({ id: socket.id, name: playerName });
    }

    socket.join(roomName);
    const isM = room.masterId === socket.id;
    socket.emit("room-joined", {
      roomName,
      isMaster: isM,
      players: room.players.map(p => p.name)
    });
    io.to(roomName).emit("update-player-list", room.players.map(p => p.name));
  });

  socket.on("start-game", (roomName, questionTime) => {
    const room = rooms[roomName];
    if (!room || socket.id !== room.masterId) return;
    if (room.players.length < 3) return socket.emit("room-error", "En az 3 kişi gerekli.");

    room.currentQuestion = 0;
    room.playerStories = {};
    room.answersReceived = 0;
    room.storyMatrix = [];
    room.storyIndex = 0;
    room.questionTime = questionTime || 30;

    io.to(roomName).emit("ask-question", {
      questionIndex: 0,
      questionTime: room.questionTime
    });
  });

  socket.on("submit-answer", ({ roomName, questionIndex, answer }) => {
    const room = rooms[roomName];
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    if (!room.playerStories[player.id]) room.playerStories[player.id] = [];
    room.playerStories[player.id][questionIndex] = answer && answer.trim() !== "" ? answer : "...";
    room.answersReceived++;

    io.to(roomName).emit("update-progress", {
      answered: room.answersReceived,
      total: room.players.length
    });

    if (room.answersReceived === room.players.length) {
      room.answersReceived = 0;
      room.currentQuestion++;

      if (room.currentQuestion < QUESTIONS.length) {
        io.to(roomName).emit("ask-question", {
          questionIndex: room.currentQuestion,
          questionTime: room.questionTime
        });
      } else {
        const playerIds = room.players.map(p => p.id);
        const shuffledIds = playerIds.slice().sort(() => Math.random() - 0.5);

        room.storyMatrix = [];
        for (let i = 0; i < playerIds.length; i++) {
          const story = [];
          for (let j = 0; j < QUESTIONS.length; j++) {
            const sourceId = shuffledIds[(i + j) % shuffledIds.length];
            story.push(room.playerStories[sourceId]?.[j] || "...");
          }
          room.storyMatrix.push({ playerName: room.players[i].name, storyLines: story });
        }

        room.storyIndex = 0;
        io.to(roomName).emit("waiting-master");
      }
    } else {
      socket.emit("waiting-others");
    }
  });

  socket.on("master-start-story", (roomName) => {
    const room = rooms[roomName];
    if (!room || socket.id !== room.masterId) return;
    room.currentPlayerIndex = 0;

    // Her oyuncuya kendi hikayesini gizlice gönder
    room.storyMatrix.forEach((s, i) => {
      const playerId = room.players[i].id;
      io.to(playerId).emit("your-story", { lines: s.storyLines });
    });

    // Master ekranına kontrol paneli gönder
    io.to(roomName).emit("show-story", { masterId: room.masterId, totalPlayers: room.players.length });
  });

  // Master sıradaki oyuncuyu okutmaya başlatır
  socket.on("next-reader", (roomName) => {
    const room = rooms[roomName];
    if (!room) return;
    console.log("next-reader:", roomName, "players:", room.players.map(p=>p.name), "matrix:", room.storyMatrix.map(s=>s.playerName), "index:", room.currentPlayerIndex);

    if (room.currentPlayerIndex < room.storyMatrix.length) {
      const s = room.storyMatrix[room.currentPlayerIndex];
      const playerName = s.playerName;
      const playerObj = room.players.find(p => p.name === playerName);
      const playerId = playerObj ? playerObj.id : null;
      const isLast = room.currentPlayerIndex === room.storyMatrix.length - 1;
      console.log("playerId:", playerId, "playerName:", playerName);
      if (playerId) io.to(playerId).emit("read-now", { isLast });
      io.to(roomName).emit("reader-announced", { playerName, isLast });
      room.currentPlayerIndex++;
    } else {
      io.to(roomName).emit("story-done");
    }
  });

  socket.on("restart-game", (roomName) => {
    const room = rooms[roomName];
    if (!room) return;

    room.currentQuestion = 0;
    room.playerStories = {};
    room.answersReceived = 0;
    room.storyMatrix = [];
    room.storyIndex = 0;
    room.currentPlayerIndex = 0;

    io.to(roomName).emit("game-restarted");
  });

  socket.on("disconnect", () => {
    for (const roomName in rooms) {
      const room = rooms[roomName];
      const index = room.players.findIndex(p => p.id === socket.id);
      if (index !== -1) {
        room.players.splice(index, 1);

        if (room.masterId === socket.id && room.players.length > 0) {
          room.masterId = room.players[0].id;
          io.to(room.masterId).emit("you-are-now-master");
        }

        if (room.players.length === 0) {
          delete rooms[roomName];
        } else {
          io.to(roomName).emit("update-player-list", room.players.map(p => p.name));
        }
        break;
      }
    }
  });
});

// Render.com ve diğer platformlar için PORT env değişkeni
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server ${PORT} portunda çalışıyor`));