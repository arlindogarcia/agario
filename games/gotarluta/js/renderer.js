const Renderer = {
  // Load and cache avatar images
  avatarImages: {},

  // Load avatar image
  loadAvatar(src) {
    if (!this.avatarImages[src]) {
      const img = new Image();
      img.src = src;
      this.avatarImages[src] = img;
    }
    return this.avatarImages[src];
  },

  // Main draw function
  drawFighter(ctx, fighter, x, y) {
    ctx.save();

    // Flip if facing left
    if (!fighter.facingRight) {
      ctx.scale(-1, 1);
      x = -x;
    }

    // Draw based on action
    switch (fighter.currentAction) {
      case 'idle':
        this.drawIdle(ctx, fighter, x, y);
        break;
      case 'walk':
        this.drawWalk(ctx, fighter, x, y);
        break;
      case 'jump':
        this.drawJump(ctx, fighter, x, y);
        break;
      case 'punch':
        this.drawPunch(ctx, fighter, x, y);
        break;
      case 'kick':
        this.drawKick(ctx, fighter, x, y);
        break;
      case 'block':
        this.drawBlock(ctx, fighter, x, y);
        break;
      case 'hurt':
        this.drawHurt(ctx, fighter, x, y);
        break;
      case 'special':
        this.drawSpecial(ctx, fighter, x, y);
        break;
      case 'dead':
        this.drawDead(ctx, fighter, x, y);
        break;
      default:
        this.drawIdle(ctx, fighter, x, y);
    }

    // Draw combo meter
    this.drawComboMeter(ctx, fighter, x, y);

    ctx.restore();
  },

  // Draw idle animation
  drawIdle(ctx, fighter, x, y) {
    const frame = Math.floor(fighter.actionFrame % 4);
    const breathe = Math.sin(frame * 0.5) * 2;

    // Head (avatar)
    this.drawHead(ctx, fighter, x, y - 70 + breathe);

    // Body
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    // Torso
    ctx.beginPath();
    ctx.moveTo(x, y - 50 + breathe);
    ctx.lineTo(x, y - 10);
    ctx.stroke();

    // Arms
    ctx.beginPath();
    ctx.moveTo(x, y - 40 + breathe);
    ctx.lineTo(x - 15, y - 20 + breathe);
    ctx.moveTo(x, y - 40 + breathe);
    ctx.lineTo(x + 15, y - 20 + breathe);
    ctx.stroke();

    // Legs
    ctx.beginPath();
    ctx.moveTo(x, y - 10);
    ctx.lineTo(x - 10, y + 20);
    ctx.moveTo(x, y - 10);
    ctx.lineTo(x + 10, y + 20);
    ctx.stroke();
  },

  // Draw walk animation
  drawWalk(ctx, fighter, x, y) {
    const frame = Math.floor(fighter.actionFrame % 8);
    const legSwing = Math.sin(frame * 0.8) * 15;
    const armSwing = Math.sin(frame * 0.8) * 10;

    // Head
    this.drawHead(ctx, fighter, x, y - 68);

    // Body
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    // Torso
    ctx.beginPath();
    ctx.moveTo(x, y - 50);
    ctx.lineTo(x, y - 10);
    ctx.stroke();

    // Arms (swinging)
    ctx.beginPath();
    ctx.moveTo(x, y - 40);
    ctx.lineTo(x - 15 + armSwing, y - 20);
    ctx.moveTo(x, y - 40);
    ctx.lineTo(x + 15 - armSwing, y - 20);
    ctx.stroke();

    // Legs (swinging)
    ctx.beginPath();
    ctx.moveTo(x, y - 10);
    ctx.lineTo(x - 10 + legSwing, y + 20);
    ctx.moveTo(x, y - 10);
    ctx.lineTo(x + 10 - legSwing, y + 20);
    ctx.stroke();
  },

  // Draw jump animation
  drawJump(ctx, fighter, x, y) {
    // Head
    this.drawHead(ctx, fighter, x, y - 70);

    // Body
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    // Torso
    ctx.beginPath();
    ctx.moveTo(x, y - 50);
    ctx.lineTo(x, y - 10);
    ctx.stroke();

    // Arms up
    ctx.beginPath();
    ctx.moveTo(x, y - 40);
    ctx.lineTo(x - 20, y - 50);
    ctx.moveTo(x, y - 40);
    ctx.lineTo(x + 20, y - 50);
    ctx.stroke();

    // Legs bent
    ctx.beginPath();
    ctx.moveTo(x, y - 10);
    ctx.lineTo(x - 15, y);
    ctx.moveTo(x, y - 10);
    ctx.lineTo(x + 15, y);
    ctx.stroke();
  },

  // Draw punch animation
  drawPunch(ctx, fighter, x, y) {
    const extend = Math.min(fighter.actionFrame * 5, 30);

    // Head
    this.drawHead(ctx, fighter, x, y - 70);

    // Body
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    // Torso
    ctx.beginPath();
    ctx.moveTo(x, y - 50);
    ctx.lineTo(x, y - 10);
    ctx.stroke();

    // Punching arm (extended)
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x, y - 40);
    ctx.lineTo(x + 20 + extend, y - 35);
    ctx.stroke();

    // Other arm
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, y - 40);
    ctx.lineTo(x - 15, y - 20);
    ctx.stroke();

    // Legs
    ctx.beginPath();
    ctx.moveTo(x, y - 10);
    ctx.lineTo(x - 10, y + 20);
    ctx.moveTo(x, y - 10);
    ctx.lineTo(x + 10, y + 20);
    ctx.stroke();

    // Punch effect
    if (extend > 25) {
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + 20 + extend, y - 35, 10, 0, Math.PI * 2);
      ctx.stroke();
    }
  },

  // Draw kick animation
  drawKick(ctx, fighter, x, y) {
    const extend = Math.min(fighter.actionFrame * 5, 35);

    // Head
    this.drawHead(ctx, fighter, x, y - 70);

    // Body (leaning back)
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    // Torso
    ctx.beginPath();
    ctx.moveTo(x - 5, y - 50);
    ctx.lineTo(x - 5, y - 10);
    ctx.stroke();

    // Arms (balance)
    ctx.beginPath();
    ctx.moveTo(x - 5, y - 40);
    ctx.lineTo(x - 25, y - 35);
    ctx.moveTo(x - 5, y - 40);
    ctx.lineTo(x + 10, y - 45);
    ctx.stroke();

    // Kicking leg (extended)
    ctx.strokeStyle = '#ff6600';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x - 5, y - 10);
    ctx.lineTo(x + 15 + extend, y - 5);
    ctx.stroke();

    // Standing leg
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x - 5, y - 10);
    ctx.lineTo(x - 15, y + 20);
    ctx.stroke();

    // Kick effect
    if (extend > 30) {
      ctx.strokeStyle = '#ff6600';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + 15 + extend, y - 5, 12, 0, Math.PI * 2);
      ctx.stroke();
    }
  },

  // Draw block animation
  drawBlock(ctx, fighter, x, y) {
    // Head (ducking)
    this.drawHead(ctx, fighter, x, y - 60);

    // Body (defensive)
    ctx.strokeStyle = '#00aaff';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    // Torso
    ctx.beginPath();
    ctx.moveTo(x, y - 45);
    ctx.lineTo(x, y - 10);
    ctx.stroke();

    // Arms crossed in front
    ctx.beginPath();
    ctx.moveTo(x, y - 35);
    ctx.lineTo(x + 18, y - 25);
    ctx.moveTo(x, y - 35);
    ctx.lineTo(x - 18, y - 25);
    ctx.stroke();

    // Legs
    ctx.beginPath();
    ctx.moveTo(x, y - 10);
    ctx.lineTo(x - 10, y + 20);
    ctx.moveTo(x, y - 10);
    ctx.lineTo(x + 10, y + 20);
    ctx.stroke();

    // Block shield effect
    ctx.strokeStyle = '#00aaff';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(x + 10, y - 30, 25, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  },

  // Draw hurt animation
  drawHurt(ctx, fighter, x, y) {
    const recoil = Math.sin(fighter.actionFrame * 2) * 3;

    // Head
    this.drawHead(ctx, fighter, x - recoil, y - 68);

    // Body (bent)
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    // Torso
    ctx.beginPath();
    ctx.moveTo(x - recoil, y - 50);
    ctx.lineTo(x - recoil - 5, y - 10);
    ctx.stroke();

    // Arms (recoiling)
    ctx.beginPath();
    ctx.moveTo(x - recoil, y - 40);
    ctx.lineTo(x - recoil - 20, y - 30);
    ctx.moveTo(x - recoil, y - 40);
    ctx.lineTo(x - recoil + 10, y - 35);
    ctx.stroke();

    // Legs
    ctx.beginPath();
    ctx.moveTo(x - recoil - 5, y - 10);
    ctx.lineTo(x - recoil - 15, y + 20);
    ctx.moveTo(x - recoil - 5, y - 10);
    ctx.lineTo(x - recoil + 5, y + 20);
    ctx.stroke();
  },

  // Draw special attack animation
  drawSpecial(ctx, fighter, x, y) {
    const frame = fighter.actionFrame;
    const charge = Math.min(frame * 10, 100);

    // Head (glowing)
    this.drawHead(ctx, fighter, x, y - 70);

    // Energy aura
    ctx.strokeStyle = '#ff00ff';
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(x, y - 30, 40 + Math.sin(frame * 0.5) * 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Body (charging)
    ctx.strokeStyle = '#ff00ff';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';

    // Torso
    ctx.beginPath();
    ctx.moveTo(x, y - 50);
    ctx.lineTo(x, y - 10);
    ctx.stroke();

    // Arms (charging)
    ctx.beginPath();
    ctx.moveTo(x, y - 40);
    ctx.lineTo(x - 25, y - 30);
    ctx.moveTo(x, y - 40);
    ctx.lineTo(x + 25, y - 30);
    ctx.stroke();

    // Legs (power stance)
    ctx.beginPath();
    ctx.moveTo(x, y - 10);
    ctx.lineTo(x - 15, y + 20);
    ctx.moveTo(x, y - 10);
    ctx.lineTo(x + 15, y + 20);
    ctx.stroke();

    // Special effect
    if (charge > 50) {
      for (let i = 0; i < 5; i++) {
        const angle = (frame * 0.2 + i * Math.PI * 2 / 5);
        const radius = 50;
        const px = x + Math.cos(angle) * radius;
        const py = y - 30 + Math.sin(angle) * radius;

        ctx.fillStyle = '#ff00ff';
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  },

  // Draw dead animation
  drawDead(ctx, fighter, x, y) {
    // Head (on ground)
    this.drawHead(ctx, fighter, x, y + 10);

    // Body (fallen)
    ctx.strokeStyle = '#666666';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    // Torso (horizontal)
    ctx.beginPath();
    ctx.moveTo(x - 10, y + 5);
    ctx.lineTo(x + 30, y + 5);
    ctx.stroke();

    // Arms (spread)
    ctx.beginPath();
    ctx.moveTo(x + 5, y + 5);
    ctx.lineTo(x - 5, y - 10);
    ctx.moveTo(x + 20, y + 5);
    ctx.lineTo(x + 30, y - 5);
    ctx.stroke();

    // Legs (spread)
    ctx.beginPath();
    ctx.moveTo(x + 25, y + 5);
    ctx.lineTo(x + 30, y + 20);
    ctx.moveTo(x + 25, y + 5);
    ctx.lineTo(x + 40, y + 15);
    ctx.stroke();
  },

  // Draw head with avatar
  drawHead(ctx, fighter, x, y) {
    const headSize = 20;

    // Load and draw avatar
    if (fighter.avatar) {
      const avatar = this.loadAvatar(fighter.avatar);
      if (avatar.complete) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, headSize, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, x - headSize, y - headSize, headSize * 2, headSize * 2);
        ctx.restore();

        // Border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, headSize, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Fallback circle
        this.drawDefaultHead(ctx, x, y, headSize);
      }
    } else {
      this.drawDefaultHead(ctx, x, y, headSize);
    }
  },

  // Draw default head (fallback)
  drawDefaultHead(ctx, x, y, size) {
    ctx.fillStyle = '#ffcc99';
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  },

  // Draw combo meter
  drawComboMeter(ctx, fighter, x, y) {
    if (fighter.comboMeter <= 0) return;

    const barWidth = 60;
    const barHeight = 6;
    const barX = x - barWidth / 2;
    const barY = y - 95;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // Fill
    const fillWidth = (fighter.comboMeter / fighter.maxComboMeter) * barWidth;
    const gradient = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
    gradient.addColorStop(0, '#ff00ff');
    gradient.addColorStop(1, '#ff00aa');
    ctx.fillStyle = gradient;
    ctx.fillRect(barX, barY, fillWidth, barHeight);

    // Border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    // "SPECIAL READY" text
    if (fighter.comboMeter >= fighter.maxComboMeter) {
      ctx.fillStyle = '#ff00ff';
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('SPECIAL!', x, barY - 3);
    }
  }
};
