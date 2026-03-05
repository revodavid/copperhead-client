// CopperHead Client

const CELL_SIZE = 20;

let ws = null;
let gameState = null;
let wins = {1: 0, 2: 0};
let names = {1: "Player 1", 2: "Player 2"};
let playerId = 1;
let playerIdAssigned = false; // True once server confirms our player_id
let playerName = "";
let lastSnakeLength = 0;
let lastOpponentLength = 0;
let isObserver = false;
let roomId = null;
let activeRooms = [];
let currentRoomIndex = 0;
let statusPollInterval = null;
let hasOpenMatches = false;
let renderLoopActive = false;
let lastSentDirection = null; // Track last direction sent to server for rapid keypress handling

// Competition mode state
let competitionState = null;
let currentRound = 0;
let totalRounds = 0;
let pointsToWin = 5;
let observerFollowingPlayer = null; // Track winner name to follow between rounds
let observerMatchComplete = false; // Track if we're waiting for next round
let botsBeingAdded = false; // Track if bots are in the process of being added
let lastOpenSlots = null; // Track open slots to detect bot connections
let serverSettings = {
    gridWidth: 30,
    gridHeight: 20,
    speed: 0.15,
    pointsToWin: 5,
    fruits: ["apple"]
};

// Fruit type to emoji mapping
const fruitEmojis = {
    apple: "🍎", orange: "🍊", lemon: "🍋", grapes: "🍇", strawberry: "🍓",
    banana: "🍌", peach: "🍑", cherry: "🍒", watermelon: "🍉", kiwi: "🥝"
};

// DOM elements
const setupPanel = document.getElementById("setup");
const gamePanel = document.getElementById("game");
const playerNameInput = document.getElementById("playerName");
const serverUrlInput = document.getElementById("serverUrl");
const playBtn = document.getElementById("playBtn");
const playBotBtn = document.getElementById("playBotBtn");
const addAiBtn = document.getElementById("addAiBtn");
const observeBtn = document.getElementById("observeBtn"); // May be null if observer card removed
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
const gameStatusDiv = document.getElementById("game-status");
const roundInfoDiv = document.getElementById("round-info");
const pointsToWinInfoDiv = document.getElementById("points-to-win-info");
const originalInstructionsHtml = instructionsDiv ? instructionsDiv.innerHTML : "";
const serverUrlDisplay = document.getElementById("server-url-display");
const serverVersion = document.getElementById("server-version");

// New lobby mode elements
const joinLobbyBtn = document.getElementById("joinLobbyBtn");
const inviteBtn = document.getElementById("inviteBtn");
const adminPlayBtn = document.getElementById("adminPlayBtn");
const adminPlayBotBtn = document.getElementById("adminPlayBotBtn");
const startCompBtn = document.getElementById("startCompBtn");
const lobbyPlayerList = document.getElementById("lobby-player-list");
const copyServerUrlBtn = document.getElementById("copyServerUrlBtn");
const copyToast = document.getElementById("copy-toast");

// Event listeners
playBtn?.addEventListener("click", connectWithMode);
playBotBtn?.addEventListener("click", playAgainstBot);
addAiBtn?.addEventListener("click", addAiPlayer);
observeBtn?.addEventListener("click", observe);
readyBtn?.addEventListener("click", sendReady);
document.addEventListener("keydown", handleKeydown);
serverUrlInput.addEventListener("input", debounce(onServerUrlChange, 500));
serverUrlInput.addEventListener("change", onServerUrlChange);

// New lobby mode event listeners
joinLobbyBtn?.addEventListener("click", toggleLobby);
inviteBtn?.addEventListener("click", copyInviteUrl);
adminPlayBtn?.addEventListener("click", adminPlay);
adminPlayBotBtn?.addEventListener("click", adminPlayBot);
startCompBtn?.addEventListener("click", startTournament);
copyServerUrlBtn?.addEventListener("click", copyServerUrl);

// Read admin token from URL parameter
const adminToken = new URLSearchParams(window.location.search).get('admin');
let adminValidated = false; // True once admin token has been verified with server

function isAdmin() { 
    return !!adminToken && adminValidated; 
}

// Lobby state tracking
let inLobby = false;
let lobbyPlayers = [];
let lobbySlotAssignments = [];
let serverLobbyMode = true;  // Lobby is always active

// Initialize server URL from URL parameter or default to localhost
initializeServerUrl();

// If admin token provided, validate it before showing the UI
if (adminToken) {
    validateAdminToken().then(valid => {
        if (valid) {
            adminValidated = true;
            document.querySelectorAll('.admin-only').forEach(el => {
                el.style.display = '';
            });
            fetchServerStatus();
            startStatusPolling();
        }
        // If invalid, validateAdminToken() already shows the error page
    });
} else {
    // No admin token - normal player/observer mode
    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = 'none';
    });
    updateLobbyButton();
    fetchServerStatus();
    startStatusPolling();
}

// Validate the admin token against the server.
// If invalid, replaces the page with an error message and returns false.
async function validateAdminToken() {
    const baseUrl = getServerUrl();
    if (!baseUrl) {
        showAdminError("No server URL configured.");
        return false;
    }
    
    try {
        const httpUrl = baseUrl.replace(/^ws/, "http").replace(/\/ws\/?$/, "");
        // Use the /lobby endpoint with admin_token to validate
        const response = await fetch(httpUrl + "/lobby/kick?uid=__validate__&admin_token=" + encodeURIComponent(adminToken), { method: "POST" });
        
        if (response.status === 403) {
            showAdminError("Invalid admin token. Please check the admin URL from the server console.");
            return false;
        }
        // 404 means the token was valid but the uid wasn't found — that's fine
        return true;
    } catch (e) {
        showAdminError("Cannot connect to server to validate admin token.");
        return false;
    }
}

