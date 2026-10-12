
"use strict";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const levelText = document.getElementById("level");
const scoreText = document.getElementById("score");
const healthText = document.getElementById("health");
const startScreen = document.getElementById("startScreen");
const gameOverScreen = document.getElementById("gameOver");
const upgradePanel = document.getElementById("upgradePanel");

let width, height;
let running = false;
let gameOver = false;
let pausedForUpgrade = false;
let lastTime = 0;
let score = 0;
let level = 1;
let xp = 0;
let xpNeeded = 10;
let camera = { x: 0, y: 0 };
let mouse = { x: 0, y: 0, down: false };
let keys = {};
let enemies = [];
let bullets = [];
let shapes = [];
let particles = [];
let nextEnemyId = 0;
let spawnTimer = 0;
let shapeTimer = 0;

const WORLD = { width: 3200, height: 3200 };

const player = {
  x: WORLD.width / 2,
  y: WORLD.height / 2,
  radius: 23,
  angle: 0,
  speed: 245,
  maxHealth: 100,
  health: 100,
  damage: 22,
  fireDelay: 0.22,
  fireTimer: 0,
  bulletSpeed: 650,
  xp: 0,
  level: 1,
  invulnerable: 0
};

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener("resize", resize);
resize();

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function resetGame() {
  score = 0;
  level = 1;
  xp = 0;
  xpNeeded = 10;
  enemies = [];
  bullets = [];
  shapes = [];
  particles = [];
  spawnTimer = 0;
  shapeTimer = 0;
  nextEnemyId = 0;
  gameOver = false;
  pausedForUpgrade = false;

  Object.assign(player, {
    x: WORLD.width / 2,
    y: WORLD.height / 2,
    radius: 23,
    angle: 0,
    speed: 245,
    maxHealth: 100,
    health: 100,
    damage: 22,
    fireDelay: 0.22,
    fireTimer: 0,
    bulletSpeed: 650,
    xp: 0,
    level: 1,
    invulnerable: 1.5
  });

  camera.x = player.x - width / 2;
  camera.y = player.y - height / 2;

  for (let i = 0; i < 18; i++) spawnShape();
  for (let i = 0; i < 7; i++) spawnEnemy();

  updateHUD();
}

function updateHUD() {
  levelText.textContent = "Level " + player.level;
  scoreText.textContent = "Score: " + score;
  healthText.textContent =
    "HP: " + Math.ceil(player.health) + "/" + player.maxHealth;
}

function randomWorldPosition(minDistance = 400) {
  let x, y;
  let attempts = 0;

  do {
    x = rand(100, WORLD.width - 100);
    y = rand(100, WORLD.height - 100);
    attempts++;
  } while (
    Math.hypot(x - player.x, y - player.y) < minDistance &&
    attempts < 40
  );

  return { x, y };
}

function spawnEnemy() {
  const pos = randomWorldPosition(550);
  const tier = Math.random();

  const enemy = {
    id: nextEnemyId++,
    x: pos.x,
    y: pos.y,
    radius: tier > 0.82 ? 29 : 21,
    health: tier > 0.82 ? 100 : 48,
    maxHealth: tier > 0.82 ? 100 : 48,
    speed: tier > 0.82 ? 100 : rand(115, 165),
    damage: tier > 0.82 ? 18 : 10,
    angle: 0,
    fireTimer: rand(0.5, 2),
    fireDelay: tier > 0.82 ? 1.1 : rand(1.3, 2.2),
    bulletSpeed: 350,
    color: tier > 0.82 ? "#d85bff" : "#ff5a62",
    xpValue: tier > 0.82 ? 5 : 2,
    contactTimer: 0
  };

  enemies.push(enemy);
}

