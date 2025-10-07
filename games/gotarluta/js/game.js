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
const player1Combo = document.getElementById('player1Combo');
const player1ComboText = document.getElementById('player1ComboText');
const player1ComboContainer = document.querySelector('.player-left .combo-bar-container');

const player2Avatar = document.getElementById('player2Avatar');
const player2Name = document.getElementById('player2Name');
const player2Health = document.getElementById('player2Health');
const player2HP = document.getElementById('player2HP');
const player2Rounds = document.getElementById('player2Rounds');
const player2Combo = document.getElementById('player2Combo');
const player2ComboText = document.getElementById('player2ComboText');
const player2ComboContainer = document.querySelector('.player-right .combo-bar-container');

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
let lastInputTime = 0;
let lastHorizontalKey = null; // Track which horizontal key was pressed last

// Particle effects
const particles = [];

// Note: HUD initialization moved to gameJoined event handler

// Input handling
window.addEventListener('keydown', (e) => {
  // Track which horizontal key was pressed last
  if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
    if (!keys[e.code]) { // Only update if this key wasn't already pressed
      lastHorizontalKey = e.code;
    }
  }
  
  keys[e.code] = true;
  updateInput();
});

window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
  
  // If the last horizontal key was released, check if the opposite is still pressed
  if (e.code === lastHorizontalKey) {
    if (e.code === 'ArrowLeft' && keys['ArrowRight']) {
      lastHorizontalKey = 'ArrowRight';
    } else if (e.code === 'ArrowRight' && keys['ArrowLeft']) {
      lastHorizontalKey = 'ArrowLeft';
    } else {
      lastHorizontalKey = null;
    }
  }
  
  updateInput();
});

function updateInput() {
  // Throttle input to 60 FPS (16ms) to avoid spam
  const now = Date.now();
  if (now - lastInputTime < 16) return;
  lastInputTime = now;
  
  // Handle horizontal movement with priority to last pressed key
  if (keys['ArrowLeft'] && keys['ArrowRight']) {
    // Both keys pressed - use the last one pressed
    input.left = lastHorizontalKey === 'ArrowLeft';
    input.right = lastHorizontalKey === 'ArrowRight';
  } else {
    // Normal case - only one or neither key pressed
    input.left = keys['ArrowLeft'] || false;
    input.right = keys['ArrowRight'] || false;
  }
  
  // Other inputs
  input.up = keys['ArrowUp'] || false;
  input.down = keys['ArrowDown'] || false;
  input.punch = keys['KeyA'] || false;
  input.kick = keys['KeyS'] || false;
  input.block = keys['ArrowDown'] || false;
  input.special = keys['Space'] || false;
  
  // Log input when any key is pressed (throttled)
  if (!window.lastInputDebug || now - window.lastInputDebug > 2000) {
    const hasInput = Object.values(input).some(v => v === true);
    if (hasInput) {
      console.log('🎮 ========== SENDING INPUT ==========');
      console.log('My socket ID:', socket.id.substring(0, 8) + '...');
      if (myFighter) {
        console.log('I am controlling:', myFighter.name, '(pos', myFighter.position + ')');
        console.log('My position:', Math.round(myFighter.x));
      } else {
        console.log('⚠️ myFighter not yet loaded');
      }
      console.log('Input:', input);
      console.log('=====================================');
      window.lastInputDebug = now;
    }
  }
  
  // Send input to server
  socket.emit('fight:input', input);
}

// Socket.IO event handlers