// Replace the page with an admin authentication error
function showAdminError(message) {
    const container = document.getElementById("container");
    container.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; color: #e74c3c;">
            <h1>🐍 CopperHead</h1>
            <h2>⚠️ Admin Authentication Failed</h2>
            <p style="color: #ccc; font-size: 1.1em; margin: 20px auto; max-width: 500px;">${message}</p>
            <p style="color: #888; margin-top: 30px;">
                <a href="${window.location.pathname}?server=${encodeURIComponent(getServerUrl())}" 
                   style="color: #3498db;">Continue as a player instead</a>
            </p>
        </div>
    `;
}

// Debounce helper for custom URL input
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function initializeServerUrl() {
    // Check for 'server' URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const serverParam = urlParams.get('server');
    
    if (serverParam) {
        serverUrlInput.value = serverParam;
    } else {
        // Default to localhost for local development
        serverUrlInput.value = "ws://localhost:8765/ws/";
    }
}

function onServerUrlChange() {
    showLoadingState();
    fetchServerStatus();
}

function showLoadingState() {
    if (playBtn) playBtn.disabled = true;
    if (addAiBtn) addAiBtn.disabled = true;
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
            if (statusData.grid_width) {
                serverSettings.gridWidth = statusData.grid_width;
            }
            if (statusData.grid_height) {
                serverSettings.gridHeight = statusData.grid_height;
            }
            if (statusData.version) {
                serverSettings.version = statusData.version;
            }
            if (statusData.points_to_win) {
                serverSettings.pointsToWin = statusData.points_to_win;
            }
            if (statusData.fruits) {
                serverSettings.fruits = statusData.fruits;
                updateFoodItemsDisplay();
            }
            
            updateEntryScreenStatus(statusData);
        }
        
        // Fetch competition info
        const compResponse = await fetch(httpUrl + "/competition");
        if (compResponse.ok) {
            const compData = await compResponse.json();
            if (compData.points_to_win) {
                serverSettings.pointsToWin = compData.points_to_win;
            }
            currentRound = compData.round || 0;
            totalRounds = compData.total_rounds || 1;
            window.lastCompetitionData = compData;  // Store for match table display
            updateCompetitionDisplay(compData);
        }
        
        // Fetch lobby data if in lobby mode
        if (serverLobbyMode) {
            try {
                const lobbyResponse = await fetch(httpUrl + "/lobby");
                if (lobbyResponse.ok) {
                    const lobbyData = await lobbyResponse.json();
                    lobbyPlayers = lobbyData.players || [];
                    lobbySlotAssignments = lobbyData.slot_assignments || [];
                    updateLobbyPanel();
                    
                    // Update Start Competition button color and informational note
                    if (isAdmin() && startCompBtn) {
                        const openSlots = lobbyData.open_slots || 0;
                        const waitingCount = lobbyPlayers.filter(p => !p.in_slot).length;
                        const autoStart = lobbyData.auto_start;
                        const note = document.getElementById("startCompNote");
                        const compState = window.lastCompetitionData?.state || "waiting_for_players";
                        
                        if (compState === "waiting_for_players") {
                            startCompBtn.disabled = false;
                            
                            if (autoStart) {
                                // auto_start ON: players auto-admitted, button adds bots if needed
                                if (openSlots === 0) {
                                    // All slots filled — will auto-start momentarily
                                    startCompBtn.style.background = "#2ecc71";
                                    if (note) note.textContent = "All slots filled — game starting...";
                                } else {
                                    // Open slots remain — button adds bots to fill
                                    startCompBtn.style.background = "#3498db";
                                    if (note) note.textContent = "Bots will be added to the competition.";
                                }
                            } else {
                                // auto_start OFF: admin controls everything
                                if (openSlots === 0) {
                                    startCompBtn.style.background = "#2ecc71";
                                    if (note) note.textContent = "Click to start.";
                                } else if (waitingCount >= openSlots) {
                                    startCompBtn.style.background = "#e67e22";
                                    if (note) note.textContent = "Adds players from lobby and starts.";
                                } else {
                                    startCompBtn.style.background = "#3498db";
                                    if (note) note.textContent = "Adds players from lobby and bots, and starts.";
                                }
                            }
                        } else {
                            // Competition already running
                            startCompBtn.style.background = "#555";
                            startCompBtn.disabled = true;
                            if (note) note.textContent = "";
                        }
                    }
                }
            } catch (e) {
                // Lobby endpoint might not exist on older servers
                console.warn("Lobby endpoint not available:", e);
            }
            
            // Update admin button visibility
            updateAdminButtonVisibility();
        }
        
        // Fetch championship history
        const historyResponse = await fetch(httpUrl + "/history");
        if (historyResponse.ok) {
            const historyData = await historyResponse.json();
            updateChampionshipHistory(historyData.championships || []);
        }
        
        updateServerSettingsDisplay(true);
        
        // Update UI state after determining lobby mode
        updateAdminButtonVisibility();
    } catch (e) {
        // Server not reachable
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
    
    // Update Join button - only enabled if there's an open slot
    if (playBtn) {
        playBtn.disabled = !hasOpenMatches;
    }
    
    // Update Play Bot button - enabled only for single-arena competition with open slots
    if (playBotBtn) {
        playBotBtn.disabled = !(arenas === 1 && openSlots === 2);
    }
    
    // Update Add Bot button - enabled if there are open slots
    if (addAiBtn) {
        // Detect auto-spawning bots: server is waiting and bots are still connecting
        const serverBots = statusData.bots || 0;
        const totalPlayers = statusData.total_players || 0;
        if (serverBots > 0 && totalPlayers < serverBots && statusData.competition_state === "waiting_for_players") {
            botsBeingAdded = true;
        }
        
        if (botsBeingAdded) {
            // Keep showing "Adding..." while bots are connecting
            addAiBtn.disabled = true;
            addAiBtn.textContent = "Adding...";
            // Clear the flag once bot has connected
            if (!hasOpenMatches || (lastOpenSlots !== null && openSlots < lastOpenSlots)) {
                botsBeingAdded = false;
                addAiBtn.textContent = "Add Bot";
                addAiBtn.disabled = serverLobbyMode ? false : !hasOpenMatches;
            }
        } else {
            // In lobby mode, always enabled (adds to lobby, not competition)
            addAiBtn.disabled = serverLobbyMode ? false : !hasOpenMatches;
        }
        lastOpenSlots = openSlots;
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
        
        // In lobby mode while waiting, show slots from lobby data instead of room data
        if (serverLobbyMode && compState === "waiting_for_players") {
            // Build match rows from lobby slot assignments
            // Each match needs 2 players; pair up slot assignments
            const maxPlayers = arenas * 2;
            for (let i = 0; i < maxPlayers; i += 2) {
                const p1 = lobbySlotAssignments[i]?.name || "Waiting...";
                const p2 = lobbySlotAssignments[i + 1]?.name || "Waiting...";
                // Red 0-0 scores before competition starts
                rows.push(`<tr>
                    <td>${p1}</td>
                    <td class="score"><span style="color: #e74c3c;">0</span> - <span style="color: #e74c3c;">0</span></td>
                    <td>${p2}</td>
                    <td></td>
                </tr>`);
            }
        } else {
        // Standard mode or competition in progress: show room data
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
            const inProgress = !matchComplete && p1Connected && p2Connected;
            
            // Score colors: green for winner, orange for loser, orange for active games, red for 0-0 waiting
            let s1Style = '';
            let s2Style = '';
            if (matchComplete) {
                // Green for winner, orange for loser
                s1Style = p1Won ? 'style="color: #2ecc71; font-weight: bold;"' : 'style="color: #e67e22;"';
                s2Style = p2Won ? 'style="color: #2ecc71; font-weight: bold;"' : 'style="color: #e67e22;"';
            } else if (inProgress) {
                // Orange for active game scores
                s1Style = 'style="color: #e67e22;"';
                s2Style = 'style="color: #e67e22;"';
            } else if (s1 === 0 && s2 === 0) {
                // Red for 0-0 pre-match
                s1Style = 'style="color: #e74c3c;"';
                s2Style = 'style="color: #e74c3c;"';
            }
            
            // Add visual indicator for completed matches
            const rowClass = matchComplete ? 'match-complete-row' : '';
            
            // Show Observe button for in-progress (non-complete) matches with players
            const observeCell = inProgress 
                ? `<td><button class="btn-observe-match" onclick="observeRoom('${room.room_id}')">Observe</button></td>`
                : `<td></td>`;
            
            rows.push(`<tr class="${rowClass}">
                <td>${p1}</td>
                <td class="score"><span ${s1Style}>${s1}</span> - <span ${s2Style}>${s2}</span></td>
                <td>${p2}</td>
                ${observeCell}
            </tr>`);
        }
        
        // Add Bye row if there's a bye player this round
        if (byePlayer && compState === "in_progress") {
            rows.push(`<tr class="bye-row">
                <td colspan="4" style="text-align: center; color: #f39c12;">🎫 Bye: ${byePlayer}</td>
            </tr>`);
        }
        
        // If waiting for players, show empty slots for arenas without rooms
        if (compState === "waiting_for_players") {
            for (let i = rooms.length; i < arenas; i++) {
                rows.push(`<tr>
                    <td>Waiting...</td>
                    <td class="score">--</td>
                    <td>Waiting...</td>
                    <td></td>
                </tr>`);
            }
        }
        
        // If no rows but competition is in progress, rooms may have been cleared between rounds
        if (rows.length === 0 && compState === "in_progress") {
            rows.push(`<tr><td colspan="4" style="text-align: center;">Starting next round...</td></tr>`);
        }
        
        // If no rows and waiting for players, show all empty slots
        if (rows.length === 0 && compState === "waiting_for_players") {
            for (let i = 0; i < arenas; i++) {
                rows.push(`<tr>
                    <td>Waiting...</td>
                    <td class="score">--</td>
                    <td>Waiting...</td>
                    <td></td>
                </tr>`);
            }
        }
        } // end else (standard mode / competition in progress)
        
        entryMatchesBody.innerHTML = rows.join("");
    }
}

function updateCompetitionDisplay(compData) {
    if (competitionRoundInfo) {
        const round = compData.round || 1;
        const totalRounds = compData.total_rounds || 1;
        const resetIn = compData.reset_in || 0;
        
        if (compData.state === "waiting_for_players") {
            competitionRoundInfo.textContent = `Waiting for players to join... (${compData.players}/${compData.required})`;
        } else if (compData.state === "complete") {
            if (compData.champion) {
                if (resetIn > 0) {
                    competitionRoundInfo.textContent = `Winner: ${compData.champion}! New competition starting in ${resetIn} seconds...`;
                } else {
                    competitionRoundInfo.textContent = `🏆 Winner: ${compData.champion}!`;
                }
            } else {
                competitionRoundInfo.textContent = `Competition Complete`;
            }
        } else {
            competitionRoundInfo.textContent = `Round ${round} in Progress`;
        }
    }
    
    // Update Join button text based on competition state
    if (playBtn) {
        if (compData.state === "complete") {
            playBtn.textContent = "Competition in Progress";
            playBtn.disabled = true;
        } else if (compData.state === "in_progress" && !hasOpenMatches) {
            playBtn.textContent = "Competition in Progress";
            playBtn.disabled = true;
        } else {
            playBtn.textContent = "Join";
            playBtn.disabled = !hasOpenMatches;
        }
    }
    
    // Update Play Bot button based on competition state
    if (playBotBtn) {
        if (compData.state === "complete" || compData.state === "in_progress") {
            playBotBtn.disabled = true;
        }
        // Note: enabled state for waiting is handled in updateEntryScreenStatus
    }
}

function updateServerSettingsDisplay(available = true) {
    const gridEl = document.getElementById("setting-grid");
    const speedEl = document.getElementById("setting-speed");
    const pointsEl = document.getElementById("setting-points");
    const contentEl = document.getElementById("server-settings-content");
    const unavailableEl = document.getElementById("server-unavailable");
    
    // Update server URL and version in header
    const wsUrl = getServerUrl();
    if (serverUrlDisplay) {
        serverUrlDisplay.textContent = wsUrl || "--";
    }
    if (serverVersion && serverSettings.version) {
        serverVersion.textContent = `(v${serverSettings.version})`;
    }
    
    if (available) {
        if (contentEl) contentEl.classList.remove("hidden");
        if (unavailableEl) unavailableEl.classList.add("hidden");
        if (gridEl) gridEl.textContent = `${serverSettings.gridWidth}x${serverSettings.gridHeight}`;
        if (speedEl) speedEl.textContent = `${serverSettings.speed}s`;
        if (pointsEl) pointsEl.textContent = serverSettings.pointsToWin;
    } else {
        if (contentEl) contentEl.classList.add("hidden");
        if (unavailableEl) unavailableEl.classList.remove("hidden");
        if (serverVersion) serverVersion.textContent = "";
    }
}

function updateChampionshipHistory(championships) {
    const historySection = document.getElementById("championship-history");
    const historyList = document.getElementById("history-list");
    
    if (!historySection || !historyList) return;
    
    if (championships.length === 0) {
        historySection.classList.add("hidden");
        return;
    }
    
    historySection.classList.remove("hidden");
    
    // Show most recent first, limit to 10
    const recent = championships.slice(-10).reverse();
    
    historyList.innerHTML = recent.map((entry, index) => {
        const date = new Date(entry.timestamp);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `<div class="history-entry">
            <span class="champion-name">🏆 ${entry.champion}</span>
            <span class="history-details">${entry.players} players • ${timeStr}</span>
        </div>`;
    }).join("");
}

function updateFoodItemsDisplay() {
    const foodItemsEl = document.getElementById("food-items");
    if (!foodItemsEl) return;
    
    const fruits = serverSettings.fruits || ["apple"];
    const emojis = fruits.map(f => fruitEmojis[f] || "🍎").join(" ");
    foodItemsEl.textContent = emojis;
}

async function addAiPlayer() {
    const baseUrl = getServerUrl();
    if (!baseUrl) return;
    
    // Get selected difficulty
    const difficultySelect = document.getElementById("aiDifficultySelect");
    const difficultyValue = difficultySelect ? difficultySelect.value : "random";
    
    // Show loading state
    addAiBtn.disabled = true;
    addAiBtn.textContent = "Adding...";
    botsBeingAdded = true;
    
    try {
        const httpUrl = baseUrl.replace(/^ws/, "http").replace(/\/ws\/?$/, "");
        
        // In lobby mode, use the lobby endpoint (requires admin token)
        if (serverLobbyMode) {
            const adminParam = adminToken ? `&admin_token=${adminToken}` : '';
            
            const difficulty = difficultyValue === "random" ? Math.floor(Math.random() * 10) + 1 : parseInt(difficultyValue);
            const resp = await fetch(httpUrl + `/lobby/add_bot?difficulty=${difficulty}${adminParam}`, { method: "POST" });
            if (!resp.ok) {
                botsBeingAdded = false;
                addAiBtn.textContent = "Failed";
                setTimeout(() => { addAiBtn.textContent = "Add Bot"; addAiBtn.disabled = false; }, 1500);
                return;
            }
            
            botsBeingAdded = false;
            addAiBtn.textContent = "Add Bot";
            await fetchServerStatus();
            return;
        }
        
        // Add a single bot with specified or random difficulty
        const difficulty = difficultyValue === "random" ? Math.floor(Math.random() * 10) + 1 : parseInt(difficultyValue);
        const response = await fetch(httpUrl + "/add_bot?difficulty=" + difficulty, { method: "POST" });
        if (response.ok) {
            // Let fetchServerStatus handle button state via botsBeingAdded flag
            await fetchServerStatus();
        } else {
            botsBeingAdded = false;
            addAiBtn.textContent = "Failed";
            setTimeout(() => {
                addAiBtn.textContent = "Add Bot";
                addAiBtn.disabled = serverLobbyMode ? false : !hasOpenMatches;
            }, 1500);
        }
    } catch (e) {
        botsBeingAdded = false;
        addAiBtn.textContent = "Error";
        setTimeout(() => {
            addAiBtn.textContent = "Add Bot";
            addAiBtn.disabled = serverLobbyMode ? false : !hasOpenMatches;
        }, 1500);
    }
}

// Play against a bot - first spawn a bot, then join as a player
async function playAgainstBot() {
    const baseUrl = getServerUrl();
    if (!baseUrl) {
        alert("Please enter a server URL");
        return;
    }
    
    // Show loading state on button
    playBotBtn.disabled = true;
    playBotBtn.textContent = "Starting...";
    
    try {
        const httpUrl = baseUrl.replace(/^ws/, "http").replace(/\/ws\/?$/, "");
        
        // Spawn a bot with random difficulty
        const difficulty = Math.floor(Math.random() * 10) + 1;
        const response = await fetch(httpUrl + "/add_bot?difficulty=" + difficulty, { method: "POST" });
        
        if (!response.ok) {
            playBotBtn.textContent = "Failed";
            setTimeout(() => {
                playBotBtn.textContent = "Play Bot";
                fetchServerStatus();
            }, 1500);
            return;
        }
        
        // Bot spawned, now join as a player
        playBotBtn.textContent = "Play Bot";
        connectWithMode();
    } catch (e) {
        playBotBtn.textContent = "Error";
        setTimeout(() => {
            playBotBtn.textContent = "Play Bot";
            fetchServerStatus();
        }, 1500);
    }
}

function getServerUrl() {
    return serverUrlInput.value.trim();
}

function connectWithMode() {
    const baseUrl = getServerUrl();
    playerName = playerNameInput.value.trim() || "Human";
    isObserver = false;

    if (!baseUrl) {
        alert("Please enter a server URL");
        return;
    }

    stopStatusPolling();
    disableAllButtons();
    setStatus("Connecting...", "waiting");
    
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
    setStatus("Connecting as observer...", "waiting");
    
    const wsUrl = baseUrl.replace(/\/ws\/?$/, "") + "/ws/observe";
    connectWebSocket(wsUrl);
}

// Observe a specific room from the match table
function observeRoom(roomId) {
    const baseUrl = getServerUrl();
    isObserver = true;
    playerName = "Observer";

    if (!baseUrl) return;

    stopStatusPolling();
    disableAllButtons();
    setStatus("Connecting as observer...", "waiting");
    
    const wsUrl = baseUrl.replace(/\/ws\/?$/, "") + "/ws/observe?room=" + encodeURIComponent(roomId);
    connectWebSocket(wsUrl);
}

function disableAllButtons() {
    if (playBtn) playBtn.disabled = true;
    if (addAiBtn) addAiBtn.disabled = true;
    if (observeBtn) observeBtn.disabled = true;
}

function enableAllButtons() {
    if (observeBtn) observeBtn.disabled = false;
    // Play and Add Bot buttons are controlled by server status
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
        if (serverLobbyMode && !isObserver) {
            // In lobby mode for regular players, don't switch to game panel immediately
            // Stay on setup panel until match_assigned
            setStatus("Connected to lobby. Waiting for match assignment...", "waiting");
        } else {
            // Normal behavior: switch to game panel
            setupPanel.classList.add("hidden");
            gamePanel.classList.remove("hidden");
        }
        
        if (isObserver) {
            readyBtn.classList.add("hidden");
            setStatus("Waiting for match to begin...", "waiting");
            if (!serverLobbyMode) {
                setupPanel.classList.add("hidden");
                gamePanel.classList.remove("hidden");
            }
        } else {
            readyBtn.classList.remove("hidden");
            readyBtn.textContent = "Start Match";
            restorePlayerInstructions();
            
            if (!serverLobbyMode) {
                setStatus("Connected! Click Ready to start.", "waiting");
            }
        }
        
        // Send the ready message with player name
        if (ws.readyState === WebSocket.OPEN) {
            const msg = { action: "ready", name: playerName };
            ws.send(JSON.stringify(msg));
        }
        
        updateFoodItemsDisplay();
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
            playerIdAssigned = true;
            roomId = data.room_id;
            setStatus(`Round begins. Click Start Match to start.`, "waiting");
            break;
        case "observer_lobby":
            // Observer waiting for games
            roomId = null;
            gameState = null;
            activeRooms = [];
            setStatus("No active games - waiting...", "waiting");
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
                setStatus(`Round ${currentRound || 1} Game in Progress`, "playing");
            } else {
                setStatus(`Waiting for match to begin...`, "waiting");
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
            
            // Update round info if provided
            if (data.round !== undefined) {
                currentRound = data.round;
            }
            if (data.total_rounds !== undefined) {
                totalRounds = data.total_rounds;
            }
            // Update bye info for observer display
            if (data.bye_player !== undefined) {
                if (!window.lastCompetitionData) window.lastCompetitionData = {};
                window.lastCompetitionData.bye_player = data.bye_player;
            }
            
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
                    setStatus(`Round ${currentRound} Game in Progress`, "playing");
                } else if (!winnerRoom && activeRooms.length > 0) {
                    // Winner has a bye - switch to first active match
                    const byePlayerName = observerFollowingPlayer;
                    const firstRoom = activeRooms[0];
                    roomId = firstRoom.room_id;
                    currentRoomIndex = 0;
                    observerMatchComplete = false;
                    observerFollowingPlayer = null; // Stop following, they have a bye
                    if (ws && ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ action: "switch_room", room_id: roomId }));
                    }
                    const p1 = firstRoom.names?.[1] || "Player 1";
                    const p2 = firstRoom.names?.[2] || "Player 2";
                    setStatus(`${byePlayerName} has a Bye. Watching: ${p1} vs ${p2}`, "playing");
                }
            } else {
                currentRoomIndex = activeRooms.findIndex(r => r.room_id === data.current_room);
                if (currentRoomIndex < 0) currentRoomIndex = 0;
            }
            updateObserverInfo();
            updateMatchInfo();
            break;
        case "state":
            // Sound effects only for players, not observers
            if (!isObserver && data.game.running) {
                const mySnake = data.game.snakes[playerId];
                const opponentId = playerId === 1 ? "2" : "1";
                const opponentSnake = data.game.snakes[opponentId];
                
                // Initialize lengths if not set (first state after joining)
                if (lastSnakeLength === 0 && mySnake) {
                    lastSnakeLength = mySnake.body.length;
                }
                if (lastOpponentLength === 0 && opponentSnake) {
                    lastOpponentLength = opponentSnake.body.length;
                }
                
                // Check if player ate food (snake grew)
                if (mySnake && mySnake.body.length > lastSnakeLength) {
                    sfx.eat();
                }
                // Always update to current length (handles shrinking from grapes too)
                if (mySnake) {
                    lastSnakeLength = mySnake.body.length;
                }
                
                // Check if opponent ate food
                if (opponentSnake && opponentSnake.body.length > lastOpponentLength) {
                    sfx.opponentEat();
                }
                if (opponentSnake) {
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
                setStatus(`Round ${currentRound || 1} Game in Progress`, "playing");
            }
            break;
        case "start":
            if (isObserver) {
                const startP1 = names[1] || names["1"] || "Player 1";
                const startP2 = names[2] || names["2"] || "Player 2";
                setStatus(`Round ${currentRound} Game in Progress`, "playing");
            } else {
                setStatus("Game started!", "playing");
                readyBtn.classList.add("hidden");
                sfx.gameStart();
            }
            lastSnakeLength = 1;
            lastOpponentLength = 1;
            lastSentDirection = null; // Reset for new game
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
                setStatus(`${winnerName} Wins the Game! Next game starting soon...`, "victory");
                
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
                    setStatus(msg, "waiting");
                } else if (data.winner === playerId) {
                    msg = `🏆 You Win! Score: ${myWins}-${oppWins}`;
                    sfx.win();
                    setStatus(msg, "victory");
                } else {
                    msg = `${opponentName} Wins - Score: ${myWins}-${oppWins}`;
                    sfx.death();
                    setStatus(msg, "waiting");
                }
                readyBtn.classList.remove("hidden");
                readyBtn.textContent = "Next Game";
            }
            break;
        case "waiting":
            setStatus(data.message || "Waiting for opponent...", "waiting");
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
            // Show bye status if this player has a bye
            if (!isObserver && data.bye_player && data.bye_player === playerName) {
                setStatus(`You have a bye this round. Waiting for next round to begin.`, "victory");
            } else {
                setStatus(`Competition Round ${currentRound} of ${totalRounds}`, "waiting");
            }
            break;
            
        case "match_assigned":
            roomId = data.room_id;
            playerId = data.player_id;
            playerIdAssigned = true;
            isObserver = false;
            pointsToWin = data.points_to_win || 5;
            serverSettings.pointsToWin = pointsToWin;
            
            // Switch to game panel if we were waiting in lobby mode
            if (serverLobbyMode && setupPanel && !setupPanel.classList.contains("hidden")) {
                setupPanel.classList.add("hidden");
                gamePanel.classList.remove("hidden");
                restorePlayerInstructions();
            }
            
            setStatus(`Round begins. Click Start Round to begin.`, "waiting");
            readyBtn.classList.remove("hidden");
            readyBtn.textContent = "Start Round";
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
                // Check if this is the final round
                if (currentRound >= totalRounds) {
                    // Final round - show result then return to entry screen
                    setStatus(`🏆 Competition Champion: ${matchWinnerName}!`, "victory");
                    setTimeout(() => {
                        returnToEntryScreen();
                    }, 3000);
                } else {
                    // Not final round - track winner to follow to next round
                    observerFollowingPlayer = matchWinnerName;
                    observerMatchComplete = true;
                    
                    // Show victory status for match complete
                    let matchMsg = `Round ${currentRound} Match Complete: ${matchWinnerName} Wins! Waiting for next round to begin...`;
                    setStatus(matchMsg, "victory");
                }
            } else {
                // Check if current player won or lost
                wins = {1: 0, 2: 0};
                if (matchWinnerId === playerId) {
                    const roundNum = data.current_round || currentRound;
                    setStatus(`🏆 Round ${roundNum} complete: You win!`, "victory");
                    sfx.win();
                    // After a delay, update status while waiting for next round
                    setTimeout(() => {
                        // Only update if status hasn't been changed by another message
                        if (!isObserver && matchWinnerId === playerId) {
                            setStatus("Waiting for next round to begin...", "waiting");
                        }
                    }, 3000);
                    // Winner stays on Play screen; server will send match_assigned for next round
                } else {
                    setStatus(`${matchWinnerName} wins the round!`, "waiting");
                    sfx.lose();
                    readyBtn.classList.remove("hidden");
                    readyBtn.textContent = "Return to Lobby";
                }
            }
            updateMatchInfo();
            break;
            
        case "competition_complete":
            const champion = data.champion?.name || "Unknown";
            const resetIn = data.reset_in || 10;
            
            if (isObserver) {
                // Observer returns to entry screen after seeing champion
                setStatus(`🏆 Competition Champion: ${champion}!`, "victory");
                setTimeout(() => {
                    returnToEntryScreen();
                }, 3000);
            } else {
                setStatus(`🏆 Competition Champion: ${champion}! Resetting in ${resetIn}s...`, "victory");
                
                // Start countdown display for players only
                let countdown = resetIn;
                const countdownInterval = setInterval(() => {
                    countdown--;
                    if (countdown > 0) {
                        setStatus(`🏆 Competition Champion: ${champion}! Resetting in ${countdown}s...`, "victory");
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
                setStatus(`Round ${currentRound} Complete: ${roundWinner} Advances to Round ${nextRound}! Next round starting soon...`, "victory");
            } else {
                const nextRoundIn = data.next_round_in || 5;
                setStatus(`Round ${currentRound} complete! ${roundWinner} advances. Next round in ${nextRoundIn}s...`, "victory");
            }
            break;
            
        case "eliminated":
            // Player was eliminated from competition
            setStatus(`Eliminated from competition.`, "waiting");
            readyBtn.classList.remove("hidden");
            readyBtn.textContent = "Return to Lobby";
            break;
            
        case "lobby_status":
            setStatus(`Waiting for players: ${data.current}/${data.required}`, "waiting");
            break;
            
        case "registered":
            setStatus(`Registered as ${data.name}. Waiting for competition to start...`, "waiting");
            if (data.competition_status) {
                serverSettings.pointsToWin = data.competition_status.points_to_win || 5;
                updateServerSettingsDisplay();
            }
            break;
            
        // New lobby mode cases
        case "lobby_update":
            lobbyPlayers = data.players || [];
            lobbySlotAssignments = data.slot_assignments || [];
            updateLobbyPanel();
            break;
            
        case "lobby_joined":
            inLobby = true;
            updateLobbyButton();
            setStatus("Joined lobby. Waiting for competition to start...", "waiting");
            break;
            
        case "lobby_left":
            inLobby = false;
            updateLobbyButton();
            setStatus("Left lobby.", "waiting");
            break;
            
        case "lobby_kicked":
            alert("You have been kicked from the lobby.");
            setStatus("Kicked from lobby.", "error");
            inLobby = false;
            updateLobbyButton();
            if (ws) {
                ws.close();
                ws = null;
            }
            break;
    }
}

function sendReady() {
    // If button says "Return to Lobby", go back to entry screen
    if (readyBtn.textContent === "Return to Lobby") {
        returnToEntryScreen();
        return;
    }
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        const msg = { action: "ready", name: playerName };
        ws.send(JSON.stringify(msg));
        setStatus("Waiting for game to start...", "waiting");
        readyBtn.classList.add("hidden");
        
        // Update goal text
        if (goalText) {
            goalText.textContent = "Outlast your opponent! Avoid walls, yourself, and the enemy snake.";
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
    playerIdAssigned = false;
    roomId = null;
    competitionState = null;
    currentRound = 0;
    wins = {1: 0, 2: 0};
    lastSnakeLength = 0;
    lastOpponentLength = 0;
    gamePanel.classList.add("hidden");
    setupPanel.classList.remove("hidden");
    enableAllButtons();
    setStatus("Waiting to connect...", "waiting");
    restorePlayerInstructions();
    startStatusPolling();
}

function handleKeydown(event) {
    // ESC or backtick returns to setup screen
    if (event.code === "Escape" || event.code === "Backquote") {
        returnToEntryScreen();
        return;
    }

    // Observers can use Up/Down to switch rooms
    if (isObserver) {
        if (event.code === "ArrowUp" || event.code === "ArrowDown") {
            if (activeRooms.length > 1) {
                // Clear auto-follow when user manually switches
                observerFollowingPlayer = null;
                observerMatchComplete = false;
                
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
        
        // Check if the player is trying to reverse direction
        // Use lastSentDirection if available (for rapid keypresses), otherwise use server state
        const opposites = { up: "down", down: "up", left: "right", right: "left" };
        const mySnake = gameState.snakes[playerId] || gameState.snakes[String(playerId)];
        const serverDir = mySnake ? mySnake.direction : null;
        const currentDir = lastSentDirection || serverDir;
        
        // If trying to move in opposite direction, play invalid sound and don't send move
        if (currentDir && opposites[direction] === currentDir) {
            sfx.invalidMove();
        } else {
            sfx.move();
            lastSentDirection = direction; // Track what we sent for rapid keypress handling
            ws.send(JSON.stringify({ action: "move", direction }));
        }
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

    // Draw food items
    const foods = gameState.foods || (gameState.food ? [{x: gameState.food[0], y: gameState.food[1], type: "apple"}] : []);
    const fruitEmojis = {
        apple: "🍎", orange: "🍊", lemon: "🍋", grapes: "🍇", strawberry: "🍓",
        banana: "🍌", peach: "🍑", cherry: "🍒", watermelon: "🍉", kiwi: "🥝"
    };
    for (const food of foods) {
        const emoji = fruitEmojis[food.type] || "🍎";
        ctx.font = `${CELL_SIZE - 4}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        
        // Flash effect when fruit is about to expire (lifetime is reported)
        // Alternate visibility based on remaining lifetime (odd/even ticks)
        let alpha = 1.0;
        if (food.lifetime !== null && food.lifetime !== undefined) {
            // Flash by toggling alpha on alternate ticks, faster as lifetime decreases
            if (food.lifetime <= 5) {
                // Fast flash: every tick
                alpha = (food.lifetime % 2 === 0) ? 1.0 : 0.3;
            } else if (food.lifetime <= 10) {
                // Medium flash: every 2 ticks
                alpha = (Math.floor(food.lifetime / 2) % 2 === 0) ? 1.0 : 0.4;
            } else {
                // Slow flash: every 3 ticks
                alpha = (Math.floor(food.lifetime / 3) % 2 === 0) ? 1.0 : 0.5;
            }
        }
        ctx.globalAlpha = alpha;
        ctx.fillText(emoji, food.x * CELL_SIZE + CELL_SIZE / 2, food.y * CELL_SIZE + CELL_SIZE / 2);
        ctx.globalAlpha = 1.0;
    }

    // Draw snakes
    // For observers: player 1 = green, player 2 = red
    // For players: local player = green, opponent = red
    // Skip drawing snakes if player_id hasn't been assigned yet (avoids wrong colors)
    if (!isObserver && !playerIdAssigned) return;
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
            // Draw eyes on head, rotated to show direction
            if (i === 0) {
                const centerX = segment[0] * CELL_SIZE + CELL_SIZE / 2;
                const centerY = segment[1] * CELL_SIZE + CELL_SIZE / 2;
                
                // Rotation based on direction (👀 default faces left)
                let rotation = 0;
                switch (snake.direction) {
                    case "left": rotation = 0; break;
                    case "right": rotation = Math.PI; break;
                    case "up": rotation = Math.PI / 2; break;
                    case "down": rotation = -Math.PI / 2; break;
                }
                
                ctx.save();
                ctx.translate(centerX, centerY);
                ctx.rotate(rotation);
                ctx.font = `${CELL_SIZE - 6}px Arial`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText("👀", 0, 0);
                ctx.restore();
            }
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
        
        // Update game status (only show "in progress" or winner, not waiting)
        if (gameStatusDiv) {
            const p1Wins = wins[1] || wins["1"] || 0;
            const p2Wins = wins[2] || wins["2"] || 0;
            const p1Name = names[1] || names["1"] || "Player 1";
            const p2Name = names[2] || names["2"] || "Player 2";
            
            if (p1Wins >= pointsToWin) {
                gameStatusDiv.innerHTML = `<span class="winner">${p1Name} wins!</span>`;
            } else if (p2Wins >= pointsToWin) {
                gameStatusDiv.innerHTML = `<span class="winner">${p2Name} wins!</span>`;
            } else if (gameState && gameState.running) {
                gameStatusDiv.innerHTML = `<span class="in-progress">Match in progress</span>`;
            }
            // Don't update if waiting - keep showing previous state (winner or in progress)
        }
        
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
    
    instructionsDiv.innerHTML = `
        <h3>👁️ Observer Mode</h3>
        <div class="instruction-section">
            <h4>Controls</h4>
            <div class="key-row"><span class="key">↑</span> Previous match</div>
            <div class="key-row"><span class="key">↓</span> Next match</div>
            <div class="key-row"><span class="key">Esc</span> or <span class="key">\`</span> Return to lobby</div>
        </div>
        <div class="instruction-section">
            <h4>Current Round Matches</h4>
            ${matchesTableHtml}
        </div>
    `;
}

