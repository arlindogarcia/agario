const Cell = require('./Cell');

class Player {
  constructor(id, name, avatar) {
    this.id = id;
    this.name = name;
    this.avatar = avatar;
    this.cells = [];
    this.target = { x: 0, y: 0 };
    this.color = this.generateColor();
    this.score = 0;
    this.lastSplitTime = 0;
    this.lastEjectTime = 0;
    this.lastShootTime = 0;

    // Criar célula inicial
    this.spawnCell();
  }

  generateColor() {
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 70%, 60%)`;
  }

  spawnCell() {
    const x = Math.random() * 5000 + 2500; // Spawn no centro aproximado
    const y = Math.random() * 5000 + 2500;
    const cell = new Cell(
      `${this.id}-${this.cells.length}`,
      x,
      y,
      20, // Raio inicial
      this.color
    );
    this.cells.push(cell);
  }

  setTarget(x, y) {
    this.target.x = x;
    this.target.y = y;
  }

  update(gameWidth, gameHeight) {
    // Atualizar cada célula
    this.cells.forEach(cell => {
      const speed = cell.getSpeed();
      cell.moveTowards(this.target.x, this.target.y, speed);
      cell.update();

      // Limites do mapa
      cell.x = Math.max(cell.radius, Math.min(gameWidth - cell.radius, cell.x));
      cell.y = Math.max(cell.radius, Math.min(gameHeight - cell.radius, cell.y));
    });

    // Calcular score (soma das massas)
    this.score = this.cells.reduce((sum, cell) => sum + cell.mass, 0);

    // Tentar recombinar células após 30 segundos
    this.mergeCells();
  }

  // Split - dividir as células do jogador
  split() {
    const now = Date.now();
    if (now - this.lastSplitTime < 1000) return; // Cooldown de 1 segundo
    if (this.cells.length >= 16) return; // Máximo de 16 células

    const newCells = [];
    this.cells.forEach(cell => {
      if (cell.radius > 20) { // Só pode dividir se for grande o suficiente
        const angle = Math.atan2(
          this.target.y - cell.y,
          this.target.x - cell.x
        );

        // Criar nova célula
        const newCell = new Cell(
          `${this.id}-${this.cells.length + newCells.length}`,
          cell.x,
          cell.y,
          cell.radius / 1.414, // Dividir raio
          cell.color
        );

        // Dar IMPULSO FORTE para a nova célula (avançada) - MUITO MAIS RÁPIDO!
        const splitSpeed = 40; // Aumentado de 25 para 40
        newCell.speedX = Math.cos(angle) * splitSpeed;
        newCell.speedY = Math.sin(angle) * splitSpeed;
        newCell.splitTime = now;
        newCell.splitBoostUntil = now + 500; // 500ms de impulso livre sem controle do mouse

        // Reduzir célula original e dar pequeno impulso contrário
        cell.radius = cell.radius / 1.414;
        cell.mass = cell.radius * cell.radius / 100;
        cell.speedX = Math.cos(angle) * -3;
        cell.speedY = Math.sin(angle) * -3;
        cell.splitTime = now;
        cell.splitBoostUntil = now + 200; // Recuo menor, menos tempo

        newCells.push(newCell);
      }
    });

    this.cells.push(...newCells);
    this.lastSplitTime = now;
  }

  // Eject - ejetar massa
  eject() {
    const now = Date.now();
    if (now - this.lastEjectTime < 100) return; // Cooldown de 100ms

    this.cells.forEach(cell => {
      if (cell.mass > 10) {
        const angle = Math.atan2(
          this.target.y - cell.y,
          this.target.x - cell.x
        );

        // Criar comida ejetada (será tratada no Game.js)
        cell.mass -= 1;
        cell.radius = Math.sqrt(cell.mass * 100);

        // Retornar dados da comida ejetada
        return {
          x: cell.x + Math.cos(angle) * cell.radius,
          y: cell.y + Math.sin(angle) * cell.radius,
          speedX: Math.cos(angle) * 15,
          speedY: Math.sin(angle) * 15
        };
      }
    });

    this.lastEjectTime = now;
  }

  // Atirar projétil explosivo - PODER ESPECIAL!
  shoot() {
    const now = Date.now();
    // Cooldown de 5 segundos (5000ms)
    if (now - this.lastShootTime < 5000) return null;

    // Precisa ter pelo menos 50 de massa para atirar
    if (this.cells.length === 0 || this.cells[0].mass < 50) return null;

    const cell = this.cells[0]; // Célula principal
    const angle = Math.atan2(
      this.target.y - cell.y,
      this.target.x - cell.x
    );

    // Custo: perde 20% da massa
    const massCost = cell.mass * 0.2;
    cell.mass -= massCost;
    cell.radius = Math.sqrt(cell.mass * 100);

    this.lastShootTime = now;

    // Retornar dados do projétil
    return {
      x: cell.x + Math.cos(angle) * (cell.radius + 15),
      y: cell.y + Math.sin(angle) * (cell.radius + 15),
      angle: angle
    };
  }

  // Recombinar células após um tempo
  mergeCells() {
    const now = Date.now();
    const mergeTime = 30000; // 30 segundos

    for (let i = this.cells.length - 1; i > 0; i--) {
      for (let j = i - 1; j >= 0; j--) {
        const cellA = this.cells[i];
        const cellB = this.cells[j];

        // Verificar se passou tempo suficiente desde o split
        const canMerge = (!cellA.splitTime || now - cellA.splitTime > mergeTime) &&
                        (!cellB.splitTime || now - cellB.splitTime > mergeTime);

        if (canMerge && cellA.collidesWith(cellB)) {
          // Mesclar células
          cellB.eat(cellA);
          this.cells.splice(i, 1);
          break;
        }
      }
    }
  }

  // Verificar se o jogador ainda está vivo
  isAlive() {
    return this.cells.length > 0;
  }

  // Serializar para enviar ao cliente
  serialize() {
    return {
      id: this.id,
      name: this.name,
      avatar: this.avatar,
      cells: this.cells.map(cell => cell.serialize()),
      score: Math.round(this.score)
    };
  }
}

module.exports = Player;