function spawnShape() {
  const pos = randomWorldPosition(100);
  const type = Math.random();

  shapes.push({
    x: pos.x,
    y: pos.y,
    radius: type > 0.88 ? 20 : type > 0.62 ? 15 : 11,
    type: type > 0.88 ? "pentagon" : type > 0.62 ? "triangle" : "square",
    rotation: rand(0, Math.PI * 2),
    color: type > 0.88 ? "#c48aff" : type > 0.62 ? "#ffcf58" : "#55d8ff",
    xpValue: type > 0.88 ? 5 : type > 0.62 ? 3 : 1
  });
}

function addXP(amount) {
  xp += amount;
  score += amount * 10;

  while (xp >= xpNeeded) {
    xp -= xpNeeded;
    player.level++;
    level = player.level;
    xpNeeded = Math.ceil(xpNeeded * 1.35);
    pausedForUpgrade = true;
    upgradePanel.classList.remove("hidden");
  }

  updateHUD();
}

function chooseUpgrade(type) {
  if (!pausedForUpgrade) return;

  if (type === "damage") {
    player.damage += 7;
  } else if (type === "speed") {
    player.speed += 25;
  } else if (type === "health") {
    player.maxHealth += 25;
    player.health = Math.min(
      player.maxHealth,
      player.health + 35
    );
  } else if (type === "fire") {
    player.fireDelay = Math.max(0.07, player.fireDelay * 0.82);
  }

  pausedForUpgrade = false;
  upgradePanel.classList.add("hidden");
  updateHUD();
}

document.querySelectorAll("[data-upgrade]").forEach(button => {
  button.addEventListener("click", () => {
    chooseUpgrade(button.dataset.upgrade);
  });
});

function shoot(owner, targetAngle, isEnemy = false) {
  const muzzle = owner.radius + 13;

  bullets.push({
    x: owner.x + Math.cos(targetAngle) * muzzle,
    y: owner.y + Math.sin(targetAngle) * muzzle,
    vx: Math.cos(targetAngle) * (owner.bulletSpeed || 600),
    vy: Math.sin(targetAngle) * (owner.bulletSpeed || 600),
    radius: isEnemy ? 6 : 7,
    damage: isEnemy ? owner.damage : player.damage,
    life: 1.8,
    enemy: isEnemy,
    color: isEnemy ? "#ff777d" : "#b8f5ff"
  });

  if (!isEnemy) {
    particles.push({
      x: owner.x + Math.cos(targetAngle) * muzzle,
      y: owner.y + Math.sin(targetAngle) * muzzle,
      vx: Math.cos(targetAngle) * 90,
      vy: Math.sin(targetAngle) * 90,
      life: 0.12,
      color: "#fff3b0",
      size: 8
    });
  }
}

function destroyEnemy(index) {
  const enemy = enemies[index];
  if (!enemy) return;

  for (let i = 0; i < 12; i++) {
    particles.push({
      x: enemy.x,
      y: enemy.y,
      vx: rand(-180, 180),
      vy: rand(-180, 180),
      life: rand(0.2, 0.7),
      color: enemy.color,
      size: rand(3, 8)
    });
  }

  addXP(enemy.xpValue);
  enemies.splice(index, 1);
}

function hurtPlayer(amount) {
  if (player.invulnerable > 0 || gameOver) return;

  player.health -= amount;
  player.invulnerable = 0.2;
  updateHUD();

  if (player.health <= 0) {
    player.health = 0;
    gameOver = true;
    running = false;
    document.getElementById("finalScore").textContent =
      "Score: " + score + " · Level " + player.level;
    gameOverScreen.classList.remove("hidden");
  }
}

