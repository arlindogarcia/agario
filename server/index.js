const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const Game = require('./game/Game');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = process.env.PORT || 3001;

// Configuração do multer para upload de avatares
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../public/uploads');
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
app.use(express.static(path.join(__dirname, '../public')));

// Rota de upload de avatar
app.post('/upload-avatar', upload.single('avatar'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  }
  res.json({
    success: true,
    filename: req.file.filename,
    path: `/uploads/${req.file.filename}`
  });
});

// Inicializar o jogo
const game = new Game();

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
    console.log(`Jogador desconectado: ${socket.id}`);
  });
});

// Loop do jogo - 60 FPS
const TICK_RATE = 1000 / 60;
setInterval(() => {
  game.update();

  // Enviar estado do jogo para todos os clientes
  io.emit('update', game.getState());
}, TICK_RATE);

// Iniciar servidor
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🎮 Servidor Agar.io rodando em http://0.0.0.0:${PORT}`);
  console.log(`📡 Acesse pelo seu IP público na porta ${PORT}`);
});
