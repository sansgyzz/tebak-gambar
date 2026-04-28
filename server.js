const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// ── Data kata ──────────────────────────────────────────────
const WORDS = [
  { w: 'kucing', h: 'hewan peliharaan berbulu' },
  { w: 'mobil', h: 'kendaraan roda empat' },
  { w: 'pizza', h: 'makanan Italia bundar' },
  { w: 'pohon', h: 'tumbuhan besar berkayu' },
  { w: 'sepeda', h: 'kendaraan roda dua tanpa mesin' },
  { w: 'ikan', h: 'hewan yang hidup di air' },
  { w: 'rumah', h: 'tempat tinggal' },
  { w: 'pesawat', h: 'kendaraan udara' },
  { w: 'bunga', h: 'tumbuhan yang indah' },
  { w: 'gitar', h: 'alat musik petik' },
  { w: 'buku', h: 'sumber ilmu' },
  { w: 'matahari', h: 'bintang terdekat bumi' },
  { w: 'gunung', h: 'dataran tinggi berbentuk kerucut' },
  { w: 'komputer', h: 'alat elektronik pintar' },
  { w: 'kelinci', h: 'hewan berbulu telinga panjang' },
  { w: 'apel', h: 'buah merah atau hijau' },
  { w: 'kapal', h: 'kendaraan laut besar' },
  { w: 'jam', h: 'penunjuk waktu' },
  { w: 'kamera', h: 'alat untuk memotret' },
  { w: 'sendok', h: 'alat makan cekung' },
  { w: 'payung', h: 'pelindung dari hujan' },
  { w: 'topi', h: 'penutup kepala' },
  { w: 'kunci', h: 'alat membuka pintu' },
  { w: 'bola', h: 'mainan bundar' },
  { w: 'kursi', h: 'tempat duduk' },
  { w: 'pisang', h: 'buah kuning melengkung' },
  { w: 'robot', h: 'mesin berbentuk manusia' },
  { w: 'hujan', h: 'air turun dari langit' },
  { w: 'bulan', h: 'satelit bumi' },
  { w: 'naga', h: 'makhluk mitologi bernapas api' },
];

// ── Penyimpanan room ───────────────────────────────────────
// rooms[code] = { players:[{id,name,score,guessed}], drawerIndex, round, totalRounds,
//                 currentWord, timerInterval, started }
const rooms = {};

function makeRoomCode() {
  return Math.random().toString(36).substr(2, 4).toUpperCase();
}

function getRoomBySocket(socketId) {
  for (const code in rooms) {
    if (rooms[code].players.find(p => p.id === socketId)) return code;
  }
  return null;
}

function broadcastScores(code) {
  const room = rooms[code];
  if (!room) return;
  const scores = room.players.map(p => ({ name: p.name, score: p.score }));
  io.to(code).emit('scores', scores);
}

function startRound(code) {
  const room = rooms[code];
  if (!room) return;

  // Reset tebakan
  room.players.forEach(p => (p.guessed = false));

  if (room.round >= room.totalRounds) {
    endGame(code);
    return;
  }

  const wordObj = WORDS[Math.floor(Math.random() * WORDS.length)];
  room.currentWord = wordObj;
  const drawer = room.players[room.drawerIndex % room.players.length];

  io.to(code).emit('round_start', {
    round: room.round + 1,
    totalRounds: room.totalRounds,
    drawerName: drawer.name,
    drawerId: drawer.id,
    hint: wordObj.h,
    blanks: wordObj.w.replace(/./g, '_'),
    wordLength: wordObj.w.length,
  });

  // Kirim kata hanya ke drawer
  io.to(drawer.id).emit('your_word', wordObj.w);

  broadcastScores(code);

  // Timer 60 detik
  let timeLeft = 60;
  room.timerInterval = setInterval(() => {
    timeLeft--;
    io.to(code).emit('timer', timeLeft);
    if (timeLeft <= 0) {
      clearInterval(room.timerInterval);
      endRound(code);
    }
  }, 1000);
}

function endRound(code) {
  const room = rooms[code];
  if (!room) return;
  clearInterval(room.timerInterval);

  // Bonus poin untuk drawer berdasarkan jumlah yang menebak benar
  const drawer = room.players[room.drawerIndex % room.players.length];
  const guessedCount = room.players.filter(p => p.guessed).length;
  if (guessedCount > 0) drawer.score += guessedCount * 12;

  io.to(code).emit('round_end', {
    word: room.currentWord.w,
    scores: room.players.map(p => ({ name: p.name, score: p.score })),
  });

  broadcastScores(code);
  room.round++;
  room.drawerIndex++;

  setTimeout(() => startRound(code), 3000);
}

