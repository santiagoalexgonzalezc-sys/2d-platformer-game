// Canvas Setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Camera object
const camera = {
    x: 0,
    y: 0,
    width: canvas.width,
    height: canvas.height,
    shakeX: 0,
    shakeY: 0,
    shakeIntensity: 0
};

// Game States
const gameStates = {
    START: 'start',
    MENU: 'menu',
    LEVEL_SELECT: 'levelSelect',
    SETTINGS: 'settings',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAME_OVER: 'gameOver'
};

let currentState = gameStates.START;
let currentDifficulty = 'medium';
let currentLevel = 1;

// Settings
const settings = {
    volume: localStorage.getItem('volume') || 0.5,
    graphicsQuality: localStorage.getItem('graphicsQuality') || 'high',
    keyBindings: JSON.parse(localStorage.getItem('keyBindings')) || {
        jump: 'w',
        left: 'a',
        right: 'd',
        pause: 'escape'
    }
};

// Difficulty settings
const difficultyConfig = {
    easy: {
        platformCount: 15,
        enemyChance: 0.05,
        powerUpChance: 0.15,
        platformSpacing: 60,
        platformHeightVar: 15
    },
    medium: {
        platformCount: 24,
        enemyChance: 0.15,
        powerUpChance: 0.08,
        platformSpacing: 40,
        platformHeightVar: 30
    },
    hard: {
        platformCount: 30,
        enemyChance: 0.25,
        powerUpChance: 0.05,
        platformSpacing: 30,
        platformHeightVar: 40
    }
};

// Player Object
const player = {
    x: 0,
    y: 0,
    width: 30,
    height: 40,
    velocityY: 0,
    velocityX: 0,
    jumping: false,
    onGround: false,
    color: '#ff6b6b',
    doubleJumpAvailable: false,
    speedBoostActive: false,
    speedBoostTimer: 0,
    invincibleTimer: 0
};

// Physics
const gravity = 0.6;
const jumpPower = -15;
const moveSpeed = 5;
const maxSpeed = 8;
const boostedSpeed = 12;

// Input Handling
const keys = {};

window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    keys[key] = true;
    
    // Pause toggle
    if (key === settings.keyBindings.pause && currentState === gameStates.PLAYING) {
        pauseGame();
    } else if (key === settings.keyBindings.pause && currentState === gameStates.PAUSED) {
        resumeGame();
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
});

// Game Variables
let platforms = [];
let collectibles = [];
let enemies = [];
let particles = [];
let powerUps = [];
let checkpoints = [];
let firstPlatformPos = { x: 0, y: 0 };
let gameScore = 0;
let deathCounter = 0;
let bestTime = localStorage.getItem('bestTime') || null;
let gameStartTime = 0;
let gameDuration = 0;
let leaderboard = JSON.parse(localStorage.getItem('leaderboard')) || [];
let currentCheckpoint = null;

// Platform Types
const platformTypes = {
    NORMAL: 'normal',
    MOVING: 'moving',
    CRUMBLING: 'crumbling',
    BOUNCY: 'bouncy',
    ICE: 'ice',
    ROTATING: 'rotating'
};

// Power-up Types
const powerUpTypes = {
    DOUBLE_JUMP: 'doubleJump',
    SPEED_BOOST: 'speedBoost',
    INVINCIBILITY: 'invincibility'
};

// Screen Shake function
function screenShake(intensity = 5, duration = 10) {
    camera.shakeIntensity = intensity;
    camera.shakeTimer = duration;
}

// Update screen shake
function updateScreenShake() {
    if (camera.shakeTimer && camera.shakeTimer > 0) {
        camera.shakeX = (Math.random() - 0.5) * camera.shakeIntensity;
        camera.shakeY = (Math.random() - 0.5) * camera.shakeIntensity;
        camera.shakeTimer--;
    } else {
        camera.shakeX = 0;
        camera.shakeY = 0;
        camera.shakeIntensity = 0;
    }
}

// Particle System
class Particle {
    constructor(x, y, vx, vy, color, life) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.life = life;
        this.maxLife = life;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.2;
        this.life--;
    }

    draw() {
        const alpha = this.life / this.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - camera.x + camera.shakeX, this.y - camera.y + camera.shakeY, 5, 5);
        ctx.globalAlpha = 1;
    }
}

