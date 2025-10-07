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

// Backgrounds animados
let backgroundImages = [];
let currentBackgroundIndex = 0;
let lastBackgroundChange = Date.now();
const BACKGROUND_CHANGE_INTERVAL = 5000; // 5 segundos

// Carregar backgrounds (sincronizado com background.js)
async function loadBackgrounds() {
  const backgrounds = [
    '/backgrounds/background1.png'
  ];

  for (const bgPath of backgrounds) {
    try {
      const response = await fetch(bgPath, { method: 'HEAD' });
      if (response.ok) {
        const img = new Image();
        img.src = bgPath;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
        backgroundImages.push(img);
      }
    } catch (e) {
      // Imagem não existe, continuar
    }
  }

  if (backgroundImages.length > 0) {
    console.log(`🎨 ${backgroundImages.length} background(s) carregado(s) para o jogo!`);
  }
}

// Conectar ao servidor
function init() {
  // Carregar backgrounds primeiro
  loadBackgrounds();

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

  // Jogador morreu
  socket.on('playerDied', (data) => {
    showDeathScreen(data.killer, data.killerScore);
  });

  // Chat
  socket.on('chat', (data) => {
    addChatMessage(data.name, data.message, false, data.id === playerId);
  });

  // Projétil disparado
  socket.on('projectileFired', (data) => {
    // Som ou feedback visual (opcional)
    console.log(`${data.playerName} atirou um projétil!`);
  });

  // Jogador explodido
  socket.on('playerExploded', (data) => {
    // Criar efeito visual de explosão
    createExplosionEffect(data.x, data.y);

    if (data.victimId === playerId) {
      // Você foi explodido!
      showNotification('💥 Você foi EXPLODIDO!', 'danger');
    } else if (data.shooterId === playerId) {
      // Você explodiu alguém!
      showNotification('💥 EXPLOSÃO! Você acertou ' + data.victimName, 'success');
    }
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
    } else if (e.code === 'KeyE') {
      e.preventDefault();
      socket.emit('shoot');
    }
  });

  // Clique direito também atira
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    socket.emit('shoot');
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
    updateAndDrawExplosions(); // Desenhar explosões por cima
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
  // Limpar canvas com cor de fundo escura
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (!gameState) return;

  // Usar estado interpolado para renderização suave
  const state = getInterpolatedState();

  ctx.save();

  // Aplicar transformação da câmera
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);

  // Desenhar background animado
  drawBackground();

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

  // Desenhar projéteis
  if (state.projectiles) {
    state.projectiles.forEach(projectile => {
      drawProjectile(projectile);
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

// Desenhar background animado
function drawBackground() {
  if (backgroundImages.length === 0) return;

  // Alternar background a cada 5 segundos
  const now = Date.now();
  if (now - lastBackgroundChange > BACKGROUND_CHANGE_INTERVAL) {
    currentBackgroundIndex = (currentBackgroundIndex + 1) % backgroundImages.length;
    lastBackgroundChange = now;
  }

  const bgImg = backgroundImages[currentBackgroundIndex];
  if (!bgImg) return;

  // Calcular dimensões para cobrir o mundo do jogo
  const worldWidth = gameState.worldSize ? gameState.worldSize.width : 3000;
  const worldHeight = gameState.worldSize ? gameState.worldSize.height : 3000;

  // Desenhar background cobrindo todo o mundo
  ctx.globalAlpha = 0.4; // Semi-transparente mas bem visível
  ctx.drawImage(bgImg, 0, 0, worldWidth, worldHeight);
  ctx.globalAlpha = 1.0;

  // Overlay escuro para melhor contraste e visibilidade das células
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(0, 0, worldWidth, worldHeight);
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

// Desenhar projétil (tiro explosivo)
function drawProjectile(projectile) {
  // Núcleo vermelho brilhante
  ctx.shadowColor = '#ff0000';
  ctx.shadowBlur = 20 / camera.zoom;
  ctx.fillStyle = '#ff0000';
  ctx.beginPath();
  ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
  ctx.fill();

  // Anel externo amarelo
  ctx.shadowColor = '#ffff00';
  ctx.shadowBlur = 15 / camera.zoom;
  ctx.strokeStyle = '#ffaa00';
  ctx.lineWidth = 3 / camera.zoom;
  ctx.beginPath();
  ctx.arc(projectile.x, projectile.y, projectile.radius + 3, 0, Math.PI * 2);
  ctx.stroke();

  // Brilho branco no centro
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.beginPath();
  ctx.arc(projectile.x, projectile.y, projectile.radius / 2, 0, Math.PI * 2);
  ctx.fill();

  // Resetar sombra
  ctx.shadowColor = 'transparent';
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

    // Detectar mensagens de kill (eliminações)
    if (message.includes('eliminou') || message.includes('💀')) {
      messageDiv.classList.add('kill');
    }

    // Detectar mensagens de explosão
    if (message.includes('explodiu') || message.includes('💥')) {
      messageDiv.classList.add('explosion');
    }

    messageDiv.textContent = message.startsWith('•') ? message : `• ${message}`;
  } else {
    if (isOwn) {
      messageDiv.classList.add('own');
    }
    const nameSpan = document.createElement('span');
    nameSpan.className = 'player-name';
    nameSpan.textContent = name + ':';
    messageDiv.appendChild(nameSpan);
    messageDiv.appendChild(document.createTextNode(' ' + message));
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

// ============= NOTIFICAÇÕES =============
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 100px;
    left: 50%;
    transform: translateX(-50%);
    padding: 20px 40px;
    border-radius: 10px;
    font-size: 24px;
    font-weight: bold;
    color: white;
    z-index: 10000;
    animation: slideDown 0.3s ease-out;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  `;

  if (type === 'danger') {
    notification.style.background = 'linear-gradient(135deg, #ff4444 0%, #cc0000 100%)';
  } else if (type === 'success') {
    notification.style.background = 'linear-gradient(135deg, #00ff88 0%, #00cc44 100%)';
  } else {
    notification.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  }

  notification.textContent = message;
  document.body.appendChild(notification);

  // Adicionar animação
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideDown {
      from {
        top: -100px;
        opacity: 0;
      }
      to {
        top: 100px;
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);

  // Remover após 3 segundos
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.top = '-100px';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// ============= EFEITO DE EXPLOSÃO =============
let explosions = [];

function createExplosionEffect(x, y) {
  const explosion = {
    x: x,
    y: y,
    particles: [],
    createdAt: Date.now()
  };

  // Criar 20 partículas em todas as direções
  for (let i = 0; i < 20; i++) {
    const angle = (Math.PI * 2 / 20) * i;
    const speed = 10 + Math.random() * 10;

    explosion.particles.push({
      x: x,
      y: y,
      speedX: Math.cos(angle) * speed,
      speedY: Math.sin(angle) * speed,
      size: 5 + Math.random() * 5,
      color: ['#ff0000', '#ff6600', '#ffaa00', '#ffff00'][Math.floor(Math.random() * 4)],
      life: 1.0
    });
  }

  explosions.push(explosion);
}

function updateAndDrawExplosions() {
  const now = Date.now();

  explosions = explosions.filter(explosion => {
    const age = now - explosion.createdAt;
    if (age > 1000) return false; // Remover após 1 segundo

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    explosion.particles.forEach(particle => {
      // Atualizar partícula
      particle.x += particle.speedX;
      particle.y += particle.speedY;
      particle.speedX *= 0.95; // Fricção
      particle.speedY *= 0.95;
      particle.life -= 0.02;

      if (particle.life > 0) {
        // Desenhar partícula
        ctx.globalAlpha = particle.life;
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    ctx.globalAlpha = 1.0;
    ctx.restore();

    return true;
  });
}

// ============= TELA DE MORTE =============
function showDeathScreen(killerName, killerScore) {
  // Criar overlay de morte
  const deathOverlay = document.createElement('div');
  deathOverlay.id = 'deathOverlay';
  deathOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    animation: fadeIn 0.3s ease-in;
  `;

  deathOverlay.innerHTML = `
    <div style="text-align: center; color: white; font-family: Arial, sans-serif;">
      <div style="font-size: 72px; margin-bottom: 20px; animation: pulse 1s infinite;">💀</div>
      <h1 style="font-size: 48px; margin: 0 0 20px 0; color: #ff4444;">Você Morreu!</h1>
      <p style="font-size: 24px; margin: 10px 0; color: #ffaa00;">
        Eliminado por: <strong style="color: #00ff88;">${killerName}</strong>
      </p>
      <p style="font-size: 18px; margin: 5px 0; color: #aaa;">
        Score do assassino: ${killerScore}
      </p>
      <p style="font-size: 18px; margin: 20px 0 30px 0; color: #aaa;">
        Seu score final: <strong style="color: white;">${document.getElementById('playerScore').textContent}</strong>
      </p>
      <button onclick="window.location.href='/'" style="
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 15px 40px;
        font-size: 20px;
        border-radius: 50px;
        cursor: pointer;
        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        transition: transform 0.2s, box-shadow 0.2s;
        margin: 5px;
      " onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 6px 20px rgba(102, 126, 234, 0.6)'"
         onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 4px 15px rgba(102, 126, 234, 0.4)'">
        ⟲ Jogar Novamente
      </button>
    </div>
  `;

  // Adicionar animação CSS
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(deathOverlay);
}

// Iniciar o jogo
init();
