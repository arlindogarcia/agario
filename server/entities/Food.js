class Food {
  constructor(id, x, y) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.radius = 5;
    this.mass = 1;
    this.color = this.generateColor();
    this.speedX = 0;
    this.speedY = 0;
  }

  generateColor() {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
      '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
      '#F8B739', '#52B788', '#E56B6F', '#6C5CE7'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // Atualizar posição (para comida ejetada)
  update() {
    if (this.speedX !== 0 || this.speedY !== 0) {
      this.x += this.speedX;
      this.y += this.speedY;

      // Aplicar fricção
      this.speedX *= 0.95;
      this.speedY *= 0.95;

      // Parar quando a velocidade for muito baixa
      if (Math.abs(this.speedX) < 0.01) this.speedX = 0;
      if (Math.abs(this.speedY) < 0.01) this.speedY = 0;
    }
  }

  // Verificar colisão com uma célula
  collidesWith(cell) {
    const dx = this.x - cell.x;
    const dy = this.y - cell.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < this.radius + cell.radius;
  }

  // Serializar para enviar ao cliente
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

module.exports = Food;
