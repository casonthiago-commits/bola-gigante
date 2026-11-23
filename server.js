const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const PORT = process.env.PORT || 3000;

app.use(express.static("public"));
app.get("/health", (_req, res) => res.json({ ok: true, game: "Bola Gigante" }));

const rooms = new Map();
const W = 1000, H = 560, BALL_R = 62, PLAYER_R = 15;
const MAX_PER_TEAM = 30;

function code() { return String(Math.floor(1000 + Math.random() * 9000)); }
function freshRoom(roomCode, hostId) {
  return {
    code: roomCode, hostId, players: new Map(),
    ball: { x: W / 2, y: H / 2, vx: 0, vy: 0 },
    score: { blue: 0, red: 0 }, timeLeft: 180, running: false,
    lastTick: Date.now(), lastGoal: 0
  };
}
function snapshot(room) {
  return {
    code: room.code, running: room.running, score: room.score,
    timeLeft: room.timeLeft, ball: room.ball,
    players: [...room.players.values()].map(p => ({
      id: p.id, name: p.name, team: p.team, x: p.x, y: p.y
    }))
  };
}
function emitRoom(room) { io.to(room.code).emit("state", snapshot(room)); }
function assignTeam(room) {
  const blue = [...room.players.values()].filter(p => p.team === "blue" && !p.host).length;
  const red = [...room.players.values()].filter(p => p.team === "red" && !p.host).length;
  if (blue >= MAX_PER_TEAM && red >= MAX_PER_TEAM) return null;
  return blue <= red && blue < MAX_PER_TEAM ? "blue" : "red";
}

io.on("connection", socket => {
  socket.on("createRoom", ({ name } = {}, cb = () => {}) => {
    const roomCode = code();
    const room = freshRoom(roomCode, socket.id);
    rooms.set(roomCode, room);
    socket.join(roomCode);
    const player = { id: socket.id, name: cleanName(name || "Professor"), team: "blue",
      x: 130, y: H/2, vx: 0, vy: 0, input: { x: 0, y: 0 }, host: true };
    room.players.set(socket.id, player);
    socket.data.roomCode = roomCode;
    cb({ ok: true, code: roomCode, host: true, team: "blue" });
    emitRoom(room);
  });

  socket.on("joinRoom", ({ code: roomCode, name } = {}, cb = () => {}) => {
    const room = rooms.get(String(roomCode || "").trim());
    if (!room) return cb({ ok: false, error: "Sala não encontrada. Confira o código." });
    if (room.players.size >= MAX_PER_TEAM * 2 + 1) return cb({ ok: false, error: "A sala já está com 60 alunos." });
    const team = assignTeam(room);
    if (!team) return cb({ ok: false, error: "As duas equipes já têm 30 alunos." });
    const count = [...room.players.values()].filter(p => p.team === team && !p.host).length;
    const player = { id: socket.id, name: cleanName(name || "Aluno"),
      team, x: team === "blue" ? 180 : W - 180,
      y: 90 + (count % 12) * 32, vx: 0, vy: 0, input: { x: 0, y: 0 }, host: false };
    room.players.set(socket.id, player);
    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    cb({ ok: true, code: roomCode, host: false, team });
    emitRoom(room);
  });

  socket.on("input", data => {
    const room = rooms.get(socket.data.roomCode);
    const p = room && room.players.get(socket.id);
    if (!p || p.host || !data) return;
    const x = Number(data.x), y = Number(data.y);
    p.input.x = Number.isFinite(x) ? Math.max(-1, Math.min(1, x)) : 0;
    p.input.y = Number.isFinite(y) ? Math.max(-1, Math.min(1, y)) : 0;
  });

  socket.on("hostAction", action => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.hostId !== socket.id) return;
    if (action === "start") { room.running = true; room.lastTick = Date.now(); }
    if (action === "pause") room.running = false;
    if (action === "reset") {
      room.running = false; room.score = { blue: 0, red: 0 }; room.timeLeft = 180;
      room.ball = { x: W/2, y: H/2, vx: 0, vy: 0 };
      for (const p of room.players.values()) {
        p.x = p.team === "blue" ? 180 : W-180; p.y = H/2; p.vx = p.vy = 0;
      }
    }
    emitRoom(room);
  });

  socket.on("disconnect", () => {
    const roomCode = socket.data.roomCode;
    const room = rooms.get(roomCode);
    if (!room) return;
    room.players.delete(socket.id);
    if (room.hostId === socket.id) {
      room.running = false;
      io.to(roomCode).emit("roomClosed", "O professor encerrou a sala.");
      rooms.delete(roomCode);
    } else {
      emitRoom(room);
      if (room.players.size === 0) rooms.delete(roomCode);
    }
  });
});

function cleanName(s) { return String(s).replace(/[<>]/g, "").trim().slice(0, 18) || "Aluno"; }

setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    const dt = Math.min((now - room.lastTick) / 1000, 0.05);
    room.lastTick = now;
    if (!room.running) continue;

    for (const p of room.players.values()) {
      if (p.host) continue;
      const speed = 210;
      p.vx = p.input.x * speed;
      p.vy = p.input.y * speed;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.x = Math.max(PLAYER_R, Math.min(W-PLAYER_R, p.x));
      p.y = Math.max(PLAYER_R, Math.min(H-PLAYER_R, p.y));

      const dx = room.ball.x - p.x, dy = room.ball.y - p.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      if (dist < BALL_R + PLAYER_R) {
        const nx = dx/dist, ny = dy/dist;
        const overlap = BALL_R + PLAYER_R - dist;
        room.ball.x += nx * overlap * 0.55;
        room.ball.y += ny * overlap * 0.55;
        room.ball.vx += nx * 210 * dt + p.input.x * 115 * dt;
        room.ball.vy += ny * 210 * dt + p.input.y * 115 * dt;
      }
    }

    room.ball.x += room.ball.vx * dt;
    room.ball.y += room.ball.vy * dt;
    room.ball.vx *= Math.pow(0.985, dt * 60);
    room.ball.vy *= Math.pow(0.985, dt * 60);
    room.ball.y = Math.max(BALL_R, Math.min(H-BALL_R, room.ball.y));
    if (room.ball.x < BALL_R) { room.ball.x = BALL_R; room.ball.vx *= -0.45; }
    if (room.ball.x > W-BALL_R) { room.ball.x = W-BALL_R; room.ball.vx *= -0.45; }

    // Gols nas aberturas centrais das linhas de fundo.
    const goalTop = H/2 - 135, goalBottom = H/2 + 135;
    if (room.ball.x <= BALL_R + 3 && room.ball.y > goalTop && room.ball.y < goalBottom && now-room.lastGoal > 1300) {
      room.score.red++; resetBall(room); room.lastGoal = now;
    } else if (room.ball.x >= W-BALL_R-3 && room.ball.y > goalTop && room.ball.y < goalBottom && now-room.lastGoal > 1300) {
      room.score.blue++; resetBall(room); room.lastGoal = now;
    }
    room.timeLeft -= dt;
    if (room.timeLeft <= 0) { room.timeLeft = 0; room.running = false; }
    emitRoom(room);
  }
}, 33);

function resetBall(room) {
  room.ball = { x: W/2, y: H/2, vx: 0, vy: 0 };
}
server.listen(PORT, () => console.log(`Bola Gigante rodando na porta ${PORT}`));
