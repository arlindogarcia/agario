// Server URL
const SERVER_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : `https://${window.location.hostname}`;

// Connect to Socket.IO
const socket = io(SERVER_URL, {
  transports: ['websocket', 'polling']
});

// Get match data from localStorage
const matchDataString = localStorage.getItem('fightMatchData');
if (!matchDataString) {
  console.error('❌ Match data not found in localStorage');
  alert('Erro: Dados da partida não encontrados');
  window.location.href = 'index.html';
}

console.log('📦 Match data from localStorage:', matchDataString);
const matchData = JSON.parse(matchDataString);
console.log('✅ Parsed match data:', matchData);

let myPlayerId = null;
let opponentId = null;

// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Set canvas size
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// HUD Elements
const player1Avatar = document.getElementById('player1Avatar');
const player1Name = document.getElementById('player1Name');
const player1Health = document.getElementById('player1Health');
const player1HP = document.getElementById('player1HP');
const player1Rounds = document.getElementById('player1Rounds');

const player2Avatar = document.getElementById('player2Avatar');
const player2Name = document.getElementById('player2Name');
const player2Health = document.getElementById('player2Health');
const player2HP = document.getElementById('player2HP');
const player2Rounds = document.getElementById('player2Rounds');

const roundInfo = document.getElementById('roundInfo');
const countdown = document.getElementById('countdown');
const roundResult = document.getElementById('roundResult');

const gameOverScreen = document.getElementById('gameOverScreen');
const gameOverTitle = document.getElementById('gameOverTitle');
const gameOverText = document.getElementById('gameOverText');
const btnRematch = document.getElementById('btnRematch');
const btnBackToLobby = document.getElementById('btnBackToLobby');

// Game state
let fighters = [];
let myFighter = null;
let opponentFighter = null;
let currentRound = 1;
let roundsWon = {};

// Input state
const keys = {};
const input = {
  left: false,
  right: false,
  up: false,
  down: false,
  punch: false,
  kick: false,
  block: false,
  special: false
};

// Particle effects
const particles = [];

// Note: HUD initialization moved to gameJoined event handler

// Input handling
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  updateInput();
});

window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
  updateInput();
});

function updateInput() {
  const newInput = {
    left: keys['ArrowLeft'] || false,
    right: keys['ArrowRight'] || false,
    up: keys['ArrowUp'] || false,
    down: keys['ArrowDown'] || false,
    punch: keys['KeyA'] || false,
    kick: keys['KeyS'] || false,
    block: keys['ArrowDown'] || false,
    special: keys['Space'] || false
  };

  // Only send if input changed
  if (JSON.stringify(newInput) !== JSON.stringify(input)) {
    Object.assign(input, newInput);
    socket.emit('fight:input', input);
  }
}

// Socket.IO event handlers

socket.on('connect', () => {
  console.log('✅ Connected to fight server, socket.id:', socket.id);
  myPlayerId = socket.id;
  
  // Inform server about joining the fight game with room data
  socket.emit('fight:joinGame', {
    roomId: matchData.roomId,
    oldPlayerId: null // Will be determined by server based on available spot
  });
});

socket.on('gameJoined', (data) => {
  console.log('✅ Game joined successfully:', data);
  
  // Update myPlayerId to match server's assignment
  myPlayerId = socket.id;
  
  // Determine opponent ID from match data
  const player1 = matchData.players.player1;
  const player2 = matchData.players.player2;
  
  if (data.playerNumber === 1) {
    opponentId = player2.id;
    console.log('✅ I am Player 1');
    player1Avatar.src = player1.avatar;
    player1Name.textContent = player1.name;
    player2Avatar.src = player2.avatar;
    player2Name.textContent = player2.name;
  } else {
    opponentId = player1.id;
    console.log('✅ I am Player 2');
    player1Avatar.src = player2.avatar;
    player1Name.textContent = player2.name;
    player2Avatar.src = player1.avatar;
    player2Name.textContent = player1.name;
  }
  
  console.log('✅ HUD initialized');
});

socket.on('countdown', (data) => {
  console.log('⏱️ Countdown:', data.count);
  countdown.style.display = 'block';
  countdown.textContent = data.count;

  if (data.count === 0) {
    countdown.textContent = 'FIGHT!';
    setTimeout(() => {
      countdown.style.display = 'none';
    }, 500);
  }
});

