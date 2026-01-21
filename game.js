// CopperHead Client

const CELL_SIZE = 20;

let ws = null;
let gameState = null;
let wins = {1: 0, 2: 0};
let names = {1: "Player 1", 2: "Player 2"};
let playerId = 1;
let playerName = "";
let gameMode = "vs_ai";
let aiDifficulty = 5;
let lastSnakeLength = 0;
let lastOpponentLength = 0;

// DOM elements
const setupPanel = document.getElementById("setup");
const gamePanel = document.getElementById("game");
const playerNameInput = document.getElementById("playerName");
const serverUrlInput = document.getElementById("serverUrl");
const gameModeSelect = document.getElementById("gameMode");
const difficultySection = document.getElementById("difficultySection");
const aiDifficultySlider = document.getElementById("aiDifficulty");
const difficultyValue = document.getElementById("difficultyValue");
const connectBtn = document.getElementById("connectBtn");
const statusDiv = document.getElementById("status");
const scoresDiv = document.getElementById("scores");
const readyBtn = document.getElementById("readyBtn");
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const goalText = document.getElementById("goal-text");

// Event listeners
connectBtn.addEventListener("click", connect);
readyBtn.addEventListener("click", sendReady);
document.addEventListener("keydown", handleKeydown);
gameModeSelect.addEventListener("change", updateModeUI);
aiDifficultySlider.addEventListener("input", updateDifficultyDisplay);

function updateModeUI() {
    gameMode = gameModeSelect.value;
}

function updateDifficultyDisplay() {
    aiDifficulty = parseInt(aiDifficultySlider.value);
    difficultyValue.textContent = aiDifficulty;
}

function connect() {
    const baseUrl = serverUrlInput.value.trim();
    gameMode = gameModeSelect.value;
    playerName = playerNameInput.value.trim() || "Player";

    if (!baseUrl) {
        alert("Please enter a server URL");
        return;
    }

    connectBtn.disabled = true;
    setStatus("Connecting...", "");
    
    // Try to connect as player 1 first, then player 2
    tryConnect(baseUrl, 1);
}

function tryConnect(baseUrl, tryPlayerId) {
    const wsUrl = baseUrl.endsWith("/") ? `${baseUrl}${tryPlayerId}` : `${baseUrl}/${tryPlayerId}`;
    
    try {
        ws = new WebSocket(wsUrl);
    } catch (e) {
        setStatus("Invalid URL", "error");
        connectBtn.disabled = false;
        return;
    }

    ws.onopen = () => {
        playerId = tryPlayerId;
        setupPanel.classList.add("hidden");
        gamePanel.classList.remove("hidden");
        readyBtn.classList.remove("hidden");
        
        // Show/hide AI difficulty slider based on mode
        if (gameMode === "vs_ai") {
            difficultySection.classList.add("visible");
        } else {
            difficultySection.classList.remove("visible");
        }
        
        setStatus("Connected! Click Ready to start.", "connected");
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleMessage(data);
    };

    ws.onclose = (event) => {
        // If player 1 slot taken (4001) or rejected (403/1006), try player 2
        if (tryPlayerId === 1 && (event.code === 4001 || event.code === 4000 || event.code === 1006 || event.code === 403)) {
            tryConnect(baseUrl, 2);
            return;
        }
        setStatus("Disconnected", "error");
        readyBtn.classList.add("hidden");
        connectBtn.disabled = false;
    };

    ws.onerror = () => {
        // Don't show error if we're going to retry as player 2
        if (tryPlayerId === 1) {
            return;
        }
        setStatus("Connection error", "error");
        connectBtn.disabled = false;
    };
}

function handleMessage(data) {
    switch (data.type) {
        case "state":
            // Check if player ate food (snake grew)
            if (gameState && gameState.running && data.game.running) {
                const mySnake = data.game.snakes[playerId];
                if (mySnake && mySnake.body.length > lastSnakeLength) {
                    sfx.eat();
                    lastSnakeLength = mySnake.body.length;
                }
                
                // Check if opponent ate food
                const opponentId = playerId === 1 ? "2" : "1";
                const opponentSnake = data.game.snakes[opponentId];
                if (opponentSnake && opponentSnake.body.length > lastOpponentLength) {
                    sfx.opponentEat();
                    lastOpponentLength = opponentSnake.body.length;
                }
            }
            if (data.wins) {
                wins = data.wins;
            }
            if (data.names) {
                names = data.names;
            }
            gameState = data.game;
            updateCanvas();
            updateScores();
            break;
        case "start":
            setStatus("Game started!", "playing");
            readyBtn.classList.add("hidden");
            lastSnakeLength = 1;
            lastOpponentLength = 1;
            sfx.gameStart();
            break;
        case "gameover":
            if (data.wins) {
                wins = data.wins;
            }
            if (data.names) {
                names = data.names;
            }
            updateScores();
            const opponentId = playerId === 1 ? 2 : 1;
            const opponentName = names[opponentId] || "Opponent";
            let msg;
            if (data.winner === null) {
                msg = "Game Over - Draw!";
                sfx.lose();
            } else if (data.winner === playerId) {
                msg = "🏆 You Win!";
                sfx.win();
            } else {
                msg = `Game Over - ${opponentName} Wins`;
                sfx.death();
            }
            setStatus(msg, "connected");
            readyBtn.classList.remove("hidden");
            readyBtn.textContent = "Play Again";
            break;
        case "waiting":
            setStatus(data.message || "Waiting for opponent...", "connected");
            break;
    }
}

