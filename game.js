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
    height: canvas.height
};

// Game States
const gameStates = {
    START: 'start',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAME_OVER: 'gameOver'
};

let currentState = gameStates.START;

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
    if (key === 'escape' && currentState === gameStates.PLAYING) {
        pauseGame();
    } else if (key === 'escape' && currentState === gameStates.PAUSED) {
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
let firstPlatformPos = { x: 0, y: 0 };
let gameScore = 0;
let deathCounter = 0;
let bestTime = localStorage.getItem('bestTime') || null;
let gameStartTime = 0;
let gameDuration = 0;

// Platform Types
const platformTypes = {
    NORMAL: 'normal',
    MOVING: 'moving',
    CRUMBLING: 'crumbling',
    BOUNCY: 'bouncy',
    ICE: 'ice'
};

// Power-up Types
const powerUpTypes = {
    DOUBLE_JUMP: 'doubleJump',
    SPEED_BOOST: 'speedBoost',
    INVINCIBILITY: 'invincibility'
};

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
        ctx.fillRect(this.x - camera.x, this.y - camera.y, 5, 5);
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
        
        // Check collision with player
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
        
        const screenX = this.x - camera.x;
        const screenY = this.y - camera.y;

        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(this.rotation);
        
        // Draw star
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
        // Move back and forth
        this.x += this.velocityX;
        
        if (this.x - this.startX > this.moveRange || this.x - this.startX < 0) {
            this.velocityX *= -1;
        }

        // Check collision with player
        if (!player.invincibleTimer > 0 &&
            player.x + player.width > this.x &&
            player.x < this.x + this.width &&
            player.y + player.height > this.y &&
            player.y < this.y + this.height) {
            resetToFirstPlatform();
        }
    }

    draw() {
        const screenX = this.x - camera.x;
        const screenY = this.y - camera.y;

        if (screenX + this.width > 0 && screenX < canvas.width &&
            screenY + this.height > 0 && screenY < canvas.height) {
            
            // Draw spikes
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
        this.y -= 1; // Float upwards

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

        const screenX = this.x - camera.x;
        const screenY = this.y - camera.y;

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

// Activate Power-up
function activatePowerUp(type) {
    switch(type) {
        case powerUpTypes.DOUBLE_JUMP:
            player.doubleJumpAvailable = true;
            break;
        case powerUpTypes.SPEED_BOOST:
            player.speedBoostActive = true;
            player.speedBoostTimer = 300; // 5 seconds at 60fps
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

// Initialize Platforms
function initPlatforms() {
    platforms = [];
    collectibles = [];
    enemies = [];
    powerUps = [];
    gameScore = 0;
    gameStartTime = Date.now();

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

    // Platforms 2-24 (varied heights and positions)
    for (let i = 2; i <= 24; i++) {
        const heightVariation = Math.random();
        let newY;

        if (heightVariation < 0.4) {
            newY = currentY - (20 + Math.random() * 30);
        } else if (heightVariation < 0.7) {
            newY = currentY + (Math.random() * 20);
        } else {
            newY = currentY + (Math.random() * 15 - 7);
        }

        newY = Math.max(100, Math.min(baseY, newY));
        currentY = newY;
        currentX += platformWidth + (40 + Math.random() * 30);

        // Randomly assign platform types
        const typeRoll = Math.random();
        let platformType = platformTypes.NORMAL;
        let platformColor = `hsl(${Math.random() * 360}, 70%, 50%)`;

        if (typeRoll < 0.15) {
            platformType = platformTypes.MOVING;
            platformColor = '#FF9800';
        } else if (typeRoll < 0.25) {
            platformType = platformTypes.CRUMBLING;
            platformColor = '#8B4513';
        } else if (typeRoll < 0.35) {
            platformType = platformTypes.BOUNCY;
            platformColor = '#E91E63';
        } else if (typeRoll < 0.45) {
            platformType = platformTypes.ICE;
            platformColor = '#87CEEB';
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
            isCrumbled: false
        };

        platforms.push(platform);

        // Add collectibles randomly
        if (Math.random() < 0.4) {
            collectibles.push(new Collectible(currentX + platformWidth / 2, newY - 30));
        }

        // Add enemies randomly
        if (Math.random() < 0.15 && i > 5) {
            enemies.push(new Enemy(currentX, newY - 40, 25, 25, 80));
        }

        // Add power-ups rarely
        if (Math.random() < 0.08) {
            const powerUpType = [powerUpTypes.DOUBLE_JUMP, powerUpTypes.SPEED_BOOST, powerUpTypes.INVINCIBILITY][
                Math.floor(Math.random() * 3)
            ];
            powerUps.push(new PowerUp(currentX + platformWidth / 2, newY - 50, powerUpType));
        }
    }

    // Platform 25 (final platform)
    currentX += platformWidth + 50;
    platforms.push({
        x: currentX,
        y: baseY,
        width: platformWidth,
        height: platformHeight,
        color: '#FFD700',
        number: 25,
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
}

// Reset Player to First Platform
function resetToFirstPlatform() {
    deathCounter++;
    player.x = platforms[0].x + platforms[0].width / 2 - player.width / 2;
    player.y = platforms[0].y - player.height;
    player.velocityY = 0;
    player.velocityX = 0;
    player.doubleJumpAvailable = false;
    player.speedBoostActive = false;
    player.speedBoostTimer = 0;
    player.invincibleTimer = 0;
}

// Update Camera to follow player
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
    // Horizontal Movement
    let moveDirection = 0;
    if (keys['a']) moveDirection = -1;
    if (keys['d']) moveDirection = 1;

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

    // Vertical Movement (Gravity)
    player.velocityY += gravity;
    player.y += player.velocityY;

    // Jumping with double jump
    if (keys['w'] && player.onGround) {
        player.velocityY = jumpPower;
        player.onGround = false;
        player.doubleJumpAvailable = true;
    } else if (keys['w'] && player.doubleJumpAvailable && !player.onGround) {
        player.velocityY = jumpPower;
        player.doubleJumpAvailable = false;
    }

    // Update power-ups
    if (player.speedBoostActive) {
        player.speedBoostTimer--;
        if (player.speedBoostTimer <= 0) {
            player.speedBoostActive = false;
        }
    }

    if (player.invincibleTimer > 0) {
        player.invincibleTimer--;
    }

    // Check collision with platforms
    player.onGround = false;
    platforms.forEach((platform) => {
        if (platform.isCrumbled) return;

        // Check if player is above platform
        if (
            player.x + player.width > platform.x &&
            player.x < platform.x + platform.width &&
            player.y + player.height >= platform.y &&
            player.y + player.height <= platform.y + platform.height + 5 &&
            player.velocityY >= 0
        ) {
            player.y = platform.y - player.height;
            player.velocityY = 0;
            player.onGround = true;
            player.doubleJumpAvailable = false;

            // Handle bouncy platforms
            if (platform.type === platformTypes.BOUNCY) {
                player.velocityY = jumpPower * 1.5;
                createParticles(player.x, player.y, '#E91E63', 10);
            }

            // Start crumbling timer
            if (platform.type === platformTypes.CRUMBLING) {
                platform.crumbleTimer = 60;
            }

            // Check if player reached final platform
            if (platform.isFinal) {
                endGame();
            }
        }
    });

    // Update crumbling platforms
    platforms.forEach((platform) => {
        if (platform.type === platformTypes.CRUMBLING && platform.crumbleTimer !== null) {
            platform.crumbleTimer--;
            if (platform.crumbleTimer <= 0 && player.onGround === false) {
                platform.isCrumbled = true;
                platform.crumbleTimer = 300; // Respawn time
            } else if (platform.isCrumbled && platform.crumbleTimer <= 0) {
                platform.isCrumbled = false;
                platform.crumbleTimer = 0;
            }
        }
    });

    // Ice platform friction reduction
    platforms.forEach((platform) => {
        if (player.onGround && platform.type === platformTypes.ICE &&
            player.x + player.width > platform.x &&
            player.x < platform.x + platform.width) {
            player.velocityX *= 0.95; // Less friction on ice
        }
    });

    // Fall off screen - reset to first platform
    if (player.y > canvas.height + 200) {
        resetToFirstPlatform();
    }

    // Fall off left side
    if (player.x + player.width < -50) {
        resetToFirstPlatform();
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

            // Move player if standing on moving platform
            if (player.onGround &&
                player.x + player.width > platform.x &&
                player.x < platform.x + platform.width &&
                player.y + player.height >= platform.y &&
                player.y + player.height <= platform.y + platform.height + 5) {
                player.x += platform.velocityX;
            }
        }
    });
}

// Draw Player
function drawPlayer() {
    const screenX = player.x - camera.x;
    const screenY = player.y - camera.y;

    // Draw invincibility aura
    if (player.invincibleTimer > 0) {
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(screenX + player.width / 2, screenY + player.height / 2, player.width, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    // Body
    ctx.fillStyle = player.color;
    ctx.fillRect(screenX, screenY, player.width, player.height);

    // Eyes
    ctx.fillStyle = 'white';
    ctx.fillRect(screenX + 8, screenY + 10, 6, 8);
    ctx.fillRect(screenX + 16, screenY + 10, 6, 8);

    // Pupils
    ctx.fillStyle = 'black';
    ctx.fillRect(screenX + 9, screenY + 11, 4, 4);
    ctx.fillRect(screenX + 17, screenY + 11, 4, 4);

    // Smile
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(screenX + 15, screenY + 25, 5, 0, Math.PI);
    ctx.stroke();

    // Speed boost indicator
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

        const screenX = platform.x - camera.x;
        const screenY = platform.y - camera.y;

        if (screenX + platform.width > 0 && screenX < canvas.width &&
            screenY + platform.height > 0 && screenY < canvas.height) {
            
            // Platform base
            ctx.fillStyle = platform.color;
            ctx.fillRect(screenX, screenY, platform.width, platform.height);

            // Platform shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.fillRect(screenX, screenY + platform.height, platform.width, 5);

            // Platform type indicators
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

            // Platform border for final platform
            if (platform.isFinal) {
                ctx.strokeStyle = '#FFB700';
                ctx.lineWidth = 3;
                ctx.strokeRect(screenX, screenY, platform.width, platform.height);
            }

            // Platform number
            ctx.fillStyle = platform.isFinal ? '#333' : 'white';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(platform.number, screenX + platform.width / 2, screenY + platform.height / 2);
        }
    });
}

// Draw HUD
function drawHUD() {
    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(10, 10, 350, 130);

    ctx.fillStyle = 'white';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'left';
    
    // Score
    ctx.fillText('Score: ' + gameScore, 20, 35);
    
    // Deaths
    ctx.fillText('Deaths: ' + deathCounter, 20, 60);
    
    // Time
    gameDuration = Math.floor((Date.now() - gameStartTime) / 1000);
    ctx.fillText('Time: ' + formatTime(gameDuration), 20, 85);
    
    // Best Time
    if (bestTime) {
        ctx.fillText('Best: ' + bestTime, 20, 110);
    }

    ctx.font = '14px Arial';
    ctx.fillText('Press ESC to pause', 20, 130);

    // Power-up indicators
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
    
    // Draw collectibles
    collectibles.forEach((col) => {
        col.update();
        col.draw();
    });
    
    // Draw power-ups
    powerUps.forEach((powerUp) => {
        powerUp.update();
        powerUp.draw();
    });
    
    // Draw enemies
    enemies.forEach((enemy) => {
        enemy.update();
        enemy.draw();
    });
    
    // Draw particles
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
    
    if (!bestTime || gameDuration < parseInt(bestTime.split(':')[0]) * 60 + parseInt(bestTime.split(':')[1])) {
        bestTime = newTime;
        localStorage.setItem('bestTime', bestTime);
    }
    
    document.getElementById('gameOverScreen').classList.add('show');
    document.getElementById('finalScore').textContent = gameScore;
    document.getElementById('finalTime').textContent = newTime;
    document.getElementById('finalDeaths').textContent = deathCounter;
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
    document.getElementById('gameScreen').classList.add('show');
    currentState = gameStates.PLAYING;
    deathCounter = 0;
    initGame();
    gameLoop();
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

// Handle window resize
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});