function update(dt) {
  if (!running || gameOver || pausedForUpgrade) return;

  player.invulnerable = Math.max(0, player.invulnerable - dt);

  let dx = 0;
  let dy = 0;

  if (keys.KeyW || keys.ArrowUp) dy--;
  if (keys.KeyS || keys.ArrowDown) dy++;
  if (keys.KeyA || keys.ArrowLeft) dx--;
  if (keys.KeyD || keys.ArrowRight) dx++;

  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy);
    dx /= len;
    dy /= len;
  }

  player.x = clamp(
    player.x + dx * player.speed * dt,
    player.radius,
    WORLD.width - player.radius
  );

  player.y = clamp(
    player.y + dy * player.speed * dt,
    player.radius,
    WORLD.height - player.radius
  );

  const worldMouseX = mouse.x + camera.x;
  const worldMouseY = mouse.y + camera.y;

  player.angle = Math.atan2(
    worldMouseY - player.y,
    worldMouseX - player.x
  );

  player.fireTimer -= dt;

  if ((mouse.down || keys.Space) && player.fireTimer <= 0) {
    shoot(player, player.angle);
    player.fireTimer = player.fireDelay;
  }

  // Move camera toward the player.
  camera.x += (player.x - width / 2 - camera.x) * Math.min(1, dt * 5);
  camera.y += (player.y - height / 2 - camera.y) * Math.min(1, dt * 5);

  camera.x = clamp(camera.x, 0, WORLD.width - width);
  camera.y = clamp(camera.y, 0, WORLD.height - height);

  // Enemy AI.
  spawnTimer -= dt;

  if (spawnTimer <= 0 && enemies.length < 18) {
    spawnEnemy();
    spawnTimer = 1.8;
  }

  for (const enemy of enemies) {
    const d = distance(enemy, player);
    enemy.angle = Math.atan2(
      player.y - enemy.y,
      player.x - enemy.x
    );

    if (d > 190) {
      enemy.x += Math.cos(enemy.angle) * enemy.speed * dt;
      enemy.y += Math.sin(enemy.angle) * enemy.speed * dt;
    } else if (d < 125) {
      enemy.x -= Math.cos(enemy.angle) * enemy.speed * 0.6 * dt;
      enemy.y -= Math.sin(enemy.angle) * enemy.speed * 0.6 * dt;
    }

    enemy.fireTimer -= dt;

    if (d < 620 && enemy.fireTimer <= 0) {
      shoot(enemy, enemy.angle, true);
      enemy.fireTimer = enemy.fireDelay;
    }

    enemy.contactTimer -= dt;

    if (d < enemy.radius + player.radius && enemy.contactTimer <= 0) {
      hurtPlayer(enemy.damage);
      enemy.contactTimer = 0.6;
    }

    enemy.x = clamp(enemy.x, enemy.radius, WORLD.width - enemy.radius);
    enemy.y = clamp(enemy.y, enemy.radius, WORLD.height - enemy.radius);
  }

  // Bullets.
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];

    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;

    if (
      bullet.life <= 0 ||
      bullet.x < 0 || bullet.x > WORLD.width ||
      bullet.y < 0 || bullet.y > WORLD.height
    ) {
      bullets.splice(i, 1);
      continue;
    }

    if (bullet.enemy) {
      if (distance(bullet, player) < bullet.radius + player.radius) {
        hurtPlayer(bullet.damage);
        bullets.splice(i, 1);
      }
    } else {
      let hit = false;

      for (let j = enemies.length - 1; j >= 0; j--) {
        const enemy = enemies[j];

        if (distance(bullet, enemy) < bullet.radius + enemy.radius) {
          enemy.health -= bullet.damage;

          particles.push({
            x: bullet.x,
            y: bullet.y,
            vx: rand(-40, 40),
            vy: rand(-40, 40),
            life: 0.2,
            color: "#ffffff",
            size: 4
          });

          bullets.splice(i, 1);
          hit = true;

          if (enemy.health <= 0) {
            destroyEnemy(j);
          }

          break;
        }
      }

      if (hit) continue;
    }
  }

  // Collect shapes.
  for (let i = shapes.length - 1; i >= 0; i--) {
    const shape = shapes[i];

    if (distance(player, shape) < player.radius + shape.radius) {
      addXP(shape.xpValue);
      particles.push({
        x: shape.x,
        y: shape.y,
        vx: 0,
        vy: -40,
        life: 0.3,
        color: shape.color,
        size: 10
      });
      shapes.splice(i, 1);
    }
  }

  shapeTimer -= dt;

  if (shapeTimer <= 0 && shapes.length < 65) {
    spawnShape();
    shapeTimer = 0.3;
  }

  // Particles.
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    p.vx *= 0.98;
    p.vy *= 0.98;

    if (p.life <= 0) particles.splice(i, 1);
  }

  updateHUD();
}

