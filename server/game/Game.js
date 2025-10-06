const Player = require('../entities/Player');
const Food = require('../entities/Food');
const Projectile = require('../entities/Projectile');

class Game {
  constructor() {
    this.width = 3000;
    this.height = 3000;
    this.players = new Map();
    this.food = new Map();
    this.projectiles = new Map();
    this.foodIdCounter = 0;
    this.projectileIdCounter = 0;
    this.io = null; // Referência ao socket.io para emitir eventos

    // Gerar comida inicial
    this.generateFood(1000);
  }

  // Definir referência do socket.io
  setIO(io) {
    this.io = io;
  }

  // Adicionar jogador
  addPlayer(id, name, avatar) {
    const player = new Player(id, name, avatar);
    this.players.set(id, player);
    return player;
  }

  // Remover jogador
  removePlayer(id) {
    this.players.delete(id);
  }

  // Atualizar alvo do jogador (mouse position)
  updatePlayerTarget(id, target) {
    const player = this.players.get(id);
    if (player) {
      player.setTarget(target.x, target.y);
    }
  }

  // Split do jogador
  splitPlayer(id) {
    const player = this.players.get(id);
    if (player) {
      player.split();
    }
  }

  // Ejetar massa
  ejectMass(id) {
    const player = this.players.get(id);
    if (player) {
      player.cells.forEach(cell => {
        if (cell.mass > 10) {
          const angle = Math.atan2(
            player.target.y - cell.y,
            player.target.x - cell.x
          );

          // Criar comida ejetada (bem visível!)
          const food = new Food(
            `ejected-${this.foodIdCounter++}`,
            cell.x + Math.cos(angle) * (cell.radius + 15),
            cell.y + Math.sin(angle) * (cell.radius + 15)
          );
          food.radius = 12; // Maior para ser mais visível
          food.mass = 3;
          food.color = '#00FF41'; // Verde fluorescente bem visível
          food.isEjected = true; // Flag para identificar massa ejetada
          food.speedX = Math.cos(angle) * 25; // Velocidade maior
          food.speedY = Math.sin(angle) * 25;

          this.food.set(food.id, food);

          // Reduzir massa da célula
          cell.mass -= 3;
          cell.radius = Math.sqrt(cell.mass * 100);
        }
      });
    }
  }

  // Atirar projétil explosivo - PODER ESPECIAL!
  shootProjectile(playerId) {
    const player = this.players.get(playerId);
    if (!player) return;

    const projectileData = player.shoot();
    if (!projectileData) return; // Cooldown ou não tem massa suficiente

    // Criar projétil
    const projectile = new Projectile(
      `projectile-${this.projectileIdCounter++}`,
      projectileData.x,
      projectileData.y,
      projectileData.angle,
      playerId
    );

    this.projectiles.set(projectile.id, projectile);

    // Notificar todos os jogadores sobre o tiro
    if (this.io) {
      this.io.emit('projectileFired', {
        playerId: playerId,
        playerName: player.name
      });
    }
  }

  // Gerar comida aleatória
  generateFood(count) {
    for (let i = 0; i < count; i++) {
      const food = new Food(
        `food-${this.foodIdCounter++}`,
        Math.random() * this.width,
        Math.random() * this.height
      );
      this.food.set(food.id, food);
    }
  }

  // Atualizar estado do jogo
  update() {
    // Atualizar jogadores
    this.players.forEach(player => {
      player.update(this.width, this.height);
    });

    // Atualizar comida (comida ejetada se move)
    this.food.forEach(food => {
      food.update();

      // Limites do mapa
      food.x = Math.max(food.radius, Math.min(this.width - food.radius, food.x));
      food.y = Math.max(food.radius, Math.min(this.height - food.radius, food.y));
    });

    // Atualizar projéteis
    this.projectiles.forEach((projectile, id) => {
      projectile.update();

      // Remover se expirou ou saiu do mapa
      if (projectile.isExpired() ||
          projectile.x < 0 || projectile.x > this.width ||
          projectile.y < 0 || projectile.y > this.height) {
        this.projectiles.delete(id);
      }
    });

    // Colisões de projéteis com jogadores
    this.checkProjectileCollisions();

    // Colisões entre jogadores
    this.checkPlayerCollisions();

    // Colisões com comida
    this.checkFoodCollisions();

    // Regenerar comida se necessário
    if (this.food.size < 1500) {
      this.generateFood(200);
    }
  }

  // Verificar colisões de projéteis com jogadores
  checkProjectileCollisions() {
    this.projectiles.forEach((projectile, projectileId) => {
      this.players.forEach((player, playerId) => {
        // Não pode atingir quem atirou
        if (playerId === projectile.ownerId) return;

        player.cells.forEach(cell => {
          if (projectile.collidesWith(cell)) {
            // EXPLOSÃO! Dividir o jogador em 8 células pequenas
            this.explodePlayer(player, cell);

            // Remover projétil
            this.projectiles.delete(projectileId);

            // Notificar sobre a explosão
            if (this.io) {
              const shooter = this.players.get(projectile.ownerId);
              this.io.emit('playerExploded', {
                victimId: playerId,
                victimName: player.name,
                shooterId: projectile.ownerId,
                shooterName: shooter ? shooter.name : 'Desconhecido',
                x: cell.x,
                y: cell.y
              });

              // Mensagem no chat
              this.io.emit('chat', {
                id: 'system',
                name: 'Sistema',
                message: `💥 ${shooter ? shooter.name : 'Alguém'} explodiu ${player.name}!`
              });
            }
          }
        });
      });
    });
  }