// Collectible Class
class Collectible {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 8;
        this.collected = false;
        this.rotation = 0;
    }

    update() {
        this.rotation += 0.05;
        
        const dx = (this.x + this.radius) - (player.x + player.width / 2);
        const dy = (this.y + this.radius) - (player.y + player.height / 2);
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < this.radius + player.width / 2) {
            this.collected = true;
            gameScore += 10;
            createParticles(this.x, this.y, '#FFD700', 8);
        }
    }

    draw() {
        if (this.collected) return;
        
        const screenX = this.x - camera.x + camera.shakeX;
        const screenY = this.y - camera.y + camera.shakeY;

        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(this.rotation);
        
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
            const x = Math.cos(angle) * this.radius;
            const y = Math.sin(angle) * this.radius;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
    }
}

// Enemy Class
class Enemy {
    constructor(x, y, width = 30, height = 30, moveRange = 100) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.moveRange = moveRange;
        this.startX = x;
        this.velocityX = 2;
        this.color = '#E74C3C';
    }

    update() {
        this.x += this.velocityX;
        
        if (this.x - this.startX > this.moveRange || this.x - this.startX < 0) {
            this.velocityX *= -1;
        }

        if (!player.invincibleTimer > 0 &&
            player.x + player.width > this.x &&
            player.x < this.x + this.width &&
            player.y + player.height > this.y &&
            player.y < this.y + this.height) {
            resetToLastCheckpoint();
            screenShake(8, 15);
        }
    }

    draw() {
        const screenX = this.x - camera.x + camera.shakeX;
        const screenY = this.y - camera.y + camera.shakeY;

        if (screenX + this.width > 0 && screenX < canvas.width &&
            screenY + this.height > 0 && screenY < canvas.height) {
            
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.moveTo(screenX, screenY + this.height);
            ctx.lineTo(screenX + this.width / 2, screenY);
            ctx.lineTo(screenX + this.width, screenY + this.height);
            ctx.closePath();
            ctx.fill();
        }
    }
}

// Power-up Class
class PowerUp {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.radius = 12;
        this.collected = false;
        this.rotation = 0;
    }

    update() {
        this.rotation += 0.05;
        this.y -= 1;

        const dx = (this.x + this.radius) - (player.x + player.width / 2);
        const dy = (this.y + this.radius) - (player.y + player.height / 2);
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < this.radius + player.width / 2) {
            this.collected = true;
            activatePowerUp(this.type);
            createParticles(this.x, this.y, '#00FF00', 15);
        }
    }

    draw() {
        if (this.collected) return;

        const screenX = this.x - camera.x + camera.shakeX;
        const screenY = this.y - camera.y + camera.shakeY;

        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(this.rotation);

        ctx.fillStyle = this.getColor();
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'white';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const letter = this.type === powerUpTypes.DOUBLE_JUMP ? 'J' : 
                       this.type === powerUpTypes.SPEED_BOOST ? 'S' : 'I';
        ctx.fillText(letter, 0, 0);

        ctx.restore();
    }

    getColor() {
        switch(this.type) {
            case powerUpTypes.DOUBLE_JUMP: return '#3498DB';
            case powerUpTypes.SPEED_BOOST: return '#E67E22';
            case powerUpTypes.INVINCIBILITY: return '#9B59B6';
            default: return '#2ECC71';
        }
    }
}

// Checkpoint Class
class Checkpoint {
    constructor(x, y, platformNumber) {
        this.x = x;
        this.y = y;
        this.platformNumber = platformNumber;
        this.radius = 20;
        this.active = false;
    }

    update() {
        const dx = (this.x + this.radius) - (player.x + player.width / 2);
        const dy = (this.y + this.radius) - (player.y + player.height / 2);
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < this.radius + player.width / 2) {
            currentCheckpoint = {
                x: player.x,
                y: player.y,
                platformNumber: this.platformNumber
            };
            this.active = true;
            createParticles(this.x, this.y, '#00FF00', 20);
        }
    }

    draw() {
        const screenX = this.x - camera.x + camera.shakeX;
        const screenY = this.y - camera.y + camera.shakeY;

        if (screenX + this.radius * 2 > 0 && screenX < canvas.width &&
            screenY + this.radius * 2 > 0 && screenY < canvas.height) {
            
            ctx.fillStyle = this.active ? '#2ECC71' : '#27AE60';
            ctx.beginPath();
            ctx.arc(screenX, screenY, this.radius, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = 'white';
            ctx.lineWidth = 3;
            ctx.stroke();

            ctx.fillStyle = 'white';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('✓', screenX, screenY);
        }
    }
}

