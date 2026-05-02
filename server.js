const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const WIN_SCORE = 120;
const WORD_CHOICES = 3; // berapa pilihan kata yang diberikan ke drawer

const WORDS = [
  'kucing','mobil','pizza','pohon','sepeda','ikan','rumah','pesawat',
  'bunga','gitar','buku','matahari','gunung','komputer','kelinci',
  'apel','kapal','jam','kamera','sendok','payung','topi','kunci',
  'bola','kursi','pisang','robot','hujan','bulan','naga','jembatan',
  'kipas','lampu','sepatu','kacamata','piring','garpu','televisi',
  'telepon','semangka','donat','roti','balon','pensil','tas','sepatu',
  'anjing','burung','harimau','gajah','kuda','sapi','ayam','bebek',
  'perahu','kereta','motor','truk','bis','helikopter','roket',
  'apel','mangga','jeruk','anggur','strawberry','semangka','pepaya',
  'wortel','tomat','bawang','kentang','jagung','cabai',
  'kursi','meja','lemari','kasur','pintu','jendela','tangga',
  'pensil','penggaris','gunting','lem','kertas','buku','tas',
];

const rooms = {};

function makeRoomCode() {
  return Math.random().toString(36).substr(2, 5).toUpperCase();
}

function getRoomBySocket(socketId) {
  for (const code in rooms) {
    if (rooms[code].players.find(p => p.id === socketId)) return code;
  }
  return null;
}

function getRandomWords(count) {
  const shuffled = [...WORDS].sort(() => Math.random() - 0.5);
  return [...new Set(shuffled)].slice(0, count);
}

function checkWin(code) {
  const room = rooms[code];
  if (!room) return false;
  const winner = room.players.find(p => p.score >= WIN_SCORE);
  if (winner) {
    clearInterval(room.timerInterval);
    const sorted = [...room.players].sort((a, b) => b.score - a.score);
    io.to(code).emit('game_over', sorted.map(p => ({ name: p.name, score: p.score })));
    return true;
  }
  return false;
}

function broadcastScores(code) {
  const room = rooms[code];
  if (!room) return;
  io.to(code).emit('scores', room.players.map(p => ({ name: p.name, score: p.score })));
}

function startRound(code) {
  const room = rooms[code];
  if (!room) return;
  room.players.forEach(p => (p.guessed = false));
  room.currentWord = null;
  room.wordChoices = getRandomWords(WORD_CHOICES);
  room.choosingWord = true;

  const drawer = room.players[room.drawerIndex % room.players.length];

  // Beritahu semua bahwa drawer sedang memilih kata
  io.to(code).emit('choosing_word', {
    round: room.round + 1,
    totalRounds: room.totalRounds,
    drawerName: drawer.name,
    drawerId: drawer.id,
  });

  // Kirim pilihan kata hanya ke drawer
  io.to(drawer.id).emit('word_choices', room.wordChoices);

  broadcastScores(code);

  // Timeout 15 detik untuk pilih kata, kalau tidak dipilih ambil random
  room.choiceTimeout = setTimeout(() => {
    if (room.choosingWord) {
      const auto = room.wordChoices[0];
      handleWordChosen(code, auto);
    }
  }, 15000);
}

function handleWordChosen(code, word) {
  const room = rooms[code];
  if (!room) return;
  clearTimeout(room.choiceTimeout);
  room.choosingWord = false;
  room.currentWord = word;

  const drawer = room.players[room.drawerIndex % room.players.length];

  io.to(code).emit('round_start', {
    round: room.round + 1,
    totalRounds: room.totalRounds,
    drawerName: drawer.name,
    drawerId: drawer.id,
    wordLength: word.length,
  });

  io.to(drawer.id).emit('your_word', word);

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

  const drawer = room.players[room.drawerIndex % room.players.length];
  const guessedCount = room.players.filter(p => p.guessed).length;
  if (guessedCount > 0) drawer.score += guessedCount * 5; // kecil untuk drawer

  io.to(code).emit('round_end', {
    word: room.currentWord || '???',
    scores: room.players.map(p => ({ name: p.name, score: p.score })),
  });

  broadcastScores(code);
  if (checkWin(code)) return;

  room.round++;
  room.drawerIndex++;
  if (room.round >= room.totalRounds) {
    setTimeout(() => endGame(code), 2500);
  } else {
    setTimeout(() => startRound(code), 3000);
  }
}

function endGame(code) {
  const room = rooms[code];
  if (!room) return;
  const sorted = [...room.players].sort((a, b) => b.score - a.score);
  io.to(code).emit('game_over', sorted.map(p => ({ name: p.name, score: p.score })));
}

