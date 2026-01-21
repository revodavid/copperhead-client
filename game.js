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
let isObserver = false;
let roomId = null;
let activeRooms = [];
let currentRoomIndex = 0;

// DOM elements
const setupPanel = document.getElementById("setup");
const gamePanel = document.getElementById("game");
const playerNameInput = document.getElementById("playerName");
const serverUrlSelect = document.getElementById("serverUrlSelect");
const serverUrlCustom = document.getElementById("serverUrlCustom");
const gameModeSelect = document.getElementById("gameMode");
const difficultySection = document.getElementById("difficultySection");
const aiDifficultySlider = document.getElementById("aiDifficulty");
const difficultyValue = document.getElementById("difficultyValue");
const connectBtn = document.getElementById("connectBtn");
const observeBtn = document.getElementById("observeBtn");
const statusDiv = document.getElementById("status");
const scoresDiv = document.getElementById("scores");
const readyBtn = document.getElementById("readyBtn");
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const goalText = document.getElementById("goal-text");
const instructionsDiv = document.getElementById("instructions");
const originalInstructionsHtml = instructionsDiv ? instructionsDiv.innerHTML : "";

// Event listeners
connectBtn.addEventListener("click", connect);
observeBtn.addEventListener("click", observe);
readyBtn.addEventListener("click", sendReady);
document.addEventListener("keydown", handleKeydown);
gameModeSelect.addEventListener("change", updateModeUI);
serverUrlSelect.addEventListener("change", updateServerUrlUI);
aiDifficultySlider.addEventListener("input", updateDifficultyDisplay);

function updateModeUI() {
    gameMode = gameModeSelect.value;
}

function updateDifficultyDisplay() {
    aiDifficulty = parseInt(aiDifficultySlider.value);
    difficultyValue.textContent = aiDifficulty;
}

function updateServerUrlUI() {
    if (serverUrlSelect.value === "custom") {
        serverUrlCustom.classList.remove("hidden");
        serverUrlCustom.focus();
    } else {
        serverUrlCustom.classList.add("hidden");
    }
}

function getServerUrl() {
    if (serverUrlSelect.value === "custom") {
        return serverUrlCustom.value.trim();
    }
    return serverUrlSelect.value;
}

function connect() {
    const baseUrl = getServerUrl();
    gameMode = gameModeSelect.value;
    playerName = playerNameInput.value.trim() || "Player";
    isObserver = false;

    if (!baseUrl) {
        alert("Please enter a server URL");
        return;
    }

    connectBtn.disabled = true;
    observeBtn.disabled = true;
    setStatus("Connecting...", "");
    
    // Use the new /join endpoint for auto-matchmaking
    const wsUrl = baseUrl.replace(/\/ws\/?$/, "") + "/ws/join";
    connectWebSocket(wsUrl);
}

function observe() {
    const baseUrl = getServerUrl();
    isObserver = true;
    playerName = "Observer";

    if (!baseUrl) {
        alert("Please enter a server URL");
        return;
    }

    connectBtn.disabled = true;
    observeBtn.disabled = true;
    setStatus("Connecting as observer...", "");
    
    const wsUrl = baseUrl.replace(/\/ws\/?$/, "") + "/ws/observe";
    connectWebSocket(wsUrl);
}

function connectWebSocket(wsUrl) {
    try {
        ws = new WebSocket(wsUrl);
    } catch (e) {
        setStatus("Invalid URL", "error");
        connectBtn.disabled = false;
        observeBtn.disabled = false;
        return;
    }

    ws.onopen = () => {
        setupPanel.classList.add("hidden");
        gamePanel.classList.remove("hidden");
        
        if (isObserver) {
            readyBtn.classList.add("hidden");
            difficultySection.classList.remove("visible");
            setStatus("Observing... Waiting for game", "connected");
        } else {
            readyBtn.classList.remove("hidden");
            restorePlayerInstructions();
            if (gameMode === "vs_ai") {
                difficultySection.classList.add("visible");
            } else {
                difficultySection.classList.remove("visible");
            }
            setStatus("Connected! Click Ready to start.", "connected");
        }
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleMessage(data);
    };

    ws.onclose = (event) => {
        if (event.code === 4003) {
            setStatus("No active game to observe", "error");
        } else if (event.code === 4002) {
            setStatus("Server full - try again later", "error");
        } else {
            setStatus("Disconnected", "error");
        }
        readyBtn.classList.add("hidden");
        connectBtn.disabled = false;
        observeBtn.disabled = false;
    };

    ws.onerror = () => {
        setStatus("Connection error", "error");
        connectBtn.disabled = false;
        observeBtn.disabled = false;
    };
}

