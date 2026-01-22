// CopperHead Client

const CELL_SIZE = 20;

let ws = null;
let gameState = null;
let wins = {1: 0, 2: 0};
let names = {1: "Player 1", 2: "Player 2"};
let playerId = 1;
let playerName = "";
let gameMode = "two_player";
let lastSnakeLength = 0;
let lastOpponentLength = 0;
let isObserver = false;
let roomId = null;
let activeRooms = [];
let currentRoomIndex = 0;
let statusPollInterval = null;
let hasOpenMatches = false;

// Competition mode state
let competitionState = null;
let currentRound = 0;
let totalRounds = 0;
let pointsToWin = 5;
let observerFollowingPlayer = null; // Track winner name to follow between rounds
let observerMatchComplete = false; // Track if we're waiting for next round
let serverSettings = {
    gridWidth: 30,
    gridHeight: 20,
    speed: 0.15,
    pointsToWin: 5
};

// DOM elements
const setupPanel = document.getElementById("setup");
const gamePanel = document.getElementById("game");
const playerNameInput = document.getElementById("playerName");
const serverUrlSelect = document.getElementById("serverUrlSelect");
const serverUrlCustom = document.getElementById("serverUrlCustom");
const playBtn = document.getElementById("playBtn");
const playStatus = document.getElementById("play-status");
const addAiBtn = document.getElementById("addAiBtn");
const observeBtn = document.getElementById("observeBtn");
const competitionRoundInfo = document.getElementById("competition-round-info");
const entryMatchesBody = document.getElementById("entry-matches-body");
const statusDiv = document.getElementById("status");
const scoresDiv = document.getElementById("scores");
const readyBtn = document.getElementById("readyBtn");
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const goalText = document.getElementById("goal-text");
const instructionsDiv = document.getElementById("instructions");
const matchInfoDiv = document.getElementById("match-info");
const roundInfoDiv = document.getElementById("round-info");
const pointsToWinInfoDiv = document.getElementById("points-to-win-info");
const originalInstructionsHtml = instructionsDiv ? instructionsDiv.innerHTML : "";

// Event listeners
playBtn.addEventListener("click", () => connectWithMode("two_player"));
addAiBtn.addEventListener("click", addAiPlayer);
observeBtn.addEventListener("click", observe);
readyBtn.addEventListener("click", sendReady);
document.addEventListener("keydown", handleKeydown);
serverUrlSelect.addEventListener("change", updateServerUrlUI);
serverUrlCustom.addEventListener("input", debounce(updateCustomServerUrl, 500));
serverUrlCustom.addEventListener("change", updateCustomServerUrl);

// Fetch server settings and status on load
fetchServerStatus();
startStatusPolling();

// Debounce helper for custom URL input
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function updateCustomServerUrl() {
    showLoadingState();
    fetchServerStatus();
}

function updateServerUrlUI() {
    if (serverUrlSelect.value === "custom") {
        serverUrlCustom.classList.remove("hidden");
        serverUrlCustom.focus();
    } else {
        serverUrlCustom.classList.add("hidden");
    }
    // Show loading state and refetch status when server changes
    showLoadingState();
    fetchServerStatus();
}

function showLoadingState() {
    if (playBtn) playBtn.disabled = true;
    if (addAiBtn) addAiBtn.disabled = true;
    if (playStatus) {
        playStatus.textContent = "Checking server...";
        playStatus.style.color = "#888";
    }
    if (competitionRoundInfo) competitionRoundInfo.textContent = "Loading...";
    if (entryMatchesBody) entryMatchesBody.innerHTML = "<tr><td colspan='3'>Loading...</td></tr>";
}

function startStatusPolling() {
    // Poll server status every 2 seconds while on entry screen
    statusPollInterval = setInterval(() => {
        if (!setupPanel.classList.contains("hidden")) {
            fetchServerStatus();
        }
    }, 2000);
}

function stopStatusPolling() {
    if (statusPollInterval) {
        clearInterval(statusPollInterval);
        statusPollInterval = null;
    }
}

