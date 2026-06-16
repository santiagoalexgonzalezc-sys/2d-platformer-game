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
    color: '#ff6b6b'
};

// Physics
const gravity = 0.6;
const jumpPower = -15;
const moveSpeed = 5;
const maxSpeed = 8;

// Input Handling
const keys = {};

window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
});

window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
});

// Platforms Array
let platforms = [];
let firstPlatformPos = { x: 0, y: 0 };

// Initialize Platforms
function initPlatforms() {
    platforms = [];
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
        isFinal: false
    });

    firstPlatformPos = { x: 100, y: baseY };

    let currentX = 100 + platformWidth + 100;
    let currentY = baseY;

    // Platforms 2-24 (varied heights and positions)
    for (let i = 2; i <= 24; i++) {
        // Randomly decide if platform goes up or stays roughly same level
        const heightVariation = Math.random();
        let newY;

        if (heightVariation < 0.4) {
            // Go up
            newY = currentY - (30 + Math.random() * 40);
        } else if (heightVariation < 0.7) {
            // Go down slightly
            newY = currentY + (Math.random() * 30);
        } else {
            // Stay roughly same
            newY = currentY + (Math.random() * 20 - 10);
        }

        // Keep platforms in reasonable bounds
        newY = Math.max(100, Math.min(baseY, newY));
        currentY = newY;

        // Add horizontal spacing
        currentX += platformWidth + (80 + Math.random() * 40);

        platforms.push({
            x: currentX,
            y: newY,
            width: platformWidth,
            height: platformHeight,
            color: `hsl(${Math.random() * 360}, 70%, 50%)`,
            number: i,
            isFinal: false
        });
    }

    // Platform 25 (final platform)
    currentX += platformWidth + 100;
    platforms.push({
        x: currentX,
        y: baseY,
        width: platformWidth,
        height: platformHeight,
        color: '#FFD700',
        number: 25,
        isFinal: true
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
    camera.x = 0;
    camera.y = 0;
}

// Reset Player to First Platform
function resetToFirstPlatform() {
    player.x = platforms[0].x + platforms[0].width / 2 - player.width / 2;
    player.y = platforms[0].y - player.height;
    player.velocityY = 0;
    player.velocityX = 0;
    camera.x = 0;
    camera.y = 0;
}

// Update Camera to follow player
function updateCamera() {
    const targetCameraX = player.x - canvas.width / 4;
    const targetCameraY = player.y - canvas.height / 3;

    // Smooth camera following
    camera.x += (targetCameraX - camera.x) * 0.1;
    camera.y += (targetCameraY - camera.y) * 0.1;

    // Clamp camera to level bounds
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

    if (moveDirection !== 0) {
        player.velocityX = moveDirection * moveSpeed;
    } else {
        player.velocityX *= 0.85; // Friction
    }

    // Limit horizontal speed
    if (Math.abs(player.velocityX) > maxSpeed) {
        player.velocityX = Math.sign(player.velocityX) * maxSpeed;
    }

    player.x += player.velocityX;

    // Vertical Movement (Gravity)
    player.velocityY += gravity;
    player.y += player.velocityY;

    // Jumping
    if (keys['w'] && player.onGround) {
        player.velocityY = jumpPower;
        player.onGround = false;
    }

    // Check collision with platforms
    player.onGround = false;
    platforms.forEach((platform) => {
        // Simple AABB collision detection
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

            // Check if player reached final platform
            if (platform.isFinal) {
                endGame();
            }
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

// Draw Player
function drawPlayer() {
    const screenX = player.x - camera.x;
    const screenY = player.y - camera.y;

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
}

// Draw Platforms
function drawPlatforms() {
    platforms.forEach((platform) => {
        const screenX = platform.x - camera.x;
        const screenY = platform.y - camera.y;

        // Only draw if in view
        if (screenX + platform.width > 0 && screenX < canvas.width &&
            screenY + platform.height > 0 && screenY < canvas.height) {
            
            // Platform base
            ctx.fillStyle = platform.color;
            ctx.fillRect(screenX, screenY, platform.width, platform.height);

            // Platform shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.fillRect(screenX, screenY + platform.height, platform.width, 5);

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
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(10, 10, 250, 80);

    ctx.fillStyle = 'white';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Platform ' + Math.ceil(camera.x / 230), 20, 35);
    
    ctx.font = '16px Arial';
    ctx.fillText('Controls: W(Jump) A(Left) D(Right)', 20, 60);
    ctx.fillText('Reach Platform 25!', 20, 80);
}

// Draw Game
function drawGame() {
    // Clear canvas with gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(1, '#E0F6FF');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw platforms and player
    drawPlatforms();
    drawPlayer();
    drawHUD();
}

// End Game
function endGame() {
    currentState = gameStates.GAME_OVER;
    document.getElementById('gameOverScreen').classList.add('show');
}

// Game Loop
function gameLoop() {
    if (currentState === gameStates.PLAYING) {
        updatePlayer();
        updateCamera();
        drawGame();
    }
    requestAnimationFrame(gameLoop);
}

// UI Event Listeners
document.getElementById('playBtn').addEventListener('click', () => {
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('gameScreen').classList.add('show');
    currentState = gameStates.PLAYING;
    initGame();
    gameLoop();
});

document.getElementById('restartBtn').addEventListener('click', () => {
    document.getElementById('gameOverScreen').classList.remove('show');
    document.getElementById('gameScreen').classList.remove('show');
    document.getElementById('startScreen').style.display = 'flex';
    currentState = gameStates.START;
});

// Handle window resize
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});