// Rotating Platform Class
class RotatingPlatform {
    constructor(x, y, width, height, rotationSpeed = 0.02) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.rotation = 0;
        this.rotationSpeed = rotationSpeed;
        this.color = '#9C27B0';
    }

    update() {
        this.rotation += this.rotationSpeed;
    }

    draw() {
        const screenX = this.x - camera.x + camera.shakeX;
        const screenY = this.y - camera.y + camera.shakeY;

        if (screenX + this.width > 0 && screenX < canvas.width &&
            screenY + this.height > 0 && screenY < canvas.height) {
            
            ctx.save();
            ctx.translate(screenX + this.width / 2, screenY + this.height / 2);
            ctx.rotate(this.rotation);

            ctx.fillStyle = this.color;
            ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);

            ctx.strokeStyle = '#FFB700';
            ctx.lineWidth = 2;
            ctx.strokeRect(-this.width / 2, -this.height / 2, this.width, this.height);

            ctx.restore();
        }
    }

    checkCollision(player) {
        // Simplified collision for rotating platforms
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        
        return dx > -this.width && dx < player.width &&
               dy > -this.height && dy < player.height + 10;
    }
}

// Activate Power-up
function activatePowerUp(type) {
    switch(type) {
        case powerUpTypes.DOUBLE_JUMP:
            player.doubleJumpAvailable = true;
            break;
        case powerUpTypes.SPEED_BOOST:
            player.speedBoostActive = true;
            player.speedBoostTimer = 300;
            break;
        case powerUpTypes.INVINCIBILITY:
            player.invincibleTimer = 300;
            break;
    }
}

// Create particles
function createParticles(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        const vx = Math.cos(angle) * 3;
        const vy = Math.sin(angle) * 3;
        particles.push(new Particle(x, y, vx, vy, color, 30));
    }
}

// Initialize Platforms based on difficulty
function initPlatforms() {
    platforms = [];
    collectibles = [];
    enemies = [];
    powerUps = [];
    checkpoints = [];
    gameScore = 0;
    gameStartTime = Date.now();
    currentCheckpoint = null;

    const config = difficultyConfig[currentDifficulty];
    const platformWidth = 150;
    const platformHeight = 30;
    const baseY = canvas.height - 150;

    // Platform 1 (start)
    platforms.push({
        x: 100,
        y: baseY,
        width: platformWidth,
        height: platformHeight,
        color: '#4CAF50',
        number: 1,
        isFinal: false,
        type: platformTypes.NORMAL
    });

    firstPlatformPos = { x: 100, y: baseY };

    let currentX = 100 + platformWidth + 50;
    let currentY = baseY;

    // Platforms 2 to platformCount
    for (let i = 2; i <= config.platformCount; i++) {
        const heightVariation = Math.random();
        let newY;

        if (heightVariation < 0.4) {
            newY = currentY - (20 + Math.random() * config.platformHeightVar);
        } else if (heightVariation < 0.7) {
            newY = currentY + (Math.random() * config.platformHeightVar);
        } else {
            newY = currentY + (Math.random() * config.platformHeightVar / 2 - config.platformHeightVar / 4);
        }

        newY = Math.max(100, Math.min(baseY, newY));
        currentY = newY;
        currentX += platformWidth + (config.platformSpacing + Math.random() * 20);

        const typeRoll = Math.random();
        let platformType = platformTypes.NORMAL;
        let platformColor = `hsl(${Math.random() * 360}, 70%, 50%)`;

        if (typeRoll < 0.12) {
            platformType = platformTypes.MOVING;
            platformColor = '#FF9800';
        } else if (typeRoll < 0.22) {
            platformType = platformTypes.CRUMBLING;
            platformColor = '#8B4513';
        } else if (typeRoll < 0.32) {
            platformType = platformTypes.BOUNCY;
            platformColor = '#E91E63';
        } else if (typeRoll < 0.42) {
            platformType = platformTypes.ICE;
            platformColor = '#87CEEB';
        } else if (typeRoll < 0.50) {
            platformType = platformTypes.ROTATING;
            platformColor = '#9C27B0';
        }

        const platform = {
            x: currentX,
            y: newY,
            width: platformWidth,
            height: platformHeight,
            color: platformColor,
            number: i,
            isFinal: false,
            type: platformType,
            velocityX: platformType === platformTypes.MOVING ? 2 : 0,
            moveRange: platformType === platformTypes.MOVING ? 80 : 0,
            startX: currentX,
            crumbleTimer: platformType === platformTypes.CRUMBLING ? 0 : null,
            isCrumbled: false,
            rotatingPlatform: platformType === platformTypes.ROTATING ? new RotatingPlatform(currentX, newY, platformWidth, platformHeight) : null
        };

        platforms.push(platform);

        // Add checkpoints every 5 platforms
        if (i % 5 === 0) {
            checkpoints.push(new Checkpoint(currentX + platformWidth / 2, newY - 50, i));
        }

        // Add collectibles based on difficulty
        if (Math.random() < 0.4) {
            collectibles.push(new Collectible(currentX + platformWidth / 2, newY - 30));
        }

        // Add enemies based on difficulty
        if (Math.random() < config.enemyChance) {
            enemies.push(new Enemy(currentX, newY - 40, 25, 25, 80));
        }

        // Add power-ups based on difficulty
        if (Math.random() < config.powerUpChance) {
            const powerUpType = [powerUpTypes.DOUBLE_JUMP, powerUpTypes.SPEED_BOOST, powerUpTypes.INVINCIBILITY][
                Math.floor(Math.random() * 3)
            ];
            powerUps.push(new PowerUp(currentX + platformWidth / 2, newY - 50, powerUpType));
        }
    }

    // Final platform
    currentX += platformWidth + 50;
    platforms.push({
        x: currentX,
        y: baseY,
        width: platformWidth,
        height: platformHeight,
        color: '#FFD700',
        number: config.platformCount + 1,
        isFinal: true,
        type: platformTypes.NORMAL
    });
}

