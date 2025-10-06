class Cell {
  constructor(id, x, y, radius, color) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.mass = radius * radius / 100; // Massa baseada no raio
    this.color = color;
    this.speedX = 0;
    this.speedY = 0;
    this.splitBoostUntil = 0; // Timestamp até quando o boost do split está ativo
  }

  // Atualizar posição baseado na velocidade
  update() {
    this.x += this.speedX;
    this.y += this.speedY;

    // Aplicar fricção (menor durante split boost)
    const now = Date.now();
    const friction = now < this.splitBoostUntil ? 0.92 : 0.85;
    this.speedX *= friction;
    this.speedY *= friction;
  }

  // Mover em direção a um alvo
  moveTowards(targetX, targetY, speed) {
    // Se está em split boost, não controlar pelo mouse ainda
    const now = Date.now();
    if (now < this.splitBoostUntil) {
      return;
    }

    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 5) {
      this.speedX = (dx / distance) * speed;
      this.speedY = (dy / distance) * speed;
    }
  }

  // Verificar colisão com outra célula
  collidesWith(otherCell) {
    const dx = this.x - otherCell.x;
    const dy = this.y - otherCell.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < this.radius + otherCell.radius;
  }

  // Verificar se pode comer outra célula (precisa ser pelo menos 10% maior)
  canEat(otherCell) {
    return this.mass > otherCell.mass * 1.1;
  }

  // Absorver outra célula
  eat(otherCell) {
    this.mass += otherCell.mass;
    this.radius = Math.sqrt(this.mass * 100);
  }

  // Obter velocidade baseada no tamanho (células maiores são mais lentas)
  getSpeed() {
    return 2.5 - (this.radius / 100);
  }

  // Serializar para enviar ao cliente
  serialize() {
    return {
      id: this.id,
      x: Math.round(this.x),
      y: Math.round(this.y),
      radius: Math.round(this.radius),
      color: this.color
    };
  }
}

module.exports = Cell;