io.on('connection', (socket) => {

  socket.on('check_room', ({ code }) => {
    const room = rooms[code];
    if (room && !room.started) socket.emit('room_valid', { code, players: room.players.map(p => p.name) });
    else if (room && room.started) socket.emit('error', 'Game sudah dimulai!');
    else socket.emit('error', 'Ruangan tidak ditemukan!');
  });

  socket.on('create_room', ({ name }) => {
    const code = makeRoomCode();
    rooms[code] = {
      players: [{ id: socket.id, name, score: 0, guessed: false }],
      drawerIndex: 0, round: 0, totalRounds: 10,
      currentWord: null, wordChoices: [], choosingWord: false,
      timerInterval: null, choiceTimeout: null, started: false,
    };
    socket.join(code);
    socket.emit('room_created', { code, players: rooms[code].players.map(p => p.name) });
  });

  socket.on('join_room', ({ name, code }) => {
    const room = rooms[code];
    if (!room) { socket.emit('error', 'Kode ruangan tidak ditemukan!'); return; }
    if (room.started) { socket.emit('error', 'Game sudah dimulai!'); return; }
    if (room.players.length >= 10) { socket.emit('error', 'Ruangan penuh!'); return; }
    room.players.push({ id: socket.id, name, score: 0, guessed: false });
    socket.join(code);
    io.to(code).emit('player_joined', { name, players: room.players.map(p => p.name) });
  });

  socket.on('start_game', () => {
    const code = getRoomBySocket(socket.id);
    if (!code) return;
    const room = rooms[code];
    if (room.players[0].id !== socket.id) { socket.emit('error', 'Hanya host yang bisa memulai!'); return; }
    if (room.players.length < 2) { socket.emit('error', 'Minimal 2 pemain!'); return; }
    room.started = true;
    room.totalRounds = room.players.length * 2;
    io.to(code).emit('game_started', { winScore: WIN_SCORE });
    startRound(code);
  });

  // Drawer memilih kata
  socket.on('choose_word', ({ word }) => {
    const code = getRoomBySocket(socket.id);
    if (!code) return;
    const room = rooms[code];
    if (!room.choosingWord) return;
    const drawer = room.players[room.drawerIndex % room.players.length];
    if (socket.id !== drawer.id) return;
    if (!room.wordChoices.includes(word)) return;
    handleWordChosen(code, word);
  });

  socket.on('draw', (data) => {
    const code = getRoomBySocket(socket.id);
    if (code) socket.to(code).emit('draw', data);
  });

  socket.on('clear_canvas', () => {
    const code = getRoomBySocket(socket.id);
    if (code) socket.to(code).emit('clear_canvas');
  });

  socket.on('guess', ({ text }) => {
    const code = getRoomBySocket(socket.id);
    if (!code) return;
    const room = rooms[code];
    if (!room.currentWord) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.guessed) return;
    const drawer = room.players[room.drawerIndex % room.players.length];
    if (socket.id === drawer.id) return;

    const correct = text.trim().toLowerCase() === room.currentWord.toLowerCase();
    if (correct) {
      player.guessed = true;
      const alreadyGuessed = room.players.filter(p => p.guessed).length;
      // Poin lebih kecil: pertama +10, berikutnya turun
      const pts = Math.max(5, 10 - (alreadyGuessed - 1) * 2);
      player.score += pts;
      io.to(code).emit('chat', { name: player.name, text, correct: true, pts });
      broadcastScores(code);
      if (checkWin(code)) return;
      const nonDrawers = room.players.filter(p => p.id !== drawer.id);
      if (nonDrawers.every(p => p.guessed)) {
        clearInterval(room.timerInterval);
        endRound(code);
      }
    } else {
      io.to(code).emit('chat', { name: player.name, text, correct: false });
    }
  });

  socket.on('chat', ({ text }) => {
    const code = getRoomBySocket(socket.id);
    if (!code) return;
    const player = rooms[code].players.find(p => p.id === socket.id);
    if (player) io.to(code).emit('chat', { name: player.name, text, correct: false });
  });

  socket.on('play_again', () => {
    const code = getRoomBySocket(socket.id);
    if (!code) return;
    const room = rooms[code];
    if (room.players[0].id !== socket.id) return;
    room.round = 0; room.drawerIndex = 0; room.started = true;
    room.totalRounds = room.players.length * 2;
    room.players.forEach(p => { p.score = 0; p.guessed = false; });
    io.to(code).emit('game_started', { winScore: WIN_SCORE });
    startRound(code);
  });

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
      clearTimeout(room.choiceTimeout);
      delete rooms[code];
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🎨 Tebak Gambar running on port ${PORT}`));