// Initialize Game
function initGame() {
    initPlatforms();
    player.x = platforms[0].x + platforms[0].width / 2 - player.width / 2;
    player.y = platforms[0].y - player.height;
    player.velocityY = 0;
    player.velocityX = 0;
    player.jumping = false;
    player.onGround = false;
    player.doubleJumpAvailable = false;
    player.speedBoostActive = false;
    player.speedBoostTimer = 0;
    player.invincibleTimer = 0;
    camera.x = 0;
    camera.y = 0;
    deathCounter = 0;
}

// Reset Player to Last Checkpoint
function resetToLastCheckpoint() {
    deathCounter++;
    if (currentCheckpoint) {
        player.x = currentCheckpoint.x;
        player.y = currentCheckpoint.y;
    } else {
        player.x = platforms[0].x + platforms[0].width / 2 - player.width / 2;
        player.y = platforms[0].y - player.height;
    }
    player.velocityY = 0;
    player.velocityX = 0;
    player.doubleJumpAvailable = false;
    player.speedBoostActive = false;
    player.speedBoostTimer = 0;
    player.invincibleTimer = 0;
}

// Update Camera
function updateCamera() {
    const targetCameraX = player.x - canvas.width / 4;
    const targetCameraY = player.y - canvas.height / 3;

    camera.x += (targetCameraX - camera.x) * 0.1;
    camera.y += (targetCameraY - camera.y) * 0.1;

    const maxCameraX = platforms[platforms.length - 1].x + platforms[platforms.length - 1].width - canvas.width;
    camera.x = Math.max(0, Math.min(camera.x, maxCameraX));
    camera.y = Math.max(0, Math.min(camera.y, 500));
}