async function fetchServerStatus() {
    const baseUrl = getServerUrl();
    if (!baseUrl) return;
    
    try {
        const httpUrl = baseUrl.replace(/^ws/, "http").replace(/\/ws\/?$/, "");
        
        // Fetch room status
        const statusResponse = await fetch(httpUrl + "/status");
        if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            if (statusData.speed) {
                serverSettings.speed = statusData.speed;
            }
            updateEntryScreenStatus(statusData);
        }
        
        // Fetch competition info
        const compResponse = await fetch(httpUrl + "/competition");
        if (compResponse.ok) {
            const compData = await compResponse.json();
            serverSettings.pointsToWin = compData.points_to_win || 5;
            currentRound = compData.round || 0;
            totalRounds = compData.total_rounds || 1;
            window.lastCompetitionData = compData;  // Store for match table display
            updateCompetitionDisplay(compData);
        }
        
        updateServerSettingsDisplay(true);
    } catch (e) {
        // Server not reachable
        if (playStatus) playStatus.textContent = "Server unavailable";
        if (playBtn) playBtn.disabled = true;
        if (addAiBtn) addAiBtn.disabled = true;
        if (observeBtn) observeBtn.disabled = true;
        if (competitionRoundInfo) competitionRoundInfo.textContent = "--";
        if (entryMatchesBody) entryMatchesBody.innerHTML = "<tr><td colspan='3'>Cannot connect to server</td></tr>";
        updateServerSettingsDisplay(false);
    }
}

function updateEntryScreenStatus(statusData) {
    const rooms = statusData.rooms || [];
    const openSlots = statusData.open_slots || 0;
    const arenas = statusData.arenas || 1;
    hasOpenMatches = openSlots > 0;
    const hasAnyMatches = rooms.length > 0;
    
    // Update Play button - only enabled if there's an open slot
    if (playBtn) {
        playBtn.disabled = !hasOpenMatches;
    }
    if (playStatus) {
        if (hasOpenMatches) {
            playStatus.textContent = `${openSlots} slot${openSlots > 1 ? 's' : ''} available`;
            playStatus.style.color = "#2ecc71";
        } else if (hasAnyMatches) {
            playStatus.textContent = "All slots filled";
            playStatus.style.color = "#888";
        } else {
            playStatus.textContent = "Waiting for players";
            playStatus.style.color = "#888";
        }
    }
    
    // Update Add AI button - enabled if there are open slots
    if (addAiBtn) {
        addAiBtn.disabled = !hasOpenMatches;
    }
    
    // Update Observe button - enabled if any matches exist (active or completed)
    if (observeBtn) {
        observeBtn.disabled = !hasAnyMatches;
    }
    
    // Update matches table - show all matches in current round
    if (entryMatchesBody) {
        let rows = [];
        
        // Check if we have competition data with bye info
        const compState = window.lastCompetitionData?.state || "waiting_for_players";
        const byePlayer = window.lastCompetitionData?.bye_player;
        const pointsToWin = window.lastCompetitionData?.points_to_win || 5;
        
        // Add rows for each room/match
        for (const room of rooms) {
            const connectedPlayers = room.players || [];
            const p1Connected = connectedPlayers.includes(1);
            const p2Connected = connectedPlayers.includes(2);
            
            // Get names - use actual name if connected or match complete, otherwise "Waiting..."
            const p1Name = room.names?.[1] || room.names?.["1"];
            const p2Name = room.names?.[2] || room.names?.["2"];
            
            // Show "Waiting..." only if player not connected AND match not complete AND name is default
            const isDefaultP1 = !p1Name || p1Name === "Player 1";
            const isDefaultP2 = !p2Name || p2Name === "Player 2";
            
            const p1 = (p1Connected || room.match_complete || !isDefaultP1) ? (p1Name || "Player 1") : "Waiting...";
            const p2 = (p2Connected || room.match_complete || !isDefaultP2) ? (p2Name || "Player 2") : "Waiting...";
            
            const s1 = room.wins?.[1] || room.wins?.["1"] || 0;
            const s2 = room.wins?.[2] || room.wins?.["2"] || 0;
            
            // Check if match is complete (from server flag or score)
            const matchComplete = room.match_complete || s1 >= pointsToWin || s2 >= pointsToWin;
            const p1Won = s1 >= pointsToWin;
            const p2Won = s2 >= pointsToWin;
            
            // Format scores with green for winner
            const s1Style = p1Won ? 'style="color: #2ecc71; font-weight: bold;"' : '';
            const s2Style = p2Won ? 'style="color: #2ecc71; font-weight: bold;"' : '';
            
            // Add visual indicator for completed matches
            const rowClass = matchComplete ? 'match-complete-row' : '';
            
            rows.push(`<tr class="${rowClass}">
                <td>${p1}</td>
                <td class="score"><span ${s1Style}>${s1}</span> - <span ${s2Style}>${s2}</span></td>
                <td>${p2}</td>
            </tr>`);
        }
        
        // Add Bye row if there's a bye player this round
        if (byePlayer && compState === "in_progress") {
            rows.push(`<tr class="bye-row">
                <td colspan="3" style="text-align: center; color: #f39c12;">🎫 Bye: ${byePlayer}</td>
            </tr>`);
        }
        
        // If waiting for players, show empty slots for arenas without rooms
        if (compState === "waiting_for_players") {
            for (let i = rooms.length; i < arenas; i++) {
                rows.push(`<tr>
                    <td>Waiting...</td>
                    <td class="score">--</td>
                    <td>Waiting...</td>
                </tr>`);
            }
        }
        
        // If no rows but competition is in progress, rooms may have been cleared between rounds
        if (rows.length === 0 && compState === "in_progress") {
            rows.push(`<tr><td colspan="3" style="text-align: center;">Starting next round...</td></tr>`);
        }
        
        // If no rows and waiting for players, show all empty slots
        if (rows.length === 0 && compState === "waiting_for_players") {
            for (let i = 0; i < arenas; i++) {
                rows.push(`<tr>
                    <td>Waiting...</td>
                    <td class="score">--</td>
                    <td>Waiting...</td>
                </tr>`);
            }
        }
        
        entryMatchesBody.innerHTML = rows.join("");
    }
}

