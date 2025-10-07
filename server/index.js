const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const Game = require('./game/Game');
const FightGame = require('./game/FightGame');

const app = express();
const server = http.createServer(app);

// Configurar Socket.IO (CORS totalmente liberado)
const io = socketIO(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

const PORT = process.env.PORT || 3001;

// Configuração do multer para upload de avatares
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../games/gotargario/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas (jpg, jpeg, png, gif)'));
    }
  }
});

// Middleware
app.use(express.json());

// CORS totalmente liberado
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Servir arquivos estáticos da raiz do projeto (index.html, games/, etc)
app.use(express.static(path.join(__dirname, '..'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  etag: true
}));

// Rota de upload de avatar
app.post('/upload-avatar', upload.single('avatar'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  }
  res.json({
    success: true,
    filename: req.file.filename,
    path: `/games/gotargario/uploads/${req.file.filename}`
  });
});

// Inicializar o jogo
const game = new Game();
game.setIO(io); // Passar referência do socket.io para o game

// Inicializar o jogo de luta
const fightGame = new FightGame();
fightGame.setIO(io);

// Socket.io - Gerenciamento de conexões
io.on('connection', (socket) => {
  console.log(`Novo jogador conectado: ${socket.id}`);

  // Jogador entra no jogo
  socket.on('join', (playerData) => {
    const { name, avatar } = playerData;
    game.addPlayer(socket.id, name, avatar);

    socket.emit('init', {
      playerId: socket.id,
      gameState: game.getState()
    });

    // Notificar outros jogadores
    socket.broadcast.emit('chat', {
      id: 'system',
      name: 'Sistema',
      message: `${name} entrou no jogo!`
    });

    console.log(`Jogador ${name} (${socket.id}) entrou no jogo`);
  });

  // Movimento do jogador
  socket.on('move', (target) => {
    game.updatePlayerTarget(socket.id, target);
  });

  // Split (dividir célula)
  socket.on('split', () => {
    game.splitPlayer(socket.id);
  });

  // Eject (ejetar massa)
  socket.on('eject', () => {
    game.ejectMass(socket.id);
  });

  // Shoot (atirar projétil explosivo) - PODER ESPECIAL!
  socket.on('shoot', () => {
    game.shootProjectile(socket.id);
  });

  // Chat
  socket.on('chat', (data) => {
    const player = game.players.get(socket.id);
    if (player) {
      // Broadcast mensagem para todos
      io.emit('chat', {
        id: socket.id,
        name: player.name,
        message: data.message
      });
    }
  });

  // Desconexão
  socket.on('disconnect', () => {
    const player = game.players.get(socket.id);
    if (player) {
      // Notificar outros jogadores
      io.emit('chat', {
        id: 'system',
        name: 'Sistema',
        message: `${player.name} saiu do jogo`
      });
    }
    game.removePlayer(socket.id);

    // Handle fight game disconnect
    fightGame.handleDisconnect(socket.id);

    console.log(`Jogador desconectado: ${socket.id}`);
  });

  // ===== FIGHT GAME HANDLERS =====

  // Join matchmaking queue
  socket.on('fight:joinQueue', (playerData) => {
    console.log(`🎮 [FIGHT] Player joining queue:`, playerData);
    fightGame.joinQueue(socket.id, playerData);
  });

  // Leave matchmaking queue
  socket.on('fight:leaveQueue', () => {
    fightGame.leaveQueue(socket.id);
  });

  // Join game (reconnect with new socket ID)
  socket.on('fight:joinGame', (data) => {
    console.log(`🎮 [FIGHT] Player joining game:`, data);
    const result = fightGame.joinGame(socket.id, data.roomId, data.oldPlayerId);
    
    if (result.success) {
      socket.emit('gameJoined', result);
    } else {
      console.error(`❌ Failed to join game:`, result.error);
      socket.emit('error', { message: result.error });
    }
  });

  // Update player input
  socket.on('fight:input', (input) => {
    fightGame.updatePlayerInput(socket.id, input);
  });
});

const TICK_RATE = 1000 / 30;
let lastLeaderboard = null;

// Game update loop (Gotargario)
setInterval(() => {
  game.update();

  // Enviar estado individualizado para cada jogador (viewport culling)
  io.sockets.sockets.forEach((socket) => {
    const playerId = socket.id;
    const player = game.players.get(playerId);

    if (!player) return;

    // Calcular tamanho do viewport baseado no tamanho do jogador
    const totalRadius = player.cells.reduce((sum, cell) => sum + cell.radius, 0);
    const avgRadius = totalRadius / player.cells.length;
    const zoom = Math.max(0.5, Math.min(1, 60 / avgRadius));

    // Viewport size aproximado (tela típica / zoom)
    const viewportSize = {
      width: 1920 / zoom,
      height: 1080 / zoom
    };

    // Obter estado filtrado por viewport
    const gameState = game.getState(playerId, viewportSize);

    // Otimizar leaderboard - só enviar se mudou
    const currentLeaderboard = JSON.stringify(gameState.leaderboard);
    if (currentLeaderboard === lastLeaderboard) {
      delete gameState.leaderboard;
    } else {
      lastLeaderboard = currentLeaderboard;
    }

    // Enviar apenas para este jogador
    socket.emit('update', gameState);
  });
}, TICK_RATE);

// Fight game update loop
let fightLoopCount = 0;
setInterval(() => {
  // Update all active fight rooms
  const roomCount = fightGame.rooms.size;

  if (roomCount > 0) {
    fightLoopCount++;
    if (fightLoopCount % 30 === 0) { // Log every second
      console.log(`🔄 Fight game loop running... Active rooms: ${roomCount}`);
    }

    for (const [roomId, room] of fightGame.rooms) {
      fightGame.updateRoom(roomId, TICK_RATE);
    }
  }
}, TICK_RATE);

// Iniciar servidor
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🎮 Servidor rodando em http://0.0.0.0:${PORT}`);
  console.log(`📡 Acesse pelo seu IP público na porta ${PORT}`);
});