// Update Player Physics
function updatePlayer() {
    let moveDirection = 0;
    if (keys[settings.keyBindings.left]) moveDirection = -1;
    if (keys[settings.keyBindings.right]) moveDirection = 1;

    const currentMaxSpeed = player.speedBoostActive ? boostedSpeed : maxSpeed;
    const currentMoveSpeed = player.speedBoostActive ? moveSpeed + 2 : moveSpeed;

    if (moveDirection !== 0) {
        player.velocityX = moveDirection * currentMoveSpeed;
    } else {
        player.velocityX *= 0.85;
    }

    if (Math.abs(player.velocityX) > currentMaxSpeed) {
        player.velocityX = Math.sign(player.velocityX) * currentMaxSpeed;
    }

    player.x += player.velocityX;

    player.velocityY += gravity;
    player.y += player.velocityY;

    if (keys[settings.keyBindings.jump] && player.onGround) {
        player.velocityY = jumpPower;
        player.onGround = false;
        player.doubleJumpAvailable = true;
        screenShake(3, 8);
    } else if (keys[settings.keyBindings.jump] && player.doubleJumpAvailable && !player.onGround) {
        player.velocityY = jumpPower;
        player.doubleJumpAvailable = false;
        screenShake(3, 8);
    }

    if (player.speedBoostActive) {
        player.speedBoostTimer--;
        if (player.speedBoostTimer <= 0) {
            player.speedBoostActive = false;
        }
    }

    if (player.invincibleTimer > 0) {
        player.invincibleTimer--;
    }

    // Platform collisions
    player.onGround = false;
    platforms.forEach((platform) => {
        if (platform.isCrumbled) return;

        let collided = false;
        if (platform.type === platformTypes.ROTATING && platform.rotatingPlatform) {
            collided = platform.rotatingPlatform.checkCollision(player);
        } else {
            collided = (
                player.x + player.width > platform.x &&
                player.x < platform.x + platform.width &&
                player.y + player.height >= platform.y &&
                player.y + player.height <= platform.y + platform.height + 5 &&
                player.velocityY >= 0
            );
        }

        if (collided) {
            player.y = platform.y - player.height;
            player.velocityY = 0;
            player.onGround = true;
            player.doubleJumpAvailable = false;

            if (platform.type === platformTypes.BOUNCY) {
                player.velocityY = jumpPower * 1.5;
                createParticles(player.x, player.y, '#E91E63', 10);
                screenShake(4, 10);
            }

            if (platform.type === platformTypes.CRUMBLING) {
                platform.crumbleTimer = 60;
            }

            if (platform.isFinal) {
                endGame();
            }
        }
    });

    // Crumbling platforms
    platforms.forEach((platform) => {
        if (platform.type === platformTypes.CRUMBLING && platform.crumbleTimer !== null) {
            platform.crumbleTimer--;
            if (platform.crumbleTimer <= 0 && player.onGround === false) {
                platform.isCrumbled = true;
                platform.crumbleTimer = 300;
            } else if (platform.isCrumbled && platform.crumbleTimer <= 0) {
                platform.isCrumbled = false;
                platform.crumbleTimer = 0;
            }
        }
    });

    // Ice platform friction
    platforms.forEach((platform) => {
        if (player.onGround && platform.type === platformTypes.ICE &&
            player.x + player.width > platform.x &&
            player.x < platform.x + platform.width) {
            player.velocityX *= 0.95;
        }
    });

    if (player.y > canvas.height + 200) {
        resetToLastCheckpoint();
    }

    if (player.x + player.width < -50) {
        resetToLastCheckpoint();
    }
}

// Update moving platforms
function updateMovingPlatforms() {
    platforms.forEach((platform) => {
        if (platform.type === platformTypes.MOVING) {
            platform.x += platform.velocityX;

            if (platform.x - platform.startX > platform.moveRange || platform.x - platform.startX < 0) {
                platform.velocityX *= -1;
            }

            if (player.onGround &&
                player.x + player.width > platform.x &&
                player.x < platform.x + platform.width &&
                player.y + player.height >= platform.y &&
                player.y + player.height <= platform.y + platform.height + 5) {
                player.x += platform.velocityX;
            }
        }

        if (platform.type === platformTypes.ROTATING && platform.rotatingPlatform) {
            platform.rotatingPlatform.update();
        }
    });
}

