const Player = require('../entities/Player');
const Food = require('../entities/Food');

class Game {
  constructor() {
    this.width = 2000;
    this.height = 2000;
    this.players = new Map();
    this.food = new Map();
    this.foodIdCounter = 0;

    // Gerar comida inicial
    this.generateFood(3000);
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

    // Colisões entre jogadores
    this.checkPlayerCollisions();

    // Colisões com comida
    this.checkFoodCollisions();

    // Regenerar comida se necessário
    if (this.food.size < 500) {
      this.generateFood(10);
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

        // Remover jogadores mortos
        if (!playerA.isAlive()) {
          this.removePlayer(playerA.id);
        }
        if (!playerB.isAlive()) {
          this.removePlayer(playerB.id);
        }
      }
    }
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

  // Obter estado do jogo para enviar aos clientes
  getState() {
    return {
      players: Array.from(this.players.values()).map(p => p.serialize()),
      food: Array.from(this.food.values()).map(f => f.serialize()),
      leaderboard: this.getLeaderboard(),
      worldSize: {
        width: this.width,
        height: this.height
      }
    };
  }
}

module.exports = Game;