function handleMessage(data) {
    switch (data.type) {
        case "joined":
            // Player joined a room
            playerId = data.player_id;
            roomId = data.room_id;
            setStatus(`Connected to Room ${roomId}! Click Ready to start.`, "connected");
            break;
        case "observer_lobby":
            // Observer waiting for games
            roomId = null;
            gameState = null;
            activeRooms = [];
            setStatus("No active games - waiting...", "connected");
            updateCanvas();
            updateObserverInfo();
            break;
        case "observer_joined":
            // Observer joined a room
            roomId = data.room_id;
            if (data.wins) wins = data.wins;
            if (data.names) names = data.names;
            gameState = data.game;
            setStatus(`Observing Room ${roomId}`, "connected");
            updateCanvas();
            updateScores();
            updateObserverInfo();
            // Request room list
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ action: "get_rooms" }));
            }
            break;
        case "room_list":
            // Update active rooms list for observer
            activeRooms = data.rooms || [];
            currentRoomIndex = activeRooms.findIndex(r => r.room_id === data.current_room);
            if (currentRoomIndex < 0) currentRoomIndex = 0;
            updateObserverInfo();
            break;
        case "state":
            // Sound effects only for players, not observers
            if (!isObserver && gameState && gameState.running && data.game.running) {
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
            if (data.room_id) {
                roomId = data.room_id;
            }
            gameState = data.game;
            updateCanvas();
            updateScores();
            if (isObserver && gameState.running) {
                setStatus(`Observing Room ${roomId}`, "playing");
            }
            break;
        case "start":
            if (isObserver) {
                setStatus(`Observing Room ${roomId} - Game in progress`, "playing");
            } else {
                setStatus("Game started!", "playing");
                readyBtn.classList.add("hidden");
                sfx.gameStart();
            }
            lastSnakeLength = 1;
            lastOpponentLength = 1;
            break;
        case "gameover":
            if (data.wins) {
                wins = data.wins;
            }
            if (data.names) {
                names = data.names;
            }
            updateScores();
            if (isObserver) {
                const winnerName = data.winner ? (names[data.winner] || "Unknown") : "No one";
                setStatus(`Game Over - ${winnerName} wins! Waiting for next game...`, "connected");
            } else {
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
            }
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
        isObserver = false;
        roomId = null;
        gamePanel.classList.add("hidden");
        setupPanel.classList.remove("hidden");
        connectBtn.disabled = false;
        observeBtn.disabled = false;
        setStatus("Waiting to connect...", "");
        return;
    }

    // Observers can use Left/Right to switch rooms
    if (isObserver) {
        if (event.code === "ArrowLeft" || event.code === "ArrowRight") {
            if (activeRooms.length > 1) {
                if (event.code === "ArrowLeft") {
                    currentRoomIndex = (currentRoomIndex - 1 + activeRooms.length) % activeRooms.length;
                } else {
                    currentRoomIndex = (currentRoomIndex + 1) % activeRooms.length;
                }
                const newRoom = activeRooms[currentRoomIndex];
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ action: "switch_room", room_id: newRoom.room_id }));
                }
            }
        }
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

    // Draw snakes
    // For observers: player 1 = green, player 2 = red
    // For players: local player = green, opponent = red
    for (const [pid, snake] of Object.entries(gameState.snakes)) {
        let useGreen;
        if (isObserver) {
            useGreen = parseInt(pid) === 1;
        } else {
            useGreen = parseInt(pid) === playerId;
        }
        const color = useGreen 
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
    let player1Name, player2Name, player1Wins, player2Wins;
    
    if (isObserver) {
        // Observer sees both players by their actual names
        player1Name = names[1] || names["1"] || "Player 1";
        player2Name = names[2] || names["2"] || "Player 2";
        player1Wins = wins[1] || wins["1"] || 0;
        player2Wins = wins[2] || wins["2"] || 0;
    } else {
        // Player sees themselves first, opponent second
        const opponentId = playerId === 1 ? 2 : 1;
        player1Name = playerName;
        // Use actual opponent name - check both string and number keys
        const opponentName = names[opponentId] || names[String(opponentId)];
        if (opponentName && opponentName !== "Player 1" && opponentName !== "Player 2") {
            player2Name = opponentName;
        } else {
            player2Name = "Waiting...";
        }
        player1Wins = wins[playerId] || wins[String(playerId)] || 0;
        player2Wins = wins[opponentId] || wins[String(opponentId)] || 0;
    }
    
    let html = `<table class="scores-table">
        <thead><tr><th colspan="2">Games Won</th></tr></thead>
        <tbody>
            <tr class="player1"><td>${player1Name}</td><td>${player1Wins}</td></tr>
            <tr class="player2"><td>${player2Name}</td><td>${player2Wins}</td></tr>
        </tbody>
    </table>`;
    scoresDiv.innerHTML = html;
}

function updateObserverInfo() {
    if (!isObserver) return;
    
    // Update the instructions panel to show observer info
    const instructionsDiv = document.getElementById("instructions");
    if (!instructionsDiv) return;
    
    let roomListHtml = "";
    if (activeRooms.length > 0) {
        roomListHtml = activeRooms.map(r => {
            const isCurrent = r.room_id === roomId;
            const p1 = r.names[1] || "Player 1";
            const p2 = r.names[2] || "Player 2";
            return `<div class="${isCurrent ? 'current-room' : ''}">Room ${r.room_id}: ${p1} vs ${p2}</div>`;
        }).join("");
    } else {
        roomListHtml = "<div>No active games</div>";
    }
    
    instructionsDiv.innerHTML = `
        <h3>👁️ Observer Mode</h3>
        <div class="instruction-section">
            <h4>Controls</h4>
            <ul>
                <li><strong>←/→</strong>: Switch between games</li>
                <li><strong>ESC</strong>: Return to menu</li>
            </ul>
        </div>
        <div class="instruction-section">
            <h4>Active Games (${activeRooms.length})</h4>
            <div class="room-list">${roomListHtml}</div>
        </div>
    `;
}

function restorePlayerInstructions() {
    if (instructionsDiv && originalInstructionsHtml) {
        instructionsDiv.innerHTML = originalInstructionsHtml;
    }
}