socket.on('connect', () => {
  console.log('✅ Connected to fight server, socket.id:', socket.id);
  socket.emit('identifyGame', 'gotarluta'); // Identify this client as playing gotarluta
  myPlayerId = socket.id;
  
  // Figure out which player I was in the lobby by comparing with localStorage
  const player1Data = matchData.players.player1;
  const player2Data = matchData.players.player2;
  
  // Find my old player data by checking localStorage for my player info
  // We need to send the OLD socket ID so server knows which fighter to update
  let myOldSocketId = null;
  
  // Try to determine from localStorage which player we are
  const storedPlayerName = localStorage.getItem('playerName');
  const storedPlayerAvatar = localStorage.getItem('playerAvatar');
  
  console.log('🔍 Identifying myself:');
  console.log('  Stored name:', storedPlayerName);
  console.log('  Stored avatar:', storedPlayerAvatar);
  console.log('  Player 1:', player1Data.name, player1Data.avatar);
  console.log('  Player 2:', player2Data.name, player2Data.avatar);
  
  // Match by name and avatar
  if (player1Data.name === storedPlayerName && player1Data.avatar === storedPlayerAvatar) {
    myOldSocketId = player1Data.id;
    console.log('→ I am Player 1 (OLD ID:', player1Data.id.substring(0, 8) + ')');
  } else if (player2Data.name === storedPlayerName && player2Data.avatar === storedPlayerAvatar) {
    myOldSocketId = player2Data.id;
    console.log('→ I am Player 2 (OLD ID:', player2Data.id.substring(0, 8) + ')');
  } else {
    console.error('❌ Cannot identify which player I am!');
  }
  
  // Inform server about joining the fight game with OLD ID
  socket.emit('fight:joinGame', {
    roomId: matchData.roomId,
    oldPlayerId: myOldSocketId
  });
  
  console.log('📤 Sent joinGame with oldPlayerId:', myOldSocketId ? myOldSocketId.substring(0, 8) + '...' : 'null');
});