function restorePlayerInstructions() {
    if (instructionsDiv && originalInstructionsHtml) {
        instructionsDiv.innerHTML = originalInstructionsHtml;
    }
}

// Lobby mode functions

function updateLobbyPanel() {
    const list = document.getElementById('lobby-player-list');
    if (!list) return;
    
    list.innerHTML = '';
    
    if (!serverLobbyMode) {
        list.innerHTML = '<p>Lobby not available</p>';
        return;
    }
    
    if (lobbyPlayers.length === 0) {
        list.innerHTML = '<p>No players in lobby</p>';
        return;
    }
    
    lobbyPlayers.forEach(player => {
        const item = document.createElement('div');
        item.className = 'lobby-player-item';
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = player.name || 'Unknown';
        nameSpan.className = player.in_slot ? 'lobby-player-assigned' : 'lobby-player-waiting';
        item.appendChild(nameSpan);
        
        if (isAdmin()) {
            const addBtn = document.createElement('button');
            addBtn.textContent = 'Admit';
            addBtn.className = 'btn-add-to-slot';
            addBtn.onclick = () => lobbyAddToSlot(player.uid);
            addBtn.disabled = player.in_slot;
            
            const kickBtn = document.createElement('button');
            kickBtn.textContent = 'Kick';
            kickBtn.className = 'btn-kick';
            kickBtn.onclick = () => lobbyKick(player.uid);
            
            item.appendChild(addBtn);
            item.appendChild(kickBtn);
        }
        
        list.appendChild(item);
    });
    
    // Show a "Leave Lobby" button at the bottom of the panel when the player is in the lobby
    if (inLobby) {
        const leaveBtn = document.createElement('button');
        leaveBtn.textContent = 'Leave Lobby';
        leaveBtn.className = 'btn-leave-lobby-panel';
        leaveBtn.onclick = () => toggleLobby();
        list.appendChild(leaveBtn);
    }
}