  // Explodir jogador em células pequenas
  explodePlayer(player, hitCell) {
    const Cell = require('../entities/Cell');

    // Remover a célula atingida
    const cellIndex = player.cells.indexOf(hitCell);
    if (cellIndex > -1) {
      player.cells.splice(cellIndex, 1);
    }

    // Criar 8 células pequenas em um círculo ao redor da explosão
    const numFragments = 8;
    const fragmentMass = hitCell.mass / numFragments;

    for (let i = 0; i < numFragments; i++) {
      const angle = (Math.PI * 2 / numFragments) * i;
      const distance = hitCell.radius * 0.5;

      const fragment = new Cell(
        `${player.id}-fragment-${Date.now()}-${i}`,
        hitCell.x + Math.cos(angle) * distance,
        hitCell.y + Math.sin(angle) * distance,
        Math.sqrt(fragmentMass * 100),
        player.color
      );

      // Dar impulso para fora
      fragment.speedX = Math.cos(angle) * 15;
      fragment.speedY = Math.sin(angle) * 15;
      fragment.mass = fragmentMass;
      fragment.splitTime = Date.now();
      fragment.splitBoostUntil = Date.now() + 300;

      player.cells.push(fragment);
    }
  }

  // Verificar colisões entre jogadores
  checkPlayerCollisions() {
    const players = Array.from(this.players.values());

    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const playerA = players[i];
        const playerB = players[j];

        // Verificar colisão entre todas as células dos dois jogadores
        playerA.cells.forEach((cellA, indexA) => {
          playerB.cells.forEach((cellB, indexB) => {
            if (cellA.collidesWith(cellB)) {
              if (cellA.canEat(cellB)) {
                // CellA come CellB
                cellA.eat(cellB);
                playerB.cells.splice(indexB, 1);
              } else if (cellB.canEat(cellA)) {
                // CellB come CellA
                cellB.eat(cellA);
                playerA.cells.splice(indexA, 1);
              }
            }
          });
        });

        // Verificar se algum jogador morreu e notificar
        if (!playerA.isAlive()) {
          this.handlePlayerDeath(playerA, playerB);
          this.removePlayer(playerA.id);
        }
        if (!playerB.isAlive()) {
          this.handlePlayerDeath(playerB, playerA);
          this.removePlayer(playerB.id);
        }
      }
    }
  }

  // Lidar com morte de jogador
  handlePlayerDeath(deadPlayer, killer) {
    if (!this.io) return;

    // Notificar o jogador que morreu
    this.io.to(deadPlayer.id).emit('playerDied', {
      killer: killer.name,
      killerScore: Math.round(killer.score)
    });

    // Mensagem no chat para todos
    this.io.emit('chat', {
      id: 'system',
      name: 'Sistema',
      message: `💀 ${killer.name} eliminou ${deadPlayer.name}!`
    });
  }

  // Verificar colisões com comida
  checkFoodCollisions() {
    this.players.forEach(player => {
      player.cells.forEach(cell => {
        this.food.forEach(food => {
          if (food.collidesWith(cell)) {
            cell.eat(food);
            this.food.delete(food.id);
          }
        });
      });
    });
  }

  // Obter leaderboard
  getLeaderboard() {
    return Array.from(this.players.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(player => ({
        name: player.name,
        score: Math.round(player.score)
      }));
  }

  // Obter estado do jogo para enviar aos clientes (com viewport culling opcional)
  getState(playerId = null, viewportSize = null) {
    let players = Array.from(this.players.values()).map(p => p.serialize());
    let food = Array.from(this.food.values()).map(f => f.serialize());

    // Viewport culling: se um jogador específico e viewport foram fornecidos
    if (playerId && viewportSize) {
      const player = this.players.get(playerId);
      if (player && player.cells.length > 0) {
        // Calcular centro do viewport do jogador
        let centerX = 0, centerY = 0;
        player.cells.forEach(cell => {
          centerX += cell.x;
          centerY += cell.y;
        });
        centerX /= player.cells.length;
        centerY /= player.cells.length;

        // Margem extra para evitar pop-in
        const margin = 200;
        const minX = centerX - viewportSize.width / 2 - margin;
        const maxX = centerX + viewportSize.width / 2 + margin;
        const minY = centerY - viewportSize.height / 2 - margin;
        const maxY = centerY + viewportSize.height / 2 + margin;

        // Filtrar comida apenas no viewport (maior economia de banda)
        food = food.filter(f =>
          f.x >= minX && f.x <= maxX && f.y >= minY && f.y <= maxY
        );

        // Filtrar células de jogadores fora do viewport
        players = players.map(p => {
          const visibleCells = p.cells.filter(c =>
            c.x >= minX && c.x <= maxX && c.y >= minY && c.y <= maxY
          );
          return visibleCells.length > 0 ? { ...p, cells: visibleCells } : null;
        }).filter(p => p !== null);
      }
    }

    return {
      players,
      food,
      projectiles: Array.from(this.projectiles.values()).map(p => p.serialize()),
      leaderboard: this.getLeaderboard(),
      worldSize: {
        width: this.width,
        height: this.height
      }
    };
  }
}

module.exports = Game;
