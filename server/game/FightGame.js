const Fighter = require('../entities/Fighter');

class FightGame {
  constructor() {
    this.io = null;
    this.matchmakingQueue = []; // Players waiting for a match
    this.rooms = new Map(); // Active game rooms
    this.roomIdCounter = 0;
  }

  setIO(io) {
    this.io = io;
  }

  // Add player to matchmaking queue
  joinQueue(socketId, playerData) {
    // Check if already in queue
    if (this.matchmakingQueue.find(p => p.socketId === socketId)) {
      console.log(`Player ${playerData.name} already in queue, skipping`);
      return;
    }

    // Add to queue
    this.matchmakingQueue.push({
      socketId,
      name: playerData.name,
      avatar: playerData.avatar,
      joinTime: Date.now()
    });

    console.log(`✅ Player ${playerData.name} (${socketId}) joined matchmaking queue`);
    console.log(`📊 Queue size: ${this.matchmakingQueue.length}`);

    // Try to make a match
    this.tryMatchmaking();

    // Broadcast queue size to all waiting players
    this.broadcastQueueStatus();
  }

  // Remove player from queue
  leaveQueue(socketId) {
    const index = this.matchmakingQueue.findIndex(p => p.socketId === socketId);
    if (index > -1) {
      const player = this.matchmakingQueue[index];
      this.matchmakingQueue.splice(index, 1);
      console.log(`Player ${player.name} left matchmaking queue`);
      this.broadcastQueueStatus();
    }
  }

  // Try to match players
  tryMatchmaking() {
    console.log(`🔍 Trying matchmaking... Queue size: ${this.matchmakingQueue.length}`);

    if (this.matchmakingQueue.length < 2) {
      console.log('❌ Not enough players for match (need 2)');
      return;
    }

    // Take first two players from queue
    const player1Data = this.matchmakingQueue.shift();
    const player2Data = this.matchmakingQueue.shift();

    console.log(`🎮 Creating match: ${player1Data.name} vs ${player2Data.name}`);

    // Create a new game room
    this.createRoom(player1Data, player2Data);

    // Broadcast updated queue status
    this.broadcastQueueStatus();
  }

  // Create a game room for two players
  createRoom(player1Data, player2Data) {
    const roomId = `room-${this.roomIdCounter++}`;

    console.log(`🏟️  Creating room ${roomId}...`);

    // Create fighters
    const fighter1 = new Fighter(player1Data.socketId, player1Data.name, player1Data.avatar, 0);
    const fighter2 = new Fighter(player2Data.socketId, player2Data.name, player2Data.avatar, 1);

    // Create room
    const room = {
      id: roomId,
      fighters: {
        [player1Data.socketId]: fighter1,
        [player2Data.socketId]: fighter2
      },
      currentRound: 1,
      maxRounds: 3,
      roundsWon: {
        [player1Data.socketId]: 0,
        [player2Data.socketId]: 0
      },
      roundState: 'countdown', // countdown, fighting, roundOver, matchOver
      roundTimer: 3000, // Countdown from 3
      roundStartTime: Date.now(),
      winner: null
    };

    this.rooms.set(roomId, room);

    // Notify both players that match was found
    if (this.io) {
      const player1Socket = this.io.sockets.sockets.get(player1Data.socketId);
      const player2Socket = this.io.sockets.sockets.get(player2Data.socketId);

      console.log(`🔌 Player 1 socket exists: ${!!player1Socket}`);
      console.log(`🔌 Player 2 socket exists: ${!!player2Socket}`);

      if (player1Socket && player2Socket) {
        // Join both players to the room
        player1Socket.join(roomId);
        player2Socket.join(roomId);

        console.log(`✅ Both players joined room ${roomId}`);

        // Send match found event
        const matchData = {
          roomId,
          players: {
            player1: {
              id: player1Data.socketId,
              name: player1Data.name,
              avatar: player1Data.avatar
            },
            player2: {
              id: player2Data.socketId,
              name: player2Data.name,
              avatar: player2Data.avatar
            }
          }
        };

        console.log(`📤 Emitting matchFound event:`, matchData);

        this.io.to(roomId).emit('matchFound', matchData);

        console.log(`🎮 Match created: ${roomId} - ${player1Data.name} vs ${player2Data.name}`);
      } else {
        console.error(`❌ Could not find sockets for players!`);
        this.rooms.delete(roomId);
      }
    } else {
      console.error(`❌ Socket.IO not initialized!`);
    }

    // Start countdown
    this.startCountdown(roomId);
  }

