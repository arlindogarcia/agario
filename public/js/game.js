// Configuração do Canvas
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Minimapa
const minimapCanvas = document.getElementById('minimapCanvas');
const minimapCtx = minimapCanvas.getContext('2d');
minimapCanvas.width = 200;
minimapCanvas.height = 200;

// Chat
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const chatSend = document.getElementById('chatSend');

// Ajustar canvas ao tamanho da tela
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

// Variáveis do jogo
let socket;
let playerId = null;
let playerName = null;
let gameState = null;
let previousGameState = null;
let lastUpdateTime = Date.now();
let camera = { x: 0, y: 0, zoom: 1 };
let mouse = { x: 0, y: 0 };
let avatarImages = new Map();

// Conectar ao servidor
function init() {
  // Obter dados do jogador
  const playerData = JSON.parse(localStorage.getItem('playerData') || '{}');

  if (!playerData.name) {
    window.location.href = '/';
    return;
  }

  playerName = playerData.name;

  // Conectar ao Socket.io
  socket = io();

  socket.on('connect', () => {
    console.log('Conectado ao servidor!');
    socket.emit('join', playerData);
    addChatMessage('Sistema', 'Você entrou no jogo!', true);
  });

  socket.on('init', (data) => {
    playerId = data.playerId;
    gameState = data.gameState;
    console.log('Jogo inicializado!', data);
  });

  socket.on('update', (data) => {
    // Armazenar estado anterior para interpolação
    previousGameState = gameState;
    gameState = data;
    lastUpdateTime = Date.now();
    updateUI();
  });

  socket.on('disconnect', () => {
    console.log('Desconectado do servidor');
    alert('Conexão perdida com o servidor');
    window.location.href = '/';
  });

  // Chat
  socket.on('chat', (data) => {
    addChatMessage(data.name, data.message, false, data.id === playerId);
  });

  // Eventos de input
  setupInputHandlers();
  setupChatHandlers();

  // Loop de renderização
  requestAnimationFrame(gameLoop);
}

// Configurar controles
function setupInputHandlers() {
  let lastMoveTime = 0;
  const MOVE_THROTTLE = 30;

  // Movimento do mouse
  canvas.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;

    // Throttle - só enviar se passou tempo suficiente
    const now = Date.now();
    if (now - lastMoveTime < MOVE_THROTTLE) {
      return;
    }
    lastMoveTime = now;

    // Garantir que zoom é válido
    const safeZoom = Math.max(0.1, Math.min(2, camera.zoom));

    // Converter para coordenadas do mundo
    const worldX = camera.x + (e.clientX - canvas.width / 2) / safeZoom;
    const worldY = camera.y + (e.clientY - canvas.height / 2) / safeZoom;

    // Validar coordenadas antes de enviar
    if (!isNaN(worldX) && !isNaN(worldY) && isFinite(worldX) && isFinite(worldY)) {
      socket.emit('move', { x: worldX, y: worldY });
    }
  });

  // Teclado
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      socket.emit('split');
    } else if (e.code === 'KeyW') {
      e.preventDefault();
      socket.emit('eject');
    }
  });
}

// Atualizar UI (score e leaderboard)
function updateUI() {
  if (!gameState || !playerId) return;

  // Atualizar score
  const currentPlayer = gameState.players.find(p => p.id === playerId);
  if (currentPlayer) {
    document.getElementById('playerScore').textContent = currentPlayer.score;
  }

  // Atualizar leaderboard
  const leaderboardList = document.getElementById('leaderboardList');
  if (gameState.leaderboard && gameState.leaderboard.length > 0) {
    leaderboardList.innerHTML = gameState.leaderboard
      .map((entry, index) => {
        const isCurrent = currentPlayer && entry.name === currentPlayer.name;
        return `<li class="${isCurrent ? 'current-player' : ''}">
          ${entry.name} - ${entry.score}
        </li>`;
      })
      .join('');
  }
}

// Interpolar estado do jogo para movimento suave
function getInterpolatedState() {
  if (!gameState || !previousGameState) return gameState;

  const now = Date.now();
  const timeSinceUpdate = now - lastUpdateTime;
  const serverTickRate = 1000 / 30;

  const t = Math.min(timeSinceUpdate / serverTickRate, 1.2);

  // Interpolar apenas posições de células
  const interpolatedState = JSON.parse(JSON.stringify(gameState));

  if (interpolatedState.players && previousGameState.players) {
    interpolatedState.players.forEach(player => {
      const prevPlayer = previousGameState.players.find(p => p.id === player.id);
      if (prevPlayer && prevPlayer.cells && player.cells) {
        player.cells.forEach((cell, i) => {
          const prevCell = prevPlayer.cells[i];
          if (prevCell) {
            // Interpolar posição
            cell.x = prevCell.x + (cell.x - prevCell.x) * t;
            cell.y = prevCell.y + (cell.y - prevCell.y) * t;
          }
        });
      }
    });
  }

  return interpolatedState;
}