socket.on('roundStart', (data) => {
  currentRound = data.round;
  roundInfo.textContent = `Round ${currentRound}`;
  roundResult.style.display = 'none';
});

socket.on('gameUpdate', (data) => {
  fighters = data.fighters;
  currentRound = data.currentRound;
  roundsWon = data.roundsWon;

  if (!myFighter) {
    console.log('🎮 First game update received:', data);
  }

  // Update HUD
  updateHUD();

  // Find my fighter and opponent
  myFighter = fighters.find(f => f.id === socket.id);
  opponentFighter = fighters.find(f => f.id !== socket.id);

  if (myFighter && opponentFighter && fighters.length > 0) {
    // Log once when both fighters are found
    if (!window.fightersLogged) {
      console.log('👥 Fighters found:', {
        myFighter: myFighter.name,
        opponentFighter: opponentFighter.name,
        totalFighters: fighters.length
      });
      window.fightersLogged = true;
    }
  }
});

socket.on('hit', (data) => {
  // Create hit effect
  const victim = fighters.find(f => f.id === data.victimId);
  if (victim) {
    createHitEffect(victim.x, victim.y - 40, data.blocked);
  }

  // Screen shake for heavy hits
  if (data.damage > 10 && data.victimId === socket.id) {
    screenShake(10);
  }
});

socket.on('roundEnd', (data) => {
  roundsWon = data.roundsWon;

  // Show round result
  roundResult.style.display = 'block';
  if (data.winnerId === socket.id) {
    roundResult.textContent = 'VOCÊ VENCEU O ROUND!';
    roundResult.style.color = '#00ff00';
  } else {
    roundResult.textContent = 'VOCÊ PERDEU O ROUND';
    roundResult.style.color = '#ff0000';
  }

  // Update round score
  updateHUD();

  // Hide after 2 seconds if not match over
  if (!data.matchOver) {
    setTimeout(() => {
      roundResult.style.display = 'none';
    }, 2000);
  }
});

socket.on('matchOver', (data) => {
  // Show game over screen
  gameOverScreen.style.display = 'flex';

  if (data.winnerId === socket.id) {
    gameOverTitle.textContent = '🏆 VITÓRIA! 🏆';
    gameOverText.textContent = 'Você venceu a partida!';
  } else {
    gameOverTitle.textContent = '💀 DERROTA 💀';
    gameOverText.textContent = 'Você perdeu a partida.';
  }
});

socket.on('opponentDisconnected', () => {
  alert('Oponente desconectou');
  window.location.href = 'index.html';
});

// Update HUD
function updateHUD() {
  if (!myFighter || !opponentFighter) return;

  // Health bars
  const myHealthPercent = (myFighter.health / myFighter.maxHealth) * 100;
  const oppHealthPercent = (opponentFighter.health / opponentFighter.maxHealth) * 100;

  player1Health.style.width = `${myHealthPercent}%`;
  player1HP.textContent = `${Math.round(myFighter.health)} HP`;

  player2Health.style.width = `${oppHealthPercent}%`;
  player2HP.textContent = `${Math.round(opponentFighter.health)} HP`;

  // Rounds won
  player1Rounds.textContent = roundsWon[socket.id] || 0;
  player2Rounds.textContent = roundsWon[opponentId] || 0;
}

// Game loop
function gameLoop() {
  // Clear canvas (transparent to show background)
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw arena
  drawArena();

  // Draw fighters
  if (fighters.length > 0) {
    fighters.forEach(fighter => {
      drawFighter(fighter);
    });
  } else {
    // Show waiting message
    ctx.fillStyle = '#ffffff';
    ctx.font = '30px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Aguardando dados do jogo...', canvas.width / 2, canvas.height / 2);
  }

  // Draw particles
  updateParticles();

  requestAnimationFrame(gameLoop);
}