function drawGrid() {
  ctx.fillStyle = "#18232e";
  ctx.fillRect(0, 0, width, height);

  const gridSize = 50;
  const startX = -(camera.x % gridSize);
  const startY = -(camera.y % gridSize);

  ctx.strokeStyle = "#263543";
  ctx.lineWidth = 1;

  ctx.beginPath();

  for (let x = startX; x < width; x += gridSize) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }

  for (let y = startY; y < height; y += gridSize) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }

  ctx.stroke();

  // World boundary.
  ctx.strokeStyle = "#536779";
  ctx.lineWidth = 4;
  ctx.strokeRect(
    -camera.x,
    -camera.y,
    WORLD.width,
    WORLD.height
  );
}

function worldToScreen(obj) {
  return {
    x: obj.x - camera.x,
    y: obj.y - camera.y
  };
}

function drawTank(tank, isPlayer = false) {
  const pos = worldToScreen(tank);

  if (
    pos.x < -100 || pos.x > width + 100 ||
    pos.y < -100 || pos.y > height + 100
  ) return;

  ctx.save();
  ctx.translate(pos.x, pos.y);

  // Player invulnerability flicker.
  if (isPlayer && player.invulnerable > 0 &&
      Math.floor(performance.now() / 90) % 2 === 0) {
    ctx.globalAlpha = 0.45;
  }

  // Gun barrel.
  ctx.rotate(tank.angle);

  ctx.fillStyle = isPlayer ? "#7e8998" : "#9c555b";
  ctx.fillRect(0, -7, tank.radius + 23, 14);

  ctx.fillStyle = isPlayer ? "#aab7c6" : "#e37a80";
  ctx.fillRect(tank.radius - 3, -5, 19, 10);

  ctx.rotate(-tank.angle);

  // Tank body.
  ctx.fillStyle = isPlayer ? "#49c8e7" : tank.color;
  ctx.beginPath();
  ctx.arc(0, 0, tank.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = isPlayer ? "#c2f5ff" : "#ffd0d2";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = isPlayer ? "#14718d" : "#812c39";
  ctx.beginPath();
  ctx.arc(0, 0, tank.radius * 0.54, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  if (!isPlayer) {
    const barWidth = tank.radius * 2.2;
    const barY = pos.y - tank.radius - 13;

    ctx.fillStyle = "#381d27";
    ctx.fillRect(pos.x - barWidth / 2, barY, barWidth, 5);

    ctx.fillStyle = "#ff5c68";
    ctx.fillRect(
      pos.x - barWidth / 2,
      barY,
      barWidth * Math.max(0, tank.health / tank.maxHealth),
      5
    );
  }
}

function drawShapes() {
  for (const shape of shapes) {
    const pos = worldToScreen(shape);

    if (
      pos.x < -40 || pos.x > width + 40 ||
      pos.y < -40 || pos.y > height + 40
    ) continue;

    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(shape.rotation + performance.now() * 0.0004);

    ctx.fillStyle = shape.color;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;

    ctx.beginPath();

    if (shape.type === "square") {
      ctx.rect(
        -shape.radius,
        -shape.radius,
        shape.radius * 2,
        shape.radius * 2
      );
    } else {
      const sides = shape.type === "triangle" ? 3 : 5;

      for (let i = 0; i < sides; i++) {
        const angle = i * Math.PI * 2 / sides - Math.PI / 2;
        const x = Math.cos(angle) * shape.radius;
        const y = Math.sin(angle) * shape.radius;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.closePath();
    }

    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function drawBullets() {
  for (const bullet of bullets) {
    const pos = worldToScreen(bullet);

    ctx.fillStyle = bullet.color;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawParticles() {
  for (const p of particles) {
    const pos = worldToScreen(p);

    ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
    ctx.fillStyle = p.color;
    ctx.fillRect(pos.x, pos.y, p.size, p.size);
  }

  ctx.globalAlpha = 1;
}

function drawXPBar() {
  const barWidth = Math.min(440, width * 0.65);
  const barHeight = 10;
  const x = (width - barWidth) / 2;
  const y = height - 27;

  ctx.fillStyle = "#263543";
  ctx.fillRect(x, y, barWidth, barHeight);

  ctx.fillStyle = "#55d8ff";
  ctx.fillRect(
    x,
    y,
    barWidth * Math.min(1, xp / xpNeeded),
    barHeight
  );

  ctx.strokeStyle = "#b4eaff";
  ctx.strokeRect(x, y, barWidth, barHeight);
}

function drawMinimap() {
  const mapW = 120;
  const mapH = 120;
  const x = width - mapW - 18;
  const y = 80;

  ctx.fillStyle = "rgba(7, 13, 20, 0.75)";
  ctx.fillRect(x, y, mapW, mapH);

  ctx.strokeStyle = "#738a9c";
  ctx.strokeRect(x, y, mapW, mapH);

  for (const enemy of enemies) {
    ctx.fillStyle = "#ff5a62";
    ctx.fillRect(
      x + enemy.x / WORLD.width * mapW - 2,
      y + enemy.y / WORLD.height * mapH - 2,
      4,
      4
    );
  }

  ctx.fillStyle = "#55e8ff";
  ctx.beginPath();
  ctx.arc(
    x + player.x / WORLD.width * mapW,
    y + player.y / WORLD.height * mapH,
    4,
    0,
    Math.PI * 2
  );
  ctx.fill();
}

function draw() {
  drawGrid();
  drawShapes();
  drawBullets();

  for (const enemy of enemies) {
    drawTank(enemy, false);
  }

  drawTank(player, true);
  drawParticles();
  drawXPBar();
  drawMinimap();
}

function loop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000 || 0, 0.033);
  lastTime = timestamp;

  update(dt);
  draw();

  requestAnimationFrame(loop);
}

// Mouse aiming and shooting.
canvas.addEventListener("mousemove", event => {
  const rect = canvas.getBoundingClientRect();

  mouse.x = event.clientX - rect.left;
  mouse.y = event.clientY - rect.top;
});

canvas.addEventListener("mousedown", event => {
  if (event.button === 0) mouse.down = true;
});

window.addEventListener("mouseup", () => {
  mouse.down = false;
});

canvas.addEventListener("contextmenu", event => {
  event.preventDefault();
});

// Keyboard movement.
window.addEventListener("keydown", event => {
  keys[event.code] = true;

  if (
    ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)
  ) {
    event.preventDefault();
  }
});

window.addEventListener("keyup", event => {
  keys[event.code] = false;
});

window.addEventListener("blur", () => {
  keys = {};
  mouse.down = false;
});

document.getElementById("playBtn").addEventListener("click", () => {
  resetGame();
  running = true;
  startScreen.classList.add("hidden");
  gameOverScreen.classList.add("hidden");
  lastTime = performance.now();
});

document.getElementById("againBtn").addEventListener("click", () => {
  resetGame();
  running = true;
  gameOverScreen.classList.add("hidden");
  lastTime = performance.now();
});

document.addEventListener("visibilitychange", () => {
  lastTime = performance.now();
});

resetGame();
running = false;
requestAnimationFrame(loop);
