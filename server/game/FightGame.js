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
      winner: null,
      reconnectedPositions: new Set(), // Track which positions (0, 1) have reconnected after page transition
      isTransitioning: true // Flag to indicate room is in transition phase
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
      if (!room.lastLogTime || Date.now() - room.lastLogTime > 3000) {
        console.log(`📡 Sending gameUpdate to room ${roomId}:`, {
          fighterCount: gameState.fighters.length,
          fighters: gameState.fighters.map(f => ({
            id: f.id.substring(0, 8),
            name: f.name,
            pos: f.position,
            x: Math.round(f.x),
            velocityX: f.velocityX
          })),
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
    let foundFighter = false;
    
    for (const [roomId, room] of this.rooms) {
      if (room.fighters[socketId]) {
        const fighter = room.fighters[socketId];
        
        // Log input updates (throttled)
        if (!fighter.lastInputLog || Date.now() - fighter.lastInputLog > 2000) {
          console.log(`🎮 Input from ${socketId.substring(0, 8)} (${fighter.name}, pos ${fighter.position}):`, {
            left: input.left,
            right: input.right,
            punch: input.punch,
            kick: input.kick
          });
          fighter.lastInputLog = Date.now();
        }
        
        fighter.setInput(input);
        foundFighter = true;
        break;
      }
    }
    
    // Log if fighter not found
    if (!foundFighter) {
      if (!this.loggedMissingFighters) this.loggedMissingFighters = new Set();
      if (!this.loggedMissingFighters.has(socketId)) {
        console.error(`❌ Fighter not found for socket ${socketId.substring(0, 8)}`);
        
        // Show all rooms and fighters
        for (const [roomId, room] of this.rooms) {
          console.log(`   Room ${roomId} has fighters:`, 
            Object.values(room.fighters).map(f => ({
              id: f.id.substring(0, 8),
              name: f.name,
              pos: f.position
            }))
          );
        }
        
        this.loggedMissingFighters.add(socketId);
      }
    }
  }

  // Handle player disconnect
  handleDisconnect(socketId) {
    // Remove from queue
    this.leaveQueue(socketId);

    // Find room with this player
    for (const [roomId, room] of this.rooms) {
      const currentSocketIds = Object.keys(room.fighters);
      
      if (currentSocketIds.includes(socketId)) {
        console.log(`⚠️ Player ${socketId} disconnected from room ${roomId}`);
        
        // Check if room is in transition phase (players reconnecting after page transition)
        if (room.isTransitioning) {
          // Players are still reconnecting, give them time
          console.log(`🔄 Player disconnected during transition phase, waiting for reconnection...`);
          
          // Set a timeout ID so we can track this
          if (!room.disconnectTimeout) {
            room.disconnectTimeout = setTimeout(() => {
              const currentRoom = this.rooms.get(roomId);
              if (!currentRoom) return; // Room already deleted
              
              // Check if transition is complete (both players reconnected)
              if (currentRoom.isTransitioning) {
                console.log(`❌ Not all players reconnected to ${roomId} in time, closing room`);
                
                // Notify other player
                if (this.io) {
                  this.io.to(roomId).emit('opponentDisconnected');
                }

                // Remove room
                this.rooms.delete(roomId);
                console.log(`Room ${roomId} closed due to transition timeout`);
              }
            }, 15000); // 15 second grace period for transition
          }
        } else {
          // Normal disconnect during game - close room immediately
          console.log(`❌ Player ${socketId} disconnected during game, closing room ${roomId}`);
          
          // Notify other player
          if (this.io) {
            this.io.to(roomId).emit('opponentDisconnected');
          }

          // Remove room
          this.rooms.delete(roomId);
          console.log(`Room ${roomId} closed`);
        }
        
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
  joinGame(newSocketId, roomId, oldPlayerId = null) {
    const room = this.rooms.get(roomId);
    if (!room) {
      console.error(`❌ Room ${roomId} not found for joinGame`);
      return { success: false, error: 'Room not found' };
    }

    console.log(`🎮 Player ${newSocketId.substring(0, 8)}... joining room ${roomId}`);
    if (oldPlayerId) {
      console.log(`   Client says they were: ${oldPlayerId.substring(0, 8)}...`);
    }

    // Track which POSITIONS have reconnected (not IDs, since IDs change!)
    if (!room.reconnectedPositions) {
      room.reconnectedPositions = new Set();
    }

    // Get all fighters sorted by position to maintain order
    const fighters = Object.values(room.fighters).sort((a, b) => a.position - b.position);
    
    console.log(`📋 Existing fighters:`, fighters.map(f => ({ id: f.id.substring(0, 8), position: f.position, name: f.name })));
    console.log(`📋 Reconnected positions: ${Array.from(room.reconnectedPositions).join(', ')}`);

    // Check if this socket is already in the room
    if (room.fighters[newSocketId]) {
      const myFighter = room.fighters[newSocketId];
      console.log(`✅ Socket ${newSocketId.substring(0, 8)}... already in room as position ${myFighter.position}`);
      return { 
        success: true, 
        playerNumber: myFighter.position + 1,
        roomId 
      };
    }

    // Find the fighter to update
    let targetFighter = null;
    let oldFighterId = null;

    // If client provided their old ID, try to find that specific fighter
    if (oldPlayerId && room.fighters[oldPlayerId]) {
      targetFighter = room.fighters[oldPlayerId];
      oldFighterId = oldPlayerId;
      console.log(`✅ Found fighter by OLD ID: ${targetFighter.name} (pos ${targetFighter.position})`);
    } else {
      // Fallback: find the first fighter BY POSITION that hasn't reconnected yet
      for (const fighter of fighters) {
        if (!room.reconnectedPositions.has(fighter.position)) {
          // This position hasn't reconnected yet
          targetFighter = fighter;
          oldFighterId = fighter.id;
          console.log(`⚠️ Using fallback - found unreconnected position: ${targetFighter.position}`);
          break;
        }
      }
    }

    if (!targetFighter) {
      console.error(`❌ All fighter positions already reconnected`);
      return { success: false, error: 'All fighter slots already taken' };
    }

    const playerNumber = targetFighter.position + 1; // position is 0 or 1, playerNumber is 1 or 2

    console.log(`🔄 Updating fighter position ${targetFighter.position} (${targetFighter.name}):`);
    console.log(`   OLD ID: ${oldFighterId.substring(0, 8)}...`);
    console.log(`   NEW ID: ${newSocketId.substring(0, 8)}...`);

    // Update the fighter's ID
    targetFighter.id = newSocketId;
    
    // Move fighter to new key in the fighters object
    room.fighters[newSocketId] = targetFighter;
    delete room.fighters[oldFighterId];
    
    // Update roundsWon mapping
    if (room.roundsWon[oldFighterId] !== undefined) {
      room.roundsWon[newSocketId] = room.roundsWon[oldFighterId];
      delete room.roundsWon[oldFighterId];
    }

    // Mark this POSITION as reconnected
    room.reconnectedPositions.add(targetFighter.position);

    // Log the updated state
    console.log(`✅ Fighter ${targetFighter.name} (pos ${targetFighter.position}) updated successfully!`);
    console.log(`   Fighter ID is now: ${targetFighter.id.substring(0, 8)}...`);
    console.log(`   Stored in room.fighters["${newSocketId.substring(0, 8)}..."]`);
    
    console.log(`\n📋 ROOM STATE AFTER UPDATE:`);
    console.log(`   All fighters in room:`, Object.values(room.fighters).map(f => ({
      name: f.name,
      id: f.id.substring(0, 8),
      position: f.position
    })));
    
    // Verify the fighter is accessible
    const verify = room.fighters[newSocketId];
    if (verify) {
      console.log(`✅ VERIFIED: Fighter "${verify.name}" can be found by new socket ID ${newSocketId.substring(0, 8)}...`);
    } else {
      console.error(`❌ ERROR: Fighter NOT found by new socket ID!`);
    }

    // Check if both players have reconnected (both positions 0 and 1)
    if (room.reconnectedPositions.size === 2) {
      room.isTransitioning = false;
      
      // Clear the disconnect timeout if it exists
      if (room.disconnectTimeout) {
        clearTimeout(room.disconnectTimeout);
        room.disconnectTimeout = null;
      }
      
      console.log(`✅ Both players reconnected to ${roomId}, game ready!`);
      console.log(`   Player 1 (pos 0): ${Object.values(room.fighters).find(f => f.position === 0)?.name}`);
      console.log(`   Player 2 (pos 1): ${Object.values(room.fighters).find(f => f.position === 1)?.name}`);
    }

    // Join the socket to the room
    if (this.io) {
      const socket = this.io.sockets.sockets.get(newSocketId);
      if (socket) {
        socket.join(roomId);
        console.log(`✅ Socket ${newSocketId} joined room ${roomId} as Player ${playerNumber} (position ${targetFighter.position})`);
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