function updateLobbyButton() {
    if (!joinLobbyBtn) return;
    
    if (inLobby) {
        joinLobbyBtn.textContent = 'Leave Lobby';
        joinLobbyBtn.style.background = '#e67e22'; // Orange
    } else {
        joinLobbyBtn.textContent = 'Join Lobby';
        joinLobbyBtn.style.background = '#27ae60'; // Green
    }
}

function updateAdminButtonVisibility() {
    // Show/hide admin elements based on admin status AND lobby mode
    const isAdminAndLobbyMode = isAdmin() && serverLobbyMode;
    
    document.querySelectorAll('.admin-only').forEach(el => {
        // Use flex for ai-controls (button + dropdown side by side), block for others
        const displayValue = el.classList.contains('ai-controls') ? 'flex' : 'block';
        el.style.display = isAdminAndLobbyMode ? displayValue : 'none';
    });
    
    // Show/hide AI controls - now in lobby panel, always admin-only
    // (handled by .admin-only selector above, no separate logic needed)
    
    // Show/hide lobby vs non-lobby buttons
    if (serverLobbyMode) {
        // Hide original buttons, show lobby buttons
        if (playBtn) playBtn.style.display = 'none';
        if (playBotBtn) playBotBtn.style.display = 'none';
        if (joinLobbyBtn) joinLobbyBtn.style.display = '';
        if (inviteBtn) inviteBtn.style.display = '';
        
        // Show the note about creating bots
        const noteElement = document.querySelector('.note');
        if (noteElement) noteElement.style.display = '';
    } else {
        // Show original buttons, hide lobby buttons  
        if (playBtn) playBtn.style.display = '';
        if (playBotBtn) playBotBtn.style.display = '';
        if (joinLobbyBtn) joinLobbyBtn.style.display = 'none';
        if (inviteBtn) inviteBtn.style.display = 'none';
        
        // Hide the note about creating bots
        const noteElement = document.querySelector('.note');
        if (noteElement) noteElement.style.display = 'none';
    }
    
}