// Loop principal do jogo
function gameLoop() {
  if (gameState) {
    updateCamera();
    render();
  }
  requestAnimationFrame(gameLoop);
}

// Atualizar câmera
function updateCamera() {
  if (!playerId || !gameState) return;

  const player = gameState.players.find(p => p.id === playerId);
  if (!player || player.cells.length === 0) return;

  // Calcular centro das células do jogador (média simples, não ponderada)
  let centerX = 0;
  let centerY = 0;

  player.cells.forEach(cell => {
    centerX += cell.x;
    centerY += cell.y;
  });

  centerX /= player.cells.length;
  centerY /= player.cells.length;

  // Smooth camera - mais responsiva para gameplay rápido
  camera.x += (centerX - camera.x) * 0.18; // Era 0.1, agora 0.18
  camera.y += (centerY - camera.y) * 0.18;

  // Zoom baseado no tamanho total do jogador
  const totalRadius = player.cells.reduce((sum, cell) => sum + cell.radius, 0);
  const avgRadius = totalRadius / player.cells.length;

  // Zoom mais conservador - não fica tão pequeno
  const targetZoom = Math.max(0.5, Math.min(1, 60 / avgRadius));
  camera.zoom += (targetZoom - camera.zoom) * 0.05; // Era 0.03, agora 0.05 (mais rápido)

  // Garantir que valores são válidos
  camera.x = isFinite(camera.x) ? camera.x : 0;
  camera.y = isFinite(camera.y) ? camera.y : 0;
  camera.zoom = isFinite(camera.zoom) && camera.zoom > 0 ? camera.zoom : 1;
}

// Renderizar o jogo
function render() {
  // Limpar canvas
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (!gameState) return;

  // Usar estado interpolado para renderização suave
  const state = getInterpolatedState();

  ctx.save();

  // Aplicar transformação da câmera
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);

  // Desenhar grid
  drawGrid();

  // Desenhar bordas do mundo
  drawWorldBorders(state);

  // Desenhar comida
  if (state.food) {
    state.food.forEach(food => {
      drawFood(food);
    });
  }

  // Desenhar células dos jogadores
  if (state.players) {
    state.players.forEach(player => {
      player.cells.forEach(cell => {
        drawCell(cell, player);
      });
    });

    // Desenhar nomes por cima
    state.players.forEach(player => {
      player.cells.forEach(cell => {
        drawCellName(cell, player);
      });
    });
  }

  ctx.restore();
}

// Desenhar grid de fundo
function drawGrid() {
  const gridSize = 50;
  const startX = Math.floor(camera.x - canvas.width / 2 / camera.zoom / gridSize) * gridSize;
  const startY = Math.floor(camera.y - canvas.height / 2 / camera.zoom / gridSize) * gridSize;
  const endX = startX + Math.ceil(canvas.width / camera.zoom / gridSize) * gridSize;
  const endY = startY + Math.ceil(canvas.height / camera.zoom / gridSize) * gridSize;

  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 1 / camera.zoom;

  for (let x = startX; x <= endX; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY);
    ctx.stroke();
  }

  for (let y = startY; y <= endY; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
    ctx.stroke();
  }
}

// Desenhar bordas do mundo
function drawWorldBorders(state) {
  if (!state.worldSize) return;

  ctx.strokeStyle = '#ff0000';
  ctx.lineWidth = 10 / camera.zoom;
  ctx.strokeRect(0, 0, state.worldSize.width, state.worldSize.height);
}

// Desenhar comida
function drawFood(food) {
  ctx.fillStyle = food.color;
  ctx.beginPath();
  ctx.arc(food.x, food.y, food.radius, 0, Math.PI * 2);
  ctx.fill();
}

