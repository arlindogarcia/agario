class Fighter {
  constructor(id, name, avatar, position = 0) {
    this.id = id;
    this.name = name;
    this.avatar = avatar;
    this.position = position; // 0 = left, 1 = right

    // Combat stats
    this.health = 100;
    this.maxHealth = 100;

    // Position and physics
    this.x = position === 0 ? 200 : 800;
    this.y = 400; // Ground level
    this.velocityX = 0;
    this.velocityY = 0;
    this.facingRight = position === 0;

    // State
    this.isGrounded = true;
    this.isBlocking = false;
    this.isAttacking = false;
    this.isStunned = false;
    this.isDead = false;

    // Combo system
    this.comboMeter = 0;
    this.maxComboMeter = 100;

    // Animation state
    this.currentAction = 'idle'; // idle, walk, jump, punch, kick, block, hurt, special
    this.actionFrame = 0;
    this.actionTimer = 0;

    // Attack properties
    this.attackCooldown = 0;
    this.stunDuration = 0;
    this.hitboxActive = false;
    this.currentAttack = null;

    // Input state
    this.input = {
      left: false,
      right: false,
      up: false,
      down: false,
      punch: false,
      kick: false,
      block: false,
      special: false
    };
  }

  // Update fighter state (called every tick)
  update(deltaTime = 16) {
    // Update timers
    if (this.attackCooldown > 0) this.attackCooldown -= deltaTime;
    if (this.stunDuration > 0) {
      this.stunDuration -= deltaTime;
      if (this.stunDuration <= 0) {
        this.isStunned = false;
      }
    }

    // Can't move if stunned or dead
    if (this.isStunned || this.isDead) {
      this.velocityX *= 0.8; // Slow down
      this.applyPhysics(deltaTime);
      return;
    }

    // Handle input
    this.handleMovement();
    this.handleActions();

    // Apply physics
    this.applyPhysics(deltaTime);

    // Update animation
    this.updateAnimation(deltaTime);

    // Regenerate combo meter slowly when not attacking
    if (!this.isAttacking && this.comboMeter < this.maxComboMeter) {
      this.comboMeter += 0.1;
    }
  }

  handleMovement() {
    const moveSpeed = 5;

    // Horizontal movement
    if (this.input.left && !this.isAttacking) {
      this.velocityX = -moveSpeed;
      this.facingRight = false;
      this.currentAction = 'walk';
    } else if (this.input.right && !this.isAttacking) {
      this.velocityX = moveSpeed;
      this.facingRight = true;
      this.currentAction = 'walk';
    } else if (!this.isAttacking) {
      this.velocityX = 0;
      this.currentAction = 'idle';
    }

    // Jump
    if (this.input.up && this.isGrounded && !this.isAttacking) {
      this.velocityY = -15;
      this.isGrounded = false;
      this.currentAction = 'jump';
    }

    // Block
    if (this.input.down && this.isGrounded && !this.isAttacking) {
      this.isBlocking = true;
      this.currentAction = 'block';
      this.velocityX = 0;
    } else {
      this.isBlocking = false;
    }
  }

  handleActions() {
    // Can't attack while already attacking or on cooldown
    if (this.isAttacking || this.attackCooldown > 0) return;

    // Punch (light, fast attack)
    if (this.input.punch) {
      this.performAttack('punch', {
        damage: 8,
        range: 60,
        duration: 300,
        cooldown: 400,
        comboGain: 10,
        knockback: 5,
        stunTime: 100
      });
    }

    // Kick (heavy, slower attack)
    else if (this.input.kick) {
      this.performAttack('kick', {
        damage: 15,
        range: 70,
        duration: 500,
        cooldown: 800,
        comboGain: 20,
        knockback: 10,
        stunTime: 200
      });
    }

    // Special attack (powerful, requires full combo meter)
    else if (this.input.special && this.comboMeter >= this.maxComboMeter) {
      this.performAttack('special', {
        damage: 30,
        range: 100,
        duration: 800,
        cooldown: 1000,
        comboGain: 0,
        knockback: 20,
        stunTime: 400
      });
      this.comboMeter = 0; // Consume combo meter
    }
  }

  performAttack(type, properties) {
    this.isAttacking = true;
    this.currentAction = type;
    this.currentAttack = properties;
    this.actionFrame = 0;
    this.actionTimer = 0;
    this.velocityX = 0; // Stop moving during attack

    // Hitbox becomes active partway through the animation
    setTimeout(() => {
      this.hitboxActive = true;
    }, properties.duration * 0.3); // Hitbox active at 30% of animation

    // End attack after duration
    setTimeout(() => {
      this.isAttacking = false;
      this.hitboxActive = false;
      this.attackCooldown = properties.cooldown;
      this.currentAttack = null;
      this.currentAction = 'idle';
    }, properties.duration);
  }

  applyPhysics(deltaTime) {
    const gravity = 0.8;
    const groundY = 400;

    // Apply gravity
    if (!this.isGrounded) {
      this.velocityY += gravity;
    }

    // Update position
    this.x += this.velocityX;
    this.y += this.velocityY;

    // Ground collision
    if (this.y >= groundY) {
      this.y = groundY;
      this.velocityY = 0;
      this.isGrounded = true;
      if (this.currentAction === 'jump') {
        this.currentAction = 'idle';
      }
    } else {
      this.isGrounded = false;
    }

    // Keep within bounds (arena is 1000px wide)
    this.x = Math.max(50, Math.min(950, this.x));
  }

  updateAnimation(deltaTime) {
    this.actionTimer += deltaTime;
    if (this.actionTimer >= 100) { // Update frame every 100ms
      this.actionTimer = 0;
      this.actionFrame++;
    }
  }

  // Take damage from opponent
  takeDamage(damage, knockback, stunTime, blocked = false) {
    if (this.isDead) return false;

    // Blocking reduces damage and knockback
    if (this.isBlocking && blocked) {
      damage *= 0.3;
      knockback *= 0.3;
      stunTime *= 0.5;
    }

    // Apply damage
    this.health = Math.max(0, this.health - damage);

    // Apply knockback
    const knockbackDirection = this.facingRight ? -1 : 1;
    this.velocityX = knockbackDirection * knockback;

    // Apply stun
    this.isStunned = true;
    this.stunDuration = stunTime;
    this.currentAction = 'hurt';

    // Check if dead
    if (this.health <= 0) {
      this.isDead = true;
      this.currentAction = 'dead';
    }

    return true;
  }

  // Get hitbox for attack detection
  getHitbox() {
    if (!this.hitboxActive || !this.currentAttack) return null;

    const range = this.currentAttack.range;
    const direction = this.facingRight ? 1 : -1;

    return {
      x: this.x + (direction * range / 2),
      y: this.y - 40, // Center of body
      width: range,
      height: 80,
      damage: this.currentAttack.damage,
      knockback: this.currentAttack.knockback,
      stunTime: this.currentAttack.stunTime,
      comboGain: this.currentAttack.comboGain
    };
  }

  // Get hurtbox (body area that can be hit)
  getHurtbox() {
    return {
      x: this.x,
      y: this.y - 40,
      width: 40,
      height: 80
    };
  }

  // Reset for new round
  reset() {
    this.health = this.maxHealth;
    this.x = this.position === 0 ? 200 : 800;
    this.y = 400;
    this.velocityX = 0;
    this.velocityY = 0;
    this.isGrounded = true;
    this.isBlocking = false;
    this.isAttacking = false;
    this.isStunned = false;
    this.isDead = false;
    this.comboMeter = 0;
    this.currentAction = 'idle';
    this.actionFrame = 0;
    this.attackCooldown = 0;
    this.stunDuration = 0;
    this.hitboxActive = false;
    this.currentAttack = null;
  }

  // Update input state
  setInput(input) {
    this.input = { ...this.input, ...input };
  }

  // Serialize for sending to client
  serialize() {
    return {
      id: this.id,
      name: this.name,
      avatar: this.avatar,
      position: this.position,
      health: this.health,
      maxHealth: this.maxHealth,
      x: this.x,
      y: this.y,
      velocityX: this.velocityX,
      velocityY: this.velocityY,
      facingRight: this.facingRight,
      isGrounded: this.isGrounded,
      isBlocking: this.isBlocking,
      isAttacking: this.isAttacking,
      isStunned: this.isStunned,
      isDead: this.isDead,
      comboMeter: this.comboMeter,
      currentAction: this.currentAction,
      actionFrame: this.actionFrame
    };
  }
}

module.exports = Fighter;