// Draw arena
function drawArena() {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const groundY = centerY + 150;

  // Ground with gradient
  const groundGradient = ctx.createLinearGradient(0, groundY, 0, canvas.height);
  groundGradient.addColorStop(0, 'rgba(50, 50, 80, 0.8)');
  groundGradient.addColorStop(1, 'rgba(20, 20, 40, 0.9)');
  ctx.fillStyle = groundGradient;
  ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);

  // Ground line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(canvas.width, groundY);
  ctx.stroke();

  // Center line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 10]);
  ctx.beginPath();
  ctx.moveTo(centerX, 0);
  ctx.lineTo(centerX, canvas.height);
  ctx.stroke();
  ctx.setLineDash([]);

  // Arena bounds indicators
  ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
  ctx.lineWidth = 2;
  ctx.strokeRect(50, 50, canvas.width - 100, groundY - 50);
}

// Draw fighter (using renderer)
function drawFighter(fighter) {
  if (!fighter) {
    console.log('⚠️ Cannot draw fighter: fighter is null');
    return;
  }

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  // Convert game coordinates to screen coordinates
  const screenX = centerX + (fighter.x - 500);
  const screenY = centerY + (fighter.y - 400);

  // Draw using renderer
  if (typeof Renderer !== 'undefined') {
    Renderer.drawFighter(ctx, fighter, screenX, screenY);
  } else {
    // Fallback: draw a simple stickman
    ctx.save();
    ctx.strokeStyle = fighter.id === socket.id ? '#00ff00' : '#ff0000';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    // Head
    ctx.beginPath();
    ctx.arc(screenX, screenY - 60, 15, 0, Math.PI * 2);
    ctx.stroke();

    // Body
    ctx.beginPath();
    ctx.moveTo(screenX, screenY - 45);
    ctx.lineTo(screenX, screenY - 10);
    ctx.stroke();

    // Arms
    ctx.beginPath();
    ctx.moveTo(screenX, screenY - 35);
    ctx.lineTo(screenX - 20, screenY - 20);
    ctx.moveTo(screenX, screenY - 35);
    ctx.lineTo(screenX + 20, screenY - 20);
    ctx.stroke();

    // Legs
    ctx.beginPath();
    ctx.moveTo(screenX, screenY - 10);
    ctx.lineTo(screenX - 15, screenY + 20);
    ctx.moveTo(screenX, screenY - 10);
    ctx.lineTo(screenX + 15, screenY + 20);
    ctx.stroke();

    // Name
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(fighter.name || 'Player', screenX, screenY - 80);

    ctx.restore();
  }
}

// Particle effects
function createHitEffect(x, y, blocked) {
  const color = blocked ? '#ffaa00' : '#ff0000';
  const count = blocked ? 5 : 10;

  for (let i = 0; i < count; i++) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 10,
      vy: (Math.random() - 0.5) * 10,
      life: 1,
      color
    });
  }
}

function updateParticles() {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];

    // Update
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 0.02;

    // Convert to screen coords
    const screenX = centerX + (p.x - 500);
    const screenY = centerY + (p.y - 400);

    // Draw
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.life;
    ctx.fillRect(screenX, screenY, 4, 4);
    ctx.globalAlpha = 1;

    // Remove if dead
    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

// Screen shake
let shakeAmount = 0;
function screenShake(amount) {
  shakeAmount = amount;
  const shakeInterval = setInterval(() => {
    canvas.style.transform = `translate(${(Math.random() - 0.5) * shakeAmount}px, ${(Math.random() - 0.5) * shakeAmount}px)`;
    shakeAmount *= 0.9;

    if (shakeAmount < 0.5) {
      clearInterval(shakeInterval);
      canvas.style.transform = 'translate(0, 0)';
    }
  }, 50);
}

// Button handlers
btnRematch.addEventListener('click', () => {
  socket.disconnect();
  window.location.href = 'index.html';
});

btnBackToLobby.addEventListener('click', () => {
  socket.disconnect();
  window.location.href = 'index.html';
});

// Back button during game
const btnBackGame = document.getElementById('btnBackGame');
if (btnBackGame) {
  btnBackGame.addEventListener('click', (e) => {
    e.preventDefault();
    const confirmExit = confirm('Tem certeza que deseja sair da partida?');
    if (confirmExit) {
      socket.disconnect();
      window.location.href = 'index.html';
    }
  });
}

// Check if Renderer is loaded
if (typeof Renderer !== 'undefined') {
  console.log('✅ Renderer loaded successfully');
} else {
  console.error('❌ Renderer not loaded! Check if renderer.js is included');
}

// Start game loop
console.log('🎮 Starting game loop...');
gameLoop();