socket.on('gameJoined', (data) => {
  console.log('==========================================');
  console.log('✅ GAME JOINED - Server says I am Player', data.playerNumber);
  console.log('   My socket ID:', socket.id);
  console.log('   Room ID:', data.roomId);
  console.log('==========================================');
  
  // Update myPlayerId to match server's assignment
  myPlayerId = socket.id;
  
  // Determine MY data and opponent data from match data
  const player1Data = matchData.players.player1;
  const player2Data = matchData.players.player2;
  
  console.log('📋 Original match data (OLD IDs from lobby):');
  console.log('  Player 1:', player1Data.name, '(OLD ID:', player1Data.id.substring(0, 8) + '...)');
  console.log('  Player 2:', player2Data.name, '(OLD ID:', player2Data.id.substring(0, 8) + '...)');
  console.log('📋 My NEW socket ID:', socket.id.substring(0, 8) + '...');
  
  let myData, oppData;
  
  if (data.playerNumber === 1) {
    // I am Player 1 (position 0) - started as player1 in lobby
    myData = player1Data;
    oppData = player2Data;
    console.log('→ I am Player 1 (position 0, LEFT side on HUD)');
    console.log('→ My name:', myData.name);
    console.log('→ Opponent name:', oppData.name);
  } else {
    // I am Player 2 (position 1) - started as player2 in lobby
    myData = player2Data;
    oppData = player1Data;
    console.log('→ I am Player 2 (position 1, still LEFT side on MY HUD)');
    console.log('→ My name:', myData.name);
    console.log('→ Opponent name:', oppData.name);
  }
  
  // ALWAYS: Left side of HUD = ME, Right side = OPPONENT (regardless of position)
  player1Avatar.src = myData.avatar;
  player1Name.textContent = myData.name;
  player2Avatar.src = oppData.avatar;
  player2Name.textContent = oppData.name;
  
  console.log('🎨 HUD Setup:');
  console.log('  LEFT (ME):', myData.name);
  console.log('  RIGHT (OPP):', oppData.name);
  
  console.log('HUD will show:');
  console.log('  LEFT:', myData.name, '← ME');
  console.log('  RIGHT:', oppData.name, '← OPPONENT');
  console.log('==========================================');
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

  // Find my fighter and opponent - CRITICAL: Based on socket.id
  myFighter = fighters.find(f => f.id === socket.id);
  opponentFighter = fighters.find(f => f.id !== socket.id);

  // Log on first update to verify correct identification
  if (!window.fightersLogged && myFighter && opponentFighter) {
    console.log('👥 ========== FIGHTERS IDENTIFIED IN GAMEUPDATE ==========');
    console.log('My CURRENT Socket ID:', socket.id.substring(0, 8) + '...');
    console.log('Received fighters from server:');
    fighters.forEach(f => {
      console.log(`  - Fighter: ${f.name}, ID: ${f.id.substring(0, 8)}..., Position: ${f.position}, X: ${Math.round(f.x)}`);
    });
    
    console.log('\n🎯 MY FIGHTER (the one I should control):');
    console.log('  Socket ID matches:', myFighter.id.substring(0, 8) + '...');
    console.log('  Name:', myFighter.name);
    console.log('  Position:', myFighter.position);
    console.log('  X coordinate:', Math.round(myFighter.x));
    
    console.log('\n🎯 OPPONENT FIGHTER:');
    console.log('  Socket ID:', opponentFighter.id.substring(0, 8) + '...');
    console.log('  Name:', opponentFighter.name);
    console.log('  Position:', opponentFighter.position);
    console.log('  X coordinate:', Math.round(opponentFighter.x));
    
    console.log('\n📋 COMPARISON WITH LOCALSTORAGE:');
    console.log('  My stored name:', localStorage.getItem('playerName'));
    console.log('  Does MY FIGHTER name match?', myFighter.name === localStorage.getItem('playerName'));
    console.log('==========================================');
    window.fightersLogged = true;
  }

  // Sanity check: Verify myFighter is actually mine
  if (myFighter && myFighter.id !== socket.id) {
    console.error('❌ ERROR: myFighter has wrong ID!', {
      expected: socket.id.substring(0, 8),
      got: myFighter.id.substring(0, 8)
    });
  }
  
  // Log if can't find my fighter
  if (!myFighter) {
    if (!window.missingFighterLogged) {
      console.error('❌ ERROR: Cannot find MY fighter!', {
        mySocketId: socket.id.substring(0, 8),
        availableFighters: fighters.map(f => f.id.substring(0, 8))
      });
      window.missingFighterLogged = true;
    }
  }

  // Update HUD with correct fighter data
  updateHUD();
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

// Update HUD - ALWAYS: Left = ME, Right = OPPONENT
function updateHUD() {
  if (!myFighter || !opponentFighter) return;

  // Debug log once per second to verify correct data
  if (!window.lastHudLog || Date.now() - window.lastHudLog > 2000) {
    console.log('🎨 HUD Update:', {
      'LEFT (ME)': {
        name: myFighter.name,
        health: Math.round(myFighter.health),
        combo: Math.round(myFighter.comboMeter || 0),
        socketId: myFighter.id
      },
      'RIGHT (OPP)': {
        name: opponentFighter.name,
        health: Math.round(opponentFighter.health),
        combo: Math.round(opponentFighter.comboMeter || 0),
        socketId: opponentFighter.id
      },
      'My Socket': socket.id
    });
    window.lastHudLog = Date.now();
  }

  // LEFT SIDE = MY FIGHTER (ALWAYS)
  const myHealthPercent = (myFighter.health / myFighter.maxHealth) * 100;
  player1Health.style.width = `${myHealthPercent}%`;
  player1HP.textContent = `${Math.round(myFighter.health)} HP`;

  const myComboMeter = myFighter.comboMeter !== undefined ? myFighter.comboMeter : 0;
  const myMaxCombo = myFighter.maxComboMeter !== undefined ? myFighter.maxComboMeter : 100;
  const myComboPercent = (myComboMeter / myMaxCombo) * 100;
  
  player1Combo.style.width = `${myComboPercent}%`;
  player1ComboText.textContent = `Especial: ${Math.round(myComboPercent)}%`;
  
  if (myComboPercent >= 100) {
    player1ComboContainer.classList.add('ready');
    player1ComboText.textContent = 'ESPECIAL PRONTO!';
  } else {
    player1ComboContainer.classList.remove('ready');
  }

  player1Rounds.textContent = roundsWon[socket.id] || 0;

  // RIGHT SIDE = OPPONENT FIGHTER (ALWAYS)
  const oppHealthPercent = (opponentFighter.health / opponentFighter.maxHealth) * 100;
  player2Health.style.width = `${oppHealthPercent}%`;
  player2HP.textContent = `${Math.round(opponentFighter.health)} HP`;

  const oppComboMeter = opponentFighter.comboMeter !== undefined ? opponentFighter.comboMeter : 0;
  const oppMaxCombo = opponentFighter.maxComboMeter !== undefined ? opponentFighter.maxComboMeter : 100;
  const oppComboPercent = (oppComboMeter / oppMaxCombo) * 100;
  
  player2Combo.style.width = `${oppComboPercent}%`;
  player2ComboText.textContent = `Especial: ${Math.round(oppComboPercent)}%`;
  
  if (oppComboPercent >= 100) {
    player2ComboContainer.classList.add('ready');
    player2ComboText.textContent = 'ESPECIAL PRONTO!';
  } else {
    player2ComboContainer.classList.remove('ready');
  }

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
    const isMe = fighter.id === socket.id;
    ctx.strokeStyle = isMe ? '#00ff00' : '#ff0000';
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