function updateCompetitionDisplay(compData) {
    if (competitionRoundInfo) {
        const round = compData.round || 1;
        const totalRounds = compData.total_rounds || 1;
        
        if (compData.state === "waiting_for_players") {
            competitionRoundInfo.textContent = `Waiting for players (${compData.players}/${compData.required})`;
        } else if (compData.state === "complete") {
            if (compData.champion) {
                competitionRoundInfo.textContent = `🏆 Champion: ${compData.champion}`;
            } else {
                competitionRoundInfo.textContent = `Competition Complete`;
            }
        } else {
            competitionRoundInfo.textContent = `Round ${round} of ${totalRounds}`;
        }
    }
}

function updateServerSettingsDisplay(available = true) {
    const gridEl = document.getElementById("setting-grid");
    const speedEl = document.getElementById("setting-speed");
    const pointsEl = document.getElementById("setting-points");
    const contentEl = document.getElementById("server-settings-content");
    const unavailableEl = document.getElementById("server-unavailable");
    
    if (available) {
        if (contentEl) contentEl.classList.remove("hidden");
        if (unavailableEl) unavailableEl.classList.add("hidden");
        if (gridEl) gridEl.textContent = `${serverSettings.gridWidth}x${serverSettings.gridHeight}`;
        if (speedEl) speedEl.textContent = `${serverSettings.speed}s`;
        if (pointsEl) pointsEl.textContent = serverSettings.pointsToWin;
    } else {
        if (contentEl) contentEl.classList.add("hidden");
        if (unavailableEl) unavailableEl.classList.remove("hidden");
    }
}