async function toggleLobby() {
    if (!serverLobbyMode) {
        alert('Lobby mode is not enabled on this server.');
        return;
    }
    
    if (inLobby) {
        // Leave lobby
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ action: "leave_lobby" }));
        }
    } else {
        // Join lobby
        playerName = playerNameInput.value.trim() || "Human";
        connectToLobby();
    }
}

function connectToLobby() {
    const wsUrl = getServerUrl();
    if (!wsUrl) {
        setStatus("Invalid server URL", "error");
        return;
    }
    
    // Connect to lobby-specific endpoint
    const lobbyWsUrl = wsUrl.replace('/ws/', '/ws/join');
    
    if (ws) {
        ws.close();
        ws = null;
    }
    
    setStatus("Connecting to lobby...", "waiting");
    
    ws = new WebSocket(lobbyWsUrl);
    
    ws.onopen = () => {
        // Send ready message to join lobby
        const msg = { action: "ready", name: playerName };
        ws.send(JSON.stringify(msg));
    };
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleMessage(data);
    };
    
    ws.onclose = (event) => {
        if (event.code === 4003) {
            setStatus("Unable to join lobby", "error");
        } else {
            setStatus("Disconnected from lobby", "error");
        }
        inLobby = false;
        updateLobbyButton();
    };
    
    ws.onerror = () => {
        setStatus("Connection failed", "error");
        inLobby = false;
        updateLobbyButton();
    };
}