  // Start countdown before round
  startCountdown(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.roundState = 'countdown';
    room.roundTimer = 3000;

    const countdownInterval = setInterval(() => {
      room.roundTimer -= 1000;

      if (this.io) {
        this.io.to(roomId).emit('countdown', {
          count: Math.ceil(room.roundTimer / 1000)
        });
      }

      if (room.roundTimer <= 0) {
        clearInterval(countdownInterval);
        this.startRound(roomId);
      }
    }, 1000);
  }

  // Start the round
  startRound(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.roundState = 'fighting';
    room.roundStartTime = Date.now();

    if (this.io) {
      this.io.to(roomId).emit('roundStart', {
        round: room.currentRound
      });
    }

    console.log(`Round ${room.currentRound} started in ${roomId}`);
  }

  // Update a specific room
  updateRoom(roomId, deltaTime = 16) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    // Only update physics during fighting
    if (room.roundState === 'fighting') {
      // Update both fighters
      Object.values(room.fighters).forEach(fighter => {
        fighter.update(deltaTime);
      });

      // Check for hits
      this.checkCollisions(room);

      // Check if round is over
      this.checkRoundEnd(room);
    }

    // Always send game state to both players (even during countdown)
    if (this.io) {
      const gameState = {
        fighters: Object.values(room.fighters).map(f => f.serialize()),
        currentRound: room.currentRound,
        roundsWon: room.roundsWon
      };

      // Log once per second
      if (!room.lastLogTime || Date.now() - room.lastLogTime > 1000) {
        console.log(`📡 Sending gameUpdate to room ${roomId}:`, {
          fighterCount: gameState.fighters.length,
          round: gameState.currentRound,
          state: room.roundState
        });
        room.lastLogTime = Date.now();
      }

      this.io.to(roomId).emit('gameUpdate', gameState);
    }
  }

  // Check for collisions between fighters
  checkCollisions(room) {
    const fighters = Object.values(room.fighters);
    const [fighter1, fighter2] = fighters;

    // Check if fighter1 hit fighter2
    const hitbox1 = fighter1.getHitbox();
    if (hitbox1) {
      const hurtbox2 = fighter2.getHurtbox();
      if (this.boxesCollide(hitbox1, hurtbox2)) {
        const blocked = fighter2.isBlocking && this.isFacingOpponent(fighter2, fighter1);
        const hit = fighter2.takeDamage(
          hitbox1.damage,
          hitbox1.knockback,
          hitbox1.stunTime,
          blocked
        );

        if (hit) {
          fighter1.comboMeter = Math.min(fighter1.maxComboMeter, fighter1.comboMeter + hitbox1.comboGain);

          // Notify clients of hit
          if (this.io) {
            this.io.to(room.id).emit('hit', {
              attackerId: fighter1.id,
              victimId: fighter2.id,
              damage: hitbox1.damage,
              blocked
            });
          }
        }

        fighter1.hitboxActive = false; // Prevent multiple hits from same attack
      }
    }

    // Check if fighter2 hit fighter1
    const hitbox2 = fighter2.getHitbox();
    if (hitbox2) {
      const hurtbox1 = fighter1.getHurtbox();
      if (this.boxesCollide(hitbox2, hurtbox1)) {
        const blocked = fighter1.isBlocking && this.isFacingOpponent(fighter1, fighter2);
        const hit = fighter1.takeDamage(
          hitbox2.damage,
          hitbox2.knockback,
          hitbox2.stunTime,
          blocked
        );

        if (hit) {
          fighter2.comboMeter = Math.min(fighter2.maxComboMeter, fighter2.comboMeter + hitbox2.comboGain);

          // Notify clients of hit
          if (this.io) {
            this.io.to(room.id).emit('hit', {
              attackerId: fighter2.id,
              victimId: fighter1.id,
              damage: hitbox2.damage,
              blocked
            });
          }
        }

        fighter2.hitboxActive = false;
      }
    }
  }

  // Check if two boxes collide
  boxesCollide(box1, box2) {
    return box1.x < box2.x + box2.width &&
           box1.x + box1.width > box2.x &&
           box1.y < box2.y + box2.height &&
           box1.y + box1.height > box2.y;
  }

  // Check if fighter is facing opponent
  isFacingOpponent(fighter, opponent) {
    if (fighter.facingRight && opponent.x > fighter.x) return true;
    if (!fighter.facingRight && opponent.x < fighter.x) return true;
    return false;
  }

  // Check if round ended
  checkRoundEnd(room) {
    const fighters = Object.values(room.fighters);
    const deadFighter = fighters.find(f => f.isDead);

    if (deadFighter) {
      this.endRound(room, deadFighter.id);
    }
  }

  // End the current round
  endRound(room, loserId) {
    room.roundState = 'roundOver';

    // Determine winner of this round
    const fighters = Object.values(room.fighters);
    const winner = fighters.find(f => f.id !== loserId);

    if (winner) {
      room.roundsWon[winner.id]++;
    }

    // Check if match is over (best of 3)
    const maxRoundsWon = Math.max(...Object.values(room.roundsWon));
    const matchOver = maxRoundsWon >= 2;

    if (this.io) {
      this.io.to(room.id).emit('roundEnd', {
        winnerId: winner ? winner.id : null,
        winnerName: winner ? winner.name : null,
        roundsWon: room.roundsWon,
        matchOver
      });
    }

    if (matchOver) {
      setTimeout(() => this.endMatch(room, winner.id), 3000);
    } else {
      // Start next round after 3 seconds
      setTimeout(() => {
        room.currentRound++;
        // Reset fighters for next round
        Object.values(room.fighters).forEach(f => f.reset());
        this.startCountdown(room.id);
      }, 3000);
    }
  }

  // End the match
  endMatch(room, winnerId) {
    room.roundState = 'matchOver';
    room.winner = winnerId;

    const winner = room.fighters[winnerId];

    if (this.io) {
      this.io.to(room.id).emit('matchOver', {
        winnerId,
        winnerName: winner ? winner.name : null,
        finalScore: room.roundsWon
      });
    }

    console.log(`Match over in ${room.id}: ${winner ? winner.name : 'Unknown'} wins!`);
  }

  // Handle player input
  updatePlayerInput(socketId, input) {
    // Find which room this player is in
    for (const [roomId, room] of this.rooms) {
      if (room.fighters[socketId]) {
        room.fighters[socketId].setInput(input);
        break;
      }
    }
  }

  // Handle player disconnect
  handleDisconnect(socketId) {
    // Remove from queue
    this.leaveQueue(socketId);

    // Find room with this player
    for (const [roomId, room] of this.rooms) {
      const oldSocketIds = Object.keys(room.fighters);
      
      if (oldSocketIds.includes(socketId)) {
        console.log(`⚠️ Player ${socketId} disconnected from room ${roomId}`);
        
        // Mark the disconnect time
        if (!room.disconnectTimers) {
          room.disconnectTimers = {};
        }
        
        room.disconnectTimers[socketId] = Date.now();
        
        // Give players 10 seconds to reconnect (for page transitions)
        setTimeout(() => {
          const currentRoom = this.rooms.get(roomId);
          if (!currentRoom) return; // Room already deleted
          
          // Check if this socket reconnected (ID changed)
          const currentSocketIds = Object.keys(currentRoom.fighters);
          const stillDisconnected = !currentSocketIds.includes(socketId);
          
          if (stillDisconnected) {
            console.log(`❌ Player ${socketId} failed to reconnect to ${roomId}, closing room`);
            
            // Notify other player
            if (this.io) {
              this.io.to(roomId).emit('opponentDisconnected');
            }

            // Remove room
            this.rooms.delete(roomId);
            console.log(`Room ${roomId} closed due to disconnect timeout`);
          }
        }, 10000); // 10 second grace period
        
        break;
      }
    }
  }

  // Broadcast queue status to all waiting players
  broadcastQueueStatus() {
    if (!this.io) return;

    this.matchmakingQueue.forEach(player => {
      const socket = this.io.sockets.sockets.get(player.socketId);
      if (socket) {
        socket.emit('queueStatus', {
          playersInQueue: this.matchmakingQueue.length
        });
      }
    });
  }

  // Get room for a player
  getRoomForPlayer(socketId) {
    for (const [roomId, room] of this.rooms) {
      if (room.fighters[socketId]) {
        return room;
      }
    }
    return null;
  }

  // Handle player joining the game (reconnecting with new socket ID)
  joinGame(newSocketId, roomId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      console.error(`❌ Room ${roomId} not found for joinGame`);
      return { success: false, error: 'Room not found' };
    }

    console.log(`🎮 Player ${newSocketId} joining room ${roomId}`);

    // Track which fighters have reconnected
    if (!room.reconnectedFighters) {
      room.reconnectedFighters = new Set();
    }

    // Find which fighter slot is available or needs updating
    const fighters = Object.values(room.fighters);
    const oldSocketIds = Object.keys(room.fighters);

    console.log(`📋 Existing fighter IDs: ${oldSocketIds.join(', ')}`);
    console.log(`📋 Reconnected fighters: ${Array.from(room.reconnectedFighters).join(', ')}`);

    // Check if this socket is already in the room
    if (room.fighters[newSocketId]) {
      console.log(`✅ Socket ${newSocketId} already in room`);
      const fighterIndex = fighters.findIndex(f => f.id === newSocketId);
      return { 
        success: true, 
        playerNumber: fighterIndex + 1,
        roomId 
      };
    }

    // Find the first fighter that hasn't reconnected yet
    let playerNumber = null;
    let oldFighterId = null;

    for (let i = 0; i < oldSocketIds.length; i++) {
      const oldId = oldSocketIds[i];
      if (!room.reconnectedFighters.has(oldId)) {
        // This fighter hasn't reconnected yet
        oldFighterId = oldId;
        playerNumber = i + 1;
        break;
      }
    }

    if (!oldFighterId) {
      console.error(`❌ All fighter slots already taken`);
      return { success: false, error: 'All fighter slots already taken' };
    }

    console.log(`🔄 Updating fighter ${oldFighterId} to ${newSocketId} (Player ${playerNumber})`);

    // Update the fighter's ID
    const oldFighter = room.fighters[oldFighterId];
    oldFighter.id = newSocketId;
    
    // Move fighter to new key
    room.fighters[newSocketId] = oldFighter;
    delete room.fighters[oldFighterId];
    
    // Update roundsWon mapping
    if (room.roundsWon[oldFighterId] !== undefined) {
      room.roundsWon[newSocketId] = room.roundsWon[oldFighterId];
      delete room.roundsWon[oldFighterId];
    }

    // Mark this fighter as reconnected
    room.reconnectedFighters.add(oldFighterId);

    // Join the socket to the room
    if (this.io) {
      const socket = this.io.sockets.sockets.get(newSocketId);
      if (socket) {
        socket.join(roomId);
        console.log(`✅ Socket ${newSocketId} joined room ${roomId} as Player ${playerNumber}`);
      }
    }

    return { 
      success: true, 
      playerNumber,
      roomId 
    };
  }
}

module.exports = FightGame;