async function addAiPlayer() {
    const baseUrl = getServerUrl();
    if (!baseUrl) return;
    
    // Spawn a CopperBot via WebSocket connection
    addAiBtn.disabled = true;
    addAiBtn.textContent = "Adding AI...";
    
    try {
        const httpUrl = baseUrl.replace(/^ws/, "http").replace(/\/ws\/?$/, "");
        const response = await fetch(httpUrl + "/add_bot", { method: "POST" });
        if (response.ok) {
            addAiBtn.textContent = "AI Added!";
            setTimeout(() => {
                addAiBtn.textContent = "Add AI Player";
                fetchServerStatus();
            }, 1500);
        } else {
            addAiBtn.textContent = "Failed";
            setTimeout(() => {
                addAiBtn.textContent = "Add AI Player";
                addAiBtn.disabled = !hasOpenMatches;
            }, 1500);
        }
    } catch (e) {
        addAiBtn.textContent = "Error";
        setTimeout(() => {
            addAiBtn.textContent = "Add AI Player";
            addAiBtn.disabled = !hasOpenMatches;
        }, 1500);
    }
}

function getServerUrl() {
    if (serverUrlSelect.value === "custom") {
        return serverUrlCustom.value.trim();
    }
    return serverUrlSelect.value;
}

function connectWithMode(mode) {
    const baseUrl = getServerUrl();
    gameMode = mode;
    playerName = playerNameInput.value.trim() || "Human";
    isObserver = false;

    if (!baseUrl) {
        alert("Please enter a server URL");
        return;
    }

    stopStatusPolling();
    disableAllButtons();
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

    stopStatusPolling();
    disableAllButtons();
    setStatus("Connecting as observer...", "");
    
    const wsUrl = baseUrl.replace(/\/ws\/?$/, "") + "/ws/observe";
    connectWebSocket(wsUrl);
}

function disableAllButtons() {
    if (playBtn) playBtn.disabled = true;
    if (addAiBtn) addAiBtn.disabled = true;
    if (observeBtn) observeBtn.disabled = true;
}

function enableAllButtons() {
    if (observeBtn) observeBtn.disabled = false;
    // Play and Add AI buttons are controlled by server status
    fetchServerStatus();
}