// Admin HTTP action functions
async function lobbyKick(uid) {
    if (!isAdmin() || !adminToken) return;
    
    const baseUrl = getServerUrl();
    if (!baseUrl) return;
    
    try {
        const httpUrl = baseUrl.replace(/^ws/, "http").replace(/\/ws\/?$/, "");
        const response = await fetch(`${httpUrl}/lobby/kick?uid=${uid}&admin_token=${adminToken}`, {
            method: 'POST'
        });
        
        if (!response.ok) {
            alert('Failed to kick player');
        }
        // Server will send lobby_update message to refresh the list
    } catch (e) {
        alert('Error kicking player: ' + e.message);
    }
}

async function lobbyAddToSlot(uid) {
    if (!isAdmin() || !adminToken) return;
    
    const baseUrl = getServerUrl();
    if (!baseUrl) return;
    
    try {
        const httpUrl = baseUrl.replace(/^ws/, "http").replace(/\/ws\/?$/, "");
        const response = await fetch(`${httpUrl}/lobby/add_to_slot?uid=${uid}&admin_token=${adminToken}`, {
            method: 'POST'
        });
        
        if (!response.ok) {
            alert('Failed to add player to slot');
        }
        // Server will send lobby_update message to refresh the list
    } catch (e) {
        alert('Error adding player to slot: ' + e.message);
    }
}