// Draw Player
function drawPlayer() {
    const screenX = player.x - camera.x + camera.shakeX;
    const screenY = player.y - camera.y + camera.shakeY;

    if (player.invincibleTimer > 0) {
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(screenX + player.width / 2, screenY + player.height / 2, player.width, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    ctx.fillStyle = player.color;
    ctx.fillRect(screenX, screenY, player.width, player.height);

    ctx.fillStyle = 'white';
    ctx.fillRect(screenX + 8, screenY + 10, 6, 8);
    ctx.fillRect(screenX + 16, screenY + 10, 6, 8);

    ctx.fillStyle = 'black';
    ctx.fillRect(screenX + 9, screenY + 11, 4, 4);
    ctx.fillRect(screenX + 17, screenY + 11, 4, 4);

    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(screenX + 15, screenY + 25, 5, 0, Math.PI);
    ctx.stroke();

    if (player.speedBoostActive) {
        ctx.strokeStyle = '#E67E22';
        ctx.lineWidth = 2;
        ctx.strokeRect(screenX - 3, screenY - 3, player.width + 6, player.height + 6);
    }
}

// Draw Platforms
function drawPlatforms() {
    platforms.forEach((platform) => {
        if (platform.isCrumbled) return;

        const screenX = platform.x - camera.x + camera.shakeX;
        const screenY = platform.y - camera.y + camera.shakeY;

        if (screenX + platform.width > 0 && screenX < canvas.width &&
            screenY + platform.height > 0 && screenY < canvas.height) {
            
            if (platform.type === platformTypes.ROTATING && platform.rotatingPlatform) {
                platform.rotatingPlatform.draw();
            } else {
                ctx.fillStyle = platform.color;
                ctx.fillRect(screenX, screenY, platform.width, platform.height);

                ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
                ctx.fillRect(screenX, screenY + platform.height, platform.width, 5);

                if (platform.type === platformTypes.MOVING) {
                    ctx.strokeStyle = '#333';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([5, 5]);
                    ctx.strokeRect(screenX, screenY, platform.width, platform.height);
                    ctx.setLineDash([]);
                } else if (platform.type === platformTypes.BOUNCY) {
                    ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
                    ctx.fillRect(screenX, screenY, platform.width, platform.height);
                } else if (platform.type === platformTypes.ICE) {
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                    ctx.fillRect(screenX, screenY, platform.width, platform.height);
                }

                if (platform.isFinal) {
                    ctx.strokeStyle = '#FFB700';
                    ctx.lineWidth = 3;
                    ctx.strokeRect(screenX, screenY, platform.width, platform.height);
                }

                ctx.fillStyle = platform.isFinal ? '#333' : 'white';
                ctx.font = 'bold 16px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(platform.number, screenX + platform.width / 2, screenY + platform.height / 2);
            }
        }
    });
}

// Draw HUD
function drawHUD() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(10, 10, 400, 160);

    ctx.fillStyle = 'white';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'left';
    
    ctx.fillText('Score: ' + gameScore, 20, 35);
    ctx.fillText('Deaths: ' + deathCounter, 20, 60);
    
    gameDuration = Math.floor((Date.now() - gameStartTime) / 1000);
    ctx.fillText('Time: ' + formatTime(gameDuration), 20, 85);
    
    if (bestTime) {
        ctx.fillText('Best: ' + bestTime, 20, 110);
    }

    ctx.fillText('Difficulty: ' + currentDifficulty.toUpperCase(), 20, 135);

    ctx.font = '14px Arial';
    ctx.fillText('Press ESC to pause', 20, 155);

    let powerUpX = canvas.width - 200;
    if (player.doubleJumpAvailable) {
        ctx.fillStyle = '#3498DB';
        ctx.fillRect(powerUpX, 20, 30, 30);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('J', powerUpX + 15, 40);
        powerUpX -= 40;
    }
    if (player.speedBoostActive) {
        ctx.fillStyle = '#E67E22';
        ctx.fillRect(powerUpX, 20, 30, 30);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('S', powerUpX + 15, 40);
        powerUpX -= 40;
    }
    if (player.invincibleTimer > 0) {
        ctx.fillStyle = '#9B59B6';
        ctx.fillRect(powerUpX, 20, 30, 30);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('I', powerUpX + 15, 40);
    }
}

// Format time helper
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// Draw Game
function drawGame() {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(1, '#E0F6FF');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawPlatforms();
    
    collectibles.forEach((col) => {
        col.update();
        col.draw();
    });
    
    powerUps.forEach((powerUp) => {
        powerUp.update();
        powerUp.draw();
    });

    checkpoints.forEach((checkpoint) => {
        checkpoint.update();
        checkpoint.draw();
    });
    
    enemies.forEach((enemy) => {
        enemy.update();
        enemy.draw();
    });
    
    particles.forEach((particle, index) => {
        particle.update();
        particle.draw();
        if (particle.life <= 0) {
            particles.splice(index, 1);
        }
    });
    
    drawPlayer();
    drawHUD();
}

// End Game
function endGame() {
    currentState = gameStates.GAME_OVER;
    const newTime = formatTime(gameDuration);
    
    const score = gameScore;
    addToLeaderboard(score, newTime, currentDifficulty, currentLevel);
    
    if (!bestTime || gameDuration < parseInt(bestTime.split(':')[0]) * 60 + parseInt(bestTime.split(':')[1])) {
        bestTime = newTime;
        localStorage.setItem('bestTime', bestTime);
    }
    
    document.getElementById('gameOverScreen').classList.add('show');
    document.getElementById('finalScore').textContent = gameScore;
    document.getElementById('finalTime').textContent = newTime;
    document.getElementById('finalDeaths').textContent = deathCounter;
}

// Leaderboard functions
function addToLeaderboard(score, time, difficulty, level) {
    leaderboard.push({
        score: score,
        time: time,
        difficulty: difficulty,
        level: level,
        date: new Date().toLocaleDateString()
    });
    leaderboard.sort((a, b) => b.score - a.score);
    leaderboard = leaderboard.slice(0, 10);
    localStorage.setItem('leaderboard', JSON.stringify(leaderboard));
}

// Pause Game
function pauseGame() {
    currentState = gameStates.PAUSED;
    document.getElementById('pauseScreen').style.display = 'flex';
}

// Resume Game
function resumeGame() {
    currentState = gameStates.PLAYING;
    document.getElementById('pauseScreen').style.display = 'none';
}

// Game Loop
function gameLoop() {
    updateScreenShake();
    
    if (currentState === gameStates.PLAYING) {
        updatePlayer();
        updateMovingPlatforms();
        updateCamera();
        drawGame();
    } else if (currentState === gameStates.PAUSED) {
        drawGame();
    }
    requestAnimationFrame(gameLoop);
}

// UI Event Listeners
document.getElementById('playBtn').addEventListener('click', () => {
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('levelSelectScreen').style.display = 'flex';
    currentState = gameStates.LEVEL_SELECT;
});

// Level selection buttons
document.querySelectorAll('[data-difficulty]').forEach(btn => {
    btn.addEventListener('click', (e) => {
        currentDifficulty = e.target.getAttribute('data-difficulty');
        document.getElementById('levelSelectScreen').style.display = 'none';
        document.getElementById('gameScreen').classList.add('show');
        currentState = gameStates.PLAYING;
        deathCounter = 0;
        initGame();
        gameLoop();
    });
});

document.getElementById('restartBtn').addEventListener('click', () => {
    document.getElementById('gameOverScreen').classList.remove('show');
    document.getElementById('gameScreen').classList.remove('show');
    document.getElementById('startScreen').style.display = 'flex';
    currentState = gameStates.START;
});

document.getElementById('resumeBtn').addEventListener('click', () => {
    resumeGame();
});

document.getElementById('quitBtn').addEventListener('click', () => {
    currentState = gameStates.START;
    document.getElementById('pauseScreen').style.display = 'none';
    document.getElementById('gameScreen').classList.remove('show');
    document.getElementById('startScreen').style.display = 'flex';
});

document.getElementById('settingsBtn').addEventListener('click', () => {
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('settingsScreen').style.display = 'flex';
});

document.getElementById('backFromSettings').addEventListener('click', () => {
    document.getElementById('settingsScreen').style.display = 'none';
    document.getElementById('startScreen').style.display = 'flex';
});

document.getElementById('leaderboardBtn').addEventListener('click', () => {
    updateLeaderboardDisplay();
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('leaderboardScreen').style.display = 'flex';
});

document.getElementById('backFromLeaderboard').addEventListener('click', () => {
    document.getElementById('leaderboardScreen').style.display = 'none';
    document.getElementById('startScreen').style.display = 'flex';
});

// Settings handlers
document.getElementById('volumeSlider').addEventListener('change', (e) => {
    settings.volume = e.target.value;
    localStorage.setItem('volume', settings.volume);
});

document.getElementById('graphicsSelect').addEventListener('change', (e) => {
    settings.graphicsQuality = e.target.value;
    localStorage.setItem('graphicsQuality', settings.graphicsQuality);
});

function updateLeaderboardDisplay() {
    const leaderboardContent = document.getElementById('leaderboardContent');
    leaderboardContent.innerHTML = '';
    
    if (leaderboard.length === 0) {
        leaderboardContent.innerHTML = '<p style="color: white; text-align: center;">No scores yet!</p>';
        return;
    }

    leaderboard.forEach((entry, index) => {
        const row = document.createElement('div');
        row.style.color = 'white';
        row.style.padding = '0.5rem';
        row.style.borderBottom = '1px solid #555';
        row.innerHTML = `${index + 1}. Score: ${entry.score} | Time: ${entry.time} | ${entry.difficulty} | ${entry.date}`;
        leaderboardContent.appendChild(row);
    });
}

// Handle window resize
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});