function sendReady() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        const msg = { action: "ready", mode: gameMode, name: playerName };
        if (gameMode === "vs_ai") {
            msg.ai_difficulty = aiDifficulty;
        }
        ws.send(JSON.stringify(msg));
        setStatus("Waiting for game to start...", "connected");
        readyBtn.classList.add("hidden");
        
        // Update goal text based on mode
        if (goalText) {
            if (gameMode === "vs_ai") {
                goalText.textContent = "Outlast the AI opponent! Avoid walls, yourself, and the enemy snake.";
            } else {
                goalText.textContent = "Outlast your opponent! Avoid walls, yourself, and the enemy snake.";
            }
        }
    }
}

function handleKeydown(event) {
    // ESC returns to setup screen
    if (event.code === "Escape") {
        if (ws) {
            ws.close();
            ws = null;
        }
        gameState = null;
        lastScore = 0;
        gamePanel.classList.add("hidden");
        setupPanel.classList.remove("hidden");
        connectBtn.disabled = false;
        setStatus("Waiting to connect...", "");
        return;
    }

    // Number keys 1-9, 0 set AI difficulty (0 = level 10) - works anytime in vs_ai mode
    if (gameMode === "vs_ai") {
        const digitMatch = event.code.match(/^Digit(\d)$/);
        if (digitMatch) {
            const digit = parseInt(digitMatch[1]);
            aiDifficulty = digit === 0 ? 10 : digit;
            aiDifficultySlider.value = aiDifficulty;
            difficultyValue.textContent = aiDifficulty;
            
            // If game is running, send difficulty change to server
            if (ws && ws.readyState === WebSocket.OPEN && gameState && gameState.running) {
                ws.send(JSON.stringify({ action: "set_ai_difficulty", ai_difficulty: aiDifficulty }));
            }
            return;
        }
    }

    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (!gameState || !gameState.running) {
        if (event.code === "Space") {
            sendReady();
        }
        return;
    }

    let direction = null;
    switch (event.code) {
        case "ArrowUp":
        case "KeyW":
            direction = "up";
            break;
        case "ArrowDown":
        case "KeyS":
            direction = "down";
            break;
        case "ArrowLeft":
        case "KeyA":
            direction = "left";
            break;
        case "ArrowRight":
        case "KeyD":
            direction = "right";
            break;
    }

    if (direction) {
        event.preventDefault();
        sfx.move();
        ws.send(JSON.stringify({ action: "move", direction }));
    }
}

function setStatus(text, className) {
    statusDiv.textContent = text;
    statusDiv.className = className;
}

function updateCanvas() {
    if (!gameState) return;

    const grid = gameState.grid;
    canvas.width = grid.width * CELL_SIZE;
    canvas.height = grid.height * CELL_SIZE;

    // Clear
    ctx.fillStyle = "#0f0f23";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid lines
    ctx.strokeStyle = "#1a1a2e";
    ctx.lineWidth = 1;
    for (let x = 0; x <= grid.width; x++) {
        ctx.beginPath();
        ctx.moveTo(x * CELL_SIZE, 0);
        ctx.lineTo(x * CELL_SIZE, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y <= grid.height; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * CELL_SIZE);
        ctx.lineTo(canvas.width, y * CELL_SIZE);
        ctx.stroke();
    }

    // Draw food
    if (gameState.food) {
        ctx.fillStyle = "#f39c12";
        ctx.beginPath();
        ctx.arc(
            gameState.food[0] * CELL_SIZE + CELL_SIZE / 2,
            gameState.food[1] * CELL_SIZE + CELL_SIZE / 2,
            CELL_SIZE / 2 - 2,
            0,
            Math.PI * 2
        );
        ctx.fill();
    }

    // Draw snakes - green for local player, red for opponent
    for (const [pid, snake] of Object.entries(gameState.snakes)) {
        const isMe = parseInt(pid) === playerId;
        const color = isMe 
            ? { body: "#27ae60", head: "#2ecc71" }
            : { body: "#c0392b", head: "#e74c3c" };
        
        if (!snake.alive) {
            ctx.globalAlpha = 0.4;
        }

        snake.body.forEach((segment, i) => {
            ctx.fillStyle = i === 0 ? color.head : color.body;
            ctx.fillRect(
                segment[0] * CELL_SIZE + 1,
                segment[1] * CELL_SIZE + 1,
                CELL_SIZE - 2,
                CELL_SIZE - 2
            );
        });

        ctx.globalAlpha = 1;
    }
}

function updateScores() {
    const myWins = wins[playerId] || 0;
    const opponentId = playerId === 1 ? 2 : 1;
    const opponentWins = wins[opponentId] || 0;
    const opponentName = names[opponentId] || "Opponent";
    
    let html = "";
    html += `<div class="score player1">${playerName}: ${myWins} wins</div>`;
    html += `<div class="score player2">${opponentName}: ${opponentWins} wins</div>`;
    scoresDiv.innerHTML = html;
}