async function startTournament() {
    if (!isAdmin() || !adminToken) return;
    
    const baseUrl = getServerUrl();
    if (!baseUrl) return;
    
    try {
        const httpUrl = baseUrl.replace(/^ws/, "http").replace(/\/ws\/?$/, "");
        const response = await fetch(`${httpUrl}/start_tournament?admin_token=${adminToken}`, {
            method: 'POST'
        });
        
        if (!response.ok) {
            alert('Failed to start tournament');
        }
        // Server will handle starting the tournament
    } catch (e) {
        alert('Error starting tournament: ' + e.message);
    }
}

async function adminPlay() {
    if (!isAdmin() || !adminToken) return;
    
    playerName = playerNameInput.value.trim() || "Admin";
    
    const baseUrl = getServerUrl();
    if (!baseUrl) return;
    
    try {
        const httpUrl = baseUrl.replace(/^ws/, "http").replace(/\/ws\/?$/, "");
        const response = await fetch(`${httpUrl}/lobby/play?admin_token=${adminToken}&name=${encodeURIComponent(playerName)}`, {
            method: 'POST'
        });
        
        if (!response.ok) {
            alert('Failed to join as admin');
            return;
        }
        
        // Connect normally after server adds admin to competition
        connectWithMode();
    } catch (e) {
        alert('Error joining as admin: ' + e.message);
    }
}

