class Projectile {
  constructor(id, x, y, angle, ownerId) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.radius = 8;
    this.color = '#ff0000';
    this.speedX = Math.cos(angle) * 35; // Bem rápido!
    this.speedY = Math.sin(angle) * 35;
    this.ownerId = ownerId; // Quem atirou
    this.createdAt = Date.now();
    this.lifespan = 3000; // 3 segundos de vida
  }

  update() {
    this.x += this.speedX;
    this.y += this.speedY;
  }

  isExpired() {
    return Date.now() - this.createdAt > this.lifespan;
  }

  collidesWith(cell) {
    const dx = this.x - cell.x;
    const dy = this.y - cell.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < this.radius + cell.radius;
  }

  serialize() {
    return {
      id: this.id,
      x: Math.round(this.x),
      y: Math.round(this.y),
      radius: this.radius,
      color: this.color
    };
  }
}

module.exports = Projectile;