function connectWebSocket(wsUrl) {
    try {
        ws = new WebSocket(wsUrl);
    } catch (e) {
        setStatus("Invalid URL", "error");
        enableAllButtons();
        return;
    }

    ws.onopen = () => {
        setupPanel.classList.add("hidden");
        gamePanel.classList.remove("hidden");
        
        if (isObserver) {
            readyBtn.classList.add("hidden");
            setStatus("Waiting for match to begin...", "connected");
        } else {
            readyBtn.classList.remove("hidden");
            restorePlayerInstructions();
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
        } else if (isObserver) {
            // For observers, try to reconnect after a brief delay
            setStatus("Connection lost - reconnecting...", "error");
            setTimeout(() => {
                if (isObserver) {
                    observe();
                }
            }, 2000);
            return;
        } else {
            setStatus("Disconnected", "error");
        }
        readyBtn.classList.add("hidden");
        enableAllButtons();
    };

    ws.onerror = () => {
        setStatus("Connection error", "error");
        enableAllButtons();
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
            const p1Name = names[1] || names["1"] || "Player 1";
            const p2Name = names[2] || names["2"] || "Player 2";
            if (gameState && gameState.running) {
                setStatus(`Round ${currentRound || 1} Match in Progress: ${p1Name} vs ${p2Name}`, "playing");
            } else {
                setStatus(`Waiting for match to begin...`, "connected");
            }
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
            const oldRound = currentRound;
            activeRooms = data.rooms || [];
            
            // If we were following a winner and this is a new round, find their room
            if (observerFollowingPlayer && observerMatchComplete) {
                const winnerRoom = activeRooms.find(r => 
                    r.names && (r.names[1] === observerFollowingPlayer || r.names[2] === observerFollowingPlayer)
                );
                if (winnerRoom && winnerRoom.room_id !== roomId) {
                    // Switch to winner's new room
                    roomId = winnerRoom.room_id;
                    currentRoomIndex = activeRooms.findIndex(r => r.room_id === roomId);
                    observerMatchComplete = false;
                    if (ws && ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ action: "switch_room", room_id: roomId }));
                    }
                    const p1 = winnerRoom.names?.[1] || "Player 1";
                    const p2 = winnerRoom.names?.[2] || "Player 2";
                    setStatus(`Round ${currentRound} Match in Progress: ${p1} vs ${p2}`, "playing");
                }
            } else {
                currentRoomIndex = activeRooms.findIndex(r => r.room_id === data.current_room);
                if (currentRoomIndex < 0) currentRoomIndex = 0;
            }
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
            // Update server settings from game state
            if (data.game && data.game.grid) {
                serverSettings.gridWidth = data.game.grid.width;
                serverSettings.gridHeight = data.game.grid.height;
            }
            if (data.points_to_win) {
                pointsToWin = data.points_to_win;
                serverSettings.pointsToWin = pointsToWin;
            }
            gameState = data.game;
            updateCanvas();
            updateScores();
            updateMatchInfo();
            if (isObserver && gameState.running) {
                const obsP1 = names[1] || names["1"] || "Player 1";
                const obsP2 = names[2] || names["2"] || "Player 2";
                setStatus(`Round ${currentRound || 1} Match in Progress: ${obsP1} vs ${obsP2}`, "playing");
            }
            break;
        case "start":
            if (isObserver) {
                const startP1 = names[1] || names["1"] || "Player 1";
                const startP2 = names[2] || names["2"] || "Player 2";
                setStatus(`Round ${currentRound} Match in Progress: ${startP1} vs ${startP2}`, "playing");
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
            if (data.points_to_win) {
                pointsToWin = data.points_to_win;
            }
            updateScores();
            updateMatchInfo();
            
            if (isObserver) {
                const winnerName = data.winner ? (names[data.winner] || "Unknown") : "No one";
                setStatus(`${winnerName} Wins the Game! Next game starting soon...`, "connected");
                
                // Request updated room list periodically
                const roomUpdateInterval = setInterval(() => {
                    if (ws && ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ action: "get_rooms" }));
                    } else {
                        clearInterval(roomUpdateInterval);
                    }
                }, 1000);
                // Clear interval after 10 seconds
                setTimeout(() => clearInterval(roomUpdateInterval), 10000);
            } else {
                const opponentId = playerId === 1 ? 2 : 1;
                const opponentName = names[opponentId] || "Opponent";
                const myWins = wins[playerId] || 0;
                const oppWins = wins[opponentId] || 0;
                let msg;
                if (data.winner === null) {
                    msg = `Draw! Score: ${myWins}-${oppWins} (first to ${pointsToWin})`;
                    sfx.lose();
                } else if (data.winner === playerId) {
                    msg = `🏆 You Win! Score: ${myWins}-${oppWins}`;
                    sfx.win();
                } else {
                    msg = `${opponentName} Wins - Score: ${myWins}-${oppWins}`;
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
            
        // Competition mode messages
        case "competition_status":
            competitionState = data.state;
            currentRound = data.round || 0;
            totalRounds = data.total_rounds || 1;
            if (data.pairings) {
                activeRooms = data.pairings.map(p => ({
                    room_id: p.arena,
                    names: { 1: p.player1.name, 2: p.player2.name },
                    wins: { 1: 0, 2: 0 }
                }));
            }
            updateMatchInfo();
            updateObserverInfo();
            setStatus(`Competition Round ${currentRound} of ${totalRounds}`, "connected");
            break;
            
        case "match_assigned":
            roomId = data.room_id;
            playerId = data.player_id;
            pointsToWin = data.points_to_win || 5;
            serverSettings.pointsToWin = pointsToWin;
            setStatus(`Match starting! vs ${data.opponent}`, "connected");
            updateMatchInfo();
            break;
            
        case "match_complete":
            // Update scores with final score
            if (data.final_score) {
                wins = data.final_score;
            }
            updateScores();
            
            const matchWinnerName = data.winner?.name || "Unknown";
            const matchWinnerId = data.winner?.player_id;
            const loserId = matchWinnerId === 1 ? 2 : 1;
            const loserName = names[loserId] || "Unknown";
            const score1 = data.final_score?.[1] || 0;
            const score2 = data.final_score?.[2] || 0;
            const remainingMatches = data.remaining_matches || 0;
            
            if (isObserver) {
                // Track winner to follow to next round
                observerFollowingPlayer = matchWinnerName;
                observerMatchComplete = true;
                
                // Show green status for match complete
                let matchMsg = `Round ${currentRound} Match Complete: ${matchWinnerName} Wins! Waiting for next round to begin...`;
                setStatus(matchMsg, "match-complete");
            } else {
                // Check if current player won or lost
                if (matchWinnerId === playerId) {
                    setStatus(`🏆 Match Victory! You win ${score1}-${score2}! ` + 
                        (remainingMatches > 0 ? `Waiting for ${remainingMatches} match${remainingMatches > 1 ? 'es' : ''}.` : 'Round complete.'), 
                        "connected");
                    sfx.win();
                } else {
                    setStatus(`Match Over - ${matchWinnerName} wins ${score1}-${score2}`, "connected");
                    sfx.lose();
                }
                // Reset for next match
                wins = {1: 0, 2: 0};
                readyBtn.classList.remove("hidden");
                readyBtn.textContent = "Play Again";
            }
            updateMatchInfo();
            break;
            
        case "competition_complete":
            const champion = data.champion?.name || "Unknown";
            const resetIn = data.reset_in || 10;
            
            if (isObserver) {
                setStatus(`🏆 Competition Champion: ${champion}!`, "connected");
            } else {
                setStatus(`🏆 Competition Champion: ${champion}! Resetting in ${resetIn}s...`, "connected");
                
                // Start countdown display for players only
                let countdown = resetIn;
                const countdownInterval = setInterval(() => {
                    countdown--;
                    if (countdown > 0) {
                        setStatus(`🏆 Competition Champion: ${champion}! Resetting in ${countdown}s...`, "connected");
                    } else {
                        clearInterval(countdownInterval);
                        returnToEntryScreen();
                    }
                }, 1000);
            }
            break;
            
        case "round_complete":
            // Round ended, show winner
            const roundWinner = data.winner?.name || "Unknown";
            const nextRound = currentRound + 1;
            if (isObserver) {
                setStatus(`Round ${currentRound} Complete: ${roundWinner} Advances to Round ${nextRound}! Next round starting soon...`, "connected");
            } else {
                const nextRoundIn = data.next_round_in || 5;
                setStatus(`Round ${currentRound} complete! ${roundWinner} advances. Next round in ${nextRoundIn}s...`, "connected");
            }
            break;
            
        case "eliminated":
            // Player was eliminated from competition
            setStatus(`Eliminated from competition. Returning to menu...`, "connected");
            setTimeout(() => {
                returnToEntryScreen();
            }, 3000);
            break;
            
        case "lobby_status":
            setStatus(`Waiting for players: ${data.current}/${data.required}`, "connected");
            break;
            
        case "registered":
            setStatus(`Registered as ${data.name}. Waiting for competition to start...`, "connected");
            if (data.competition_status) {
                serverSettings.pointsToWin = data.competition_status.points_to_win || 5;
                updateServerSettingsDisplay();
            }
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
        
        // Show match info
        pointsToWin = serverSettings.pointsToWin;
        updateMatchInfo();
    }
}