// Desenhar célula
function drawCell(cell, player) {
  // Sombra
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = 10 / camera.zoom;
  ctx.shadowOffsetX = 3 / camera.zoom;
  ctx.shadowOffsetY = 3 / camera.zoom;

  // Célula
  ctx.fillStyle = cell.color;
  ctx.beginPath();
  ctx.arc(cell.x, cell.y, cell.radius, 0, Math.PI * 2);
  ctx.fill();

  // Borda
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.lineWidth = 3 / camera.zoom;
  ctx.stroke();

  // Avatar (se tiver)
  if (player.avatar) {
    drawAvatar(cell, player.avatar);
  }
}

// Desenhar avatar na célula
function drawAvatar(cell, avatarPath) {
  if (!avatarImages.has(avatarPath)) {
    const img = new Image();
    img.src = avatarPath;
    img.onload = () => {
      avatarImages.set(avatarPath, img);
    };
    return;
  }

  const img = avatarImages.get(avatarPath);
  const size = cell.radius * 1.5;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cell.x, cell.y, cell.radius * 0.7, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, cell.x - size / 2, cell.y - size / 2, size, size);
  ctx.restore();
}

// Desenhar nome da célula
function drawCellName(cell, player) {
  if (cell.radius < 20) return; // Não mostrar nome em células muito pequenas

  ctx.fillStyle = 'white';
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.lineWidth = 3 / camera.zoom;
  ctx.font = `bold ${Math.max(12, cell.radius / 3) / camera.zoom}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const y = player.avatar ? cell.y + cell.radius * 0.6 : cell.y;

  ctx.strokeText(player.name, cell.x, y);
  ctx.fillText(player.name, cell.x, y);
}

// ============= MINIMAPA =============
function renderMinimap() {
  if (!gameState || !gameState.worldSize) return;

  // Usar estado interpolado
  const state = getInterpolatedState();
  if (!state) return;

  // Limpar minimapa
  minimapCtx.fillStyle = '#1a1a1a';
  minimapCtx.fillRect(0, 0, minimapCanvas.width, minimapCanvas.height);

  const scaleX = minimapCanvas.width / state.worldSize.width;
  const scaleY = minimapCanvas.height / state.worldSize.height;

  // Desenhar jogadores
  if (state.players) {
    state.players.forEach(player => {
      player.cells.forEach(cell => {
        const x = cell.x * scaleX;
        const y = cell.y * scaleY;
        const radius = Math.max(2, cell.radius * scaleX);

        minimapCtx.fillStyle = cell.color;
        minimapCtx.beginPath();
        minimapCtx.arc(x, y, radius, 0, Math.PI * 2);
        minimapCtx.fill();

        // Destacar jogador atual
        if (player.id === playerId) {
          minimapCtx.strokeStyle = '#00FF41';
          minimapCtx.lineWidth = 2;
          minimapCtx.stroke();
        }
      });
    });
  }

  // Desenhar viewport (área visível)
  if (playerId) {
    const viewWidth = (canvas.width / camera.zoom) * scaleX;
    const viewHeight = (canvas.height / camera.zoom) * scaleY;
    const viewX = camera.x * scaleX - viewWidth / 2;
    const viewY = camera.y * scaleY - viewHeight / 2;

    minimapCtx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    minimapCtx.lineWidth = 1;
    minimapCtx.strokeRect(viewX, viewY, viewWidth, viewHeight);
  }
}

// ============= CHAT =============
function setupChatHandlers() {
  // Enviar mensagem com Enter
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendChatMessage();
    }
  });

  // Enviar mensagem com botão
  chatSend.addEventListener('click', () => {
    sendChatMessage();
  });
}

function sendChatMessage() {
  const message = chatInput.value.trim();
  if (message && socket) {
    socket.emit('chat', { message });
    chatInput.value = '';
  }
}

function addChatMessage(name, message, isSystem = false, isOwn = false) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'chat-message';

  if (isSystem) {
    messageDiv.classList.add('system');
    messageDiv.textContent = `• ${message}`;
  } else {
    if (isOwn) {
      messageDiv.classList.add('own');
    }
    const nameSpan = document.createElement('span');
    nameSpan.className = 'player-name';
    nameSpan.textContent = name + ':';
    messageDiv.appendChild(nameSpan);
    messageDiv.appendChild(document.createTextNode(message));
  }

  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  // Limitar mensagens (máximo 100)
  while (chatMessages.children.length > 100) {
    chatMessages.removeChild(chatMessages.firstChild);
  }
}

// Atualizar loop do jogo para incluir minimapa
const originalGameLoop = gameLoop;
function gameLoop() {
  if (gameState) {
    updateCamera();
    render();
    renderMinimap();
  }
  requestAnimationFrame(gameLoop);
}

// Iniciar o jogo
init();