function endGame(code) {
  const room = rooms[code];
  if (!room) return;
  const sorted = [...room.players].sort((a, b) => b.score - a.score);
  io.to(code).emit('game_over', sorted.map(p => ({ name: p.name, score: p.score })));
}

// ── Socket events ──────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('Terhubung:', socket.id);

  // Buat room baru
  socket.on('create_room', ({ name, totalRounds }) => {
    const code = makeRoomCode();
    rooms[code] = {
      players: [{ id: socket.id, name, score: 0, guessed: false }],
      drawerIndex: 0,
      round: 0,
      totalRounds: totalRounds || 4,
      currentWord: null,
      timerInterval: null,
      started: false,
    };
    socket.join(code);
    socket.emit('room_created', { code, players: rooms[code].players.map(p => p.name) });
    console.log(`Room ${code} dibuat oleh ${name}`);
  });

  // Gabung room
  socket.on('join_room', ({ name, code }) => {
    const room = rooms[code];
    if (!room) { socket.emit('error', 'Kode ruangan tidak ditemukan!'); return; }
    if (room.started) { socket.emit('error', 'Game sudah dimulai!'); return; }
    if (room.players.length >= 10) { socket.emit('error', 'Ruangan penuh (maks. 10 pemain)!'); return; }

    room.players.push({ id: socket.id, name, score: 0, guessed: false });
    socket.join(code);

    const names = room.players.map(p => p.name);
    io.to(code).emit('player_joined', { name, players: names });
    console.log(`${name} bergabung ke room ${code}`);
  });

  // Mulai game (hanya host / pemain pertama)
  socket.on('start_game', () => {
    const code = getRoomBySocket(socket.id);
    if (!code) return;
    const room = rooms[code];
    if (room.players[0].id !== socket.id) { socket.emit('error', 'Hanya host yang bisa memulai!'); return; }
    if (room.players.length < 2) { socket.emit('error', 'Minimal 2 pemain!'); return; }
    room.started = true;
    room.totalRounds = room.players.length;
    io.to(code).emit('game_started');
    startRound(code);
  });

  // Gambar dari drawer
  socket.on('draw', (data) => {
    const code = getRoomBySocket(socket.id);
    if (!code) return;
    // Broadcast ke semua kecuali pengirim
    socket.to(code).emit('draw', data);
  });

  // Bersihkan kanvas
  socket.on('clear_canvas', () => {
    const code = getRoomBySocket(socket.id);
    if (!code) return;
    socket.to(code).emit('clear_canvas');
  });

  // Tebakan
  socket.on('guess', ({ text }) => {
    const code = getRoomBySocket(socket.id);
    if (!code) return;
    const room = rooms[code];
    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.guessed) return;

    const drawer = room.players[room.drawerIndex % room.players.length];
    if (socket.id === drawer.id) return; // drawer tidak boleh tebak

    const correct = text.trim().toLowerCase() === room.currentWord.w.toLowerCase();
    if (correct) {
      player.guessed = true;
      const pts = Math.max(10, room.timerInterval ? 80 : 10); // approx
      player.score += pts;

      io.to(code).emit('chat', { name: player.name, text, correct: true });
      broadcastScores(code);

      // Cek semua sudah menebak
      const nonDrawers = room.players.filter(p => p.id !== drawer.id);
      if (nonDrawers.every(p => p.guessed)) {
        clearInterval(room.timerInterval);
        endRound(code);
      }
    } else {
      io.to(code).emit('chat', { name: player.name, text, correct: false });
    }
  });

  // Chat biasa
  socket.on('chat', ({ text }) => {
    const code = getRoomBySocket(socket.id);
    if (!code) return;
    const player = rooms[code].players.find(p => p.id === socket.id);
    if (!player) return;
    io.to(code).emit('chat', { name: player.name, text, correct: false });
  });

  // Main lagi
  socket.on('play_again', () => {
    const code = getRoomBySocket(socket.id);
    if (!code) return;
    const room = rooms[code];
    if (room.players[0].id !== socket.id) return;
    room.round = 0;
    room.drawerIndex = 0;
    room.players.forEach(p => { p.score = 0; p.guessed = false; });
    io.to(code).emit('game_started');
    startRound(code);
  });

  // Disconnect
  socket.on('disconnect', () => {
    const code = getRoomBySocket(socket.id);
    if (!code) return;
    const room = rooms[code];
    const idx = room.players.findIndex(p => p.id === socket.id);
    if (idx === -1) return;
    const name = room.players[idx].name;
    room.players.splice(idx, 1);
    io.to(code).emit('player_left', { name, players: room.players.map(p => p.name) });
    if (room.players.length === 0) {
      clearInterval(room.timerInterval);
      delete rooms[code];
      console.log(`Room ${code} dihapus`);
    }
    console.log(`${name} keluar dari room ${code}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server berjalan di port ${PORT}`));