function returnToEntryScreen() {
    if (ws) {
        ws.close();
        ws = null;
    }
    gameState = null;
    isObserver = false;
    roomId = null;
    competitionState = null;
    currentRound = 0;
    wins = {1: 0, 2: 0};
    gamePanel.classList.add("hidden");
    setupPanel.classList.remove("hidden");
    enableAllButtons();
    setStatus("Waiting to connect...", "");
    restorePlayerInstructions();
    startStatusPolling();
}

function handleKeydown(event) {
    // ESC returns to setup screen
    if (event.code === "Escape") {
        returnToEntryScreen();
        return;
    }

    // Observers can use Up/Down to switch rooms
    if (isObserver) {
        if (event.code === "ArrowUp" || event.code === "ArrowDown") {
            if (activeRooms.length > 1) {
                if (event.code === "ArrowUp") {
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
        <thead><tr><th colspan="2">Score</th></tr></thead>
        <tbody>
            <tr class="player1"><td>${player1Name}</td><td>${player1Wins}</td></tr>
            <tr class="player2"><td>${player2Name}</td><td>${player2Wins}</td></tr>
        </tbody>
    </table>`;
    scoresDiv.innerHTML = html;
}

function updateMatchInfo() {
    if (!matchInfoDiv) return;
    
    // Sync pointsToWin from server settings
    if (serverSettings.pointsToWin) {
        pointsToWin = serverSettings.pointsToWin;
    }
    
    if (currentRound > 0 || pointsToWin > 0) {
        matchInfoDiv.classList.remove("hidden");
        
        if (roundInfoDiv) {
            roundInfoDiv.innerHTML = `Round <span>${currentRound}</span> of <span>${totalRounds}</span>`;
        }
        if (pointsToWinInfoDiv) {
            pointsToWinInfoDiv.innerHTML = `First to <span>${pointsToWin}</span> wins`;
        }
    } else {
        matchInfoDiv.classList.add("hidden");
    }
}

function updateObserverInfo() {
    if (!isObserver) return;
    
    // Update the instructions panel to show observer info
    const instructionsDiv = document.getElementById("instructions");
    if (!instructionsDiv) return;
    
    // Build matches table with live scores
    const pointsToWin = serverSettings.pointsToWin || 5;
    const byePlayer = window.lastCompetitionData?.bye_player;
    
    let matchRows = [];
    if (activeRooms.length > 0) {
        matchRows = activeRooms.map(r => {
            const isCurrent = r.room_id === roomId;
            const p1 = r.names?.[1] || "Player 1";
            const p2 = r.names?.[2] || "Player 2";
            const s1 = r.wins?.[1] || 0;
            const s2 = r.wins?.[2] || 0;
            
            // Check if match is complete
            const p1Won = s1 >= pointsToWin;
            const p2Won = s2 >= pointsToWin;
            
            const s1Style = p1Won ? 'style="color: #2ecc71; font-weight: bold;"' : '';
            const s2Style = p2Won ? 'style="color: #2ecc71; font-weight: bold;"' : '';
            
            return `<tr class="${isCurrent ? 'current-match' : ''}">
                <td>${p1}</td>
                <td class="score"><span ${s1Style}>${s1}</span> - <span ${s2Style}>${s2}</span></td>
                <td>${p2}</td>
            </tr>`;
        });
    }
    
    // Add Bye row if there's a bye player this round
    if (byePlayer) {
        matchRows.push(`<tr class="bye-row">
            <td colspan="3" style="text-align: center; color: #f39c12;">🎫 Bye: ${byePlayer}</td>
        </tr>`);
    }
    
    let matchesTableHtml = "";
    if (matchRows.length > 0) {
        matchesTableHtml = `
            <table class="matches-table">
                <tbody>
                    ${matchRows.join("")}
                </tbody>
            </table>`;
    } else {
        matchesTableHtml = "<div>No active matches</div>";
    }
    
    // Show round info if in competition
    let roundHtml = "";
    if (currentRound > 0) {
        roundHtml = `<div style="margin-bottom: 10px; color: #f39c12;">Round ${currentRound} of ${totalRounds}</div>`;
    }
    
    instructionsDiv.innerHTML = `
        <h3>👁️ Observer Mode</h3>
        <div class="instruction-section">
            <h4>Controls</h4>
            <div class="key-row"><span class="key">↑</span> Previous match</div>
            <div class="key-row"><span class="key">↓</span> Next match</div>
            <div class="key-row"><span class="key">Esc</span> Back to menu</div>
        </div>
        <div class="instruction-section">
            <h4>Current Round Matches</h4>
            ${roundHtml}
            ${matchesTableHtml}
        </div>
    `;
}

function restorePlayerInstructions() {
    if (instructionsDiv && originalInstructionsHtml) {
        instructionsDiv.innerHTML = originalInstructionsHtml;
    }
}