async function adminPlayBot() {
    if (!isAdmin() || !adminToken) return;
    
    playerName = playerNameInput.value.trim() || "Admin";
    
    const baseUrl = getServerUrl();
    if (!baseUrl) return;
    
    try {
        const httpUrl = baseUrl.replace(/^ws/, "http").replace(/\/ws\/?$/, "");
        const response = await fetch(`${httpUrl}/lobby/play_bot?admin_token=${adminToken}&name=${encodeURIComponent(playerName)}`, {
            method: 'POST'
        });
        
        if (!response.ok) {
            alert('Failed to start admin vs bot match');
            return;
        }
        
        // Connect normally after server sets up the match
        connectWithMode();
    } catch (e) {
        alert('Error starting admin vs bot match: ' + e.message);
    }
}

// Copy to clipboard functions
function copyInviteUrl() {
    const serverUrl = getServerUrl();
    if (!serverUrl) {
        alert('No server URL available');
        return;
    }
    
    // Create client URL with server parameter
    const clientUrl = window.location.origin + window.location.pathname + '?server=' + encodeURIComponent(serverUrl);
    
    navigator.clipboard.writeText(clientUrl).then(() => {
        showCopyToast();
    }).catch(() => {
        alert('Failed to copy to clipboard');
    });
}

function copyServerUrl() {
    const serverUrl = getServerUrl();
    if (!serverUrl) {
        alert('No server URL available');
        return;
    }
    
    navigator.clipboard.writeText(serverUrl).then(() => {
        showCopyToast();
    }).catch(() => {
        alert('Failed to copy to clipboard');
    });
}

function showCopyToast() {
    if (!copyToast) return;
    
    copyToast.classList.add('show');
    setTimeout(() => {
        copyToast.classList.remove('show');
    }, 2000);
}
