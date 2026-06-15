// Canvas Setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

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

// Initialize Platforms
function initPlatforms() {
    platforms = [];
    const platformWidth = 150;
    const platformHeight = 30;
    const platformSpacing = 180;
    const startX = 100;
    const platformY = canvas.height - 150;

    for (let i = 0; i < 4; i++) {
        platforms.push({
            x: startX + i * platformSpacing,
            y: platformY,
            width: platformWidth,
            height: platformHeight,
            color: ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0'][i],
            number: i + 1
        });
    }
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

    // Screen wrapping (optional)
    if (player.x + player.width < 0) {
        player.x = canvas.width;
    } else if (player.x > canvas.width) {
        player.x = -player.width;
    }

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

            // Check if player reached platform 4
            if (platform.number === 4) {
                endGame();
            }
        }
    });

    // Fall off screen (lose condition - optional)
    if (player.y > canvas.height) {
        initGame();
    }
}

// Draw Player
function drawPlayer() {
    // Body
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.width, player.height);

    // Eyes
    ctx.fillStyle = 'white';
    ctx.fillRect(player.x + 8, player.y + 10, 6, 8);
    ctx.fillRect(player.x + 16, player.y + 10, 6, 8);

    // Pupils
    ctx.fillStyle = 'black';
    ctx.fillRect(player.x + 9, player.y + 11, 4, 4);
    ctx.fillRect(player.x + 17, player.y + 11, 4, 4);

    // Smile
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.x + 15, player.y + 25, 5, 0, Math.PI);
    ctx.stroke();
}

// Draw Platforms
function drawPlatforms() {
    platforms.forEach((platform) => {
        // Platform base
        ctx.fillStyle = platform.color;
        ctx.fillRect(platform.x, platform.y, platform.width, platform.height);

        // Platform shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(platform.x, platform.y + platform.height, platform.width, 5);

        // Platform number
        ctx.fillStyle = 'white';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(platform.number, platform.x + platform.width / 2, platform.y + platform.height / 2);
    });
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