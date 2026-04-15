# Instructions for building Client UI

## Entry screen

This screen appears when first launching the client.

*This page has two modes: Administrator and Player. In Player mode, the UI allows a human player to join a lobby and play games, or to observe games in progress. In Administrator mode, the UI additionally allows the server owner skip the lobby to join the tournament, and to manage players in the lobby, and add bots to the competition.*

### Header (top, centered)

Application logo and name

Tagline: "Compete against human and AI players in a knockout Snake Game tournament!"

### Connect to a Server (top, centered)

Looking for a server? Launch one in [GitHub CodeSpaces](https://github.com/revodavid/copperhead-server).

* Your Name: [Free text. Default: Human]
* Server URL: [Free text. Default: ws://localhost:8765/ws]

### Join the Competition (middle row, left)

*This buttons section of the UI is designed to make it easy for the human user of the client to jump in and play a game against a human or bot oppponent*

* "Join Lobby" (green if one slot remains in an unstarted tournament when auto_start is `"always"`; orange otherwise) - adds the user to the lobby. If the user is already in the lobby, this button changes to "Leave Lobby" (orange) and allows the user to leave the lobby.

* "Invite Opponent ⧉" (orange) - copies the URL of this client to the clipboard, so the user can share it with a friend to invite them to play on the same server. The message "Ask your opponent to visit the URL just copied to the clipboard." appears briefly when the button is clicked.

Include this note: [Create your own bot to play against](https://github.com/revodavid/copperhead-bot).

### Competition Status (middle row, center)

*This section shows the status of the current or upcoming competition*

This section changes format depending on the current status of the competition (see below), but always includes some form of a "Round Table" showing the matches in the current or upcoming round, with player names and scores. 

The Round Table has one row per match in the round. Each row lists the two players in each match, separated by their current score. An example row might look like this:

David 0-2 Copperbot

The left column (player 1 name) is jusified right. The right column (player 2 name) is justified left. The score is centered between them, centered on the - character.

Scores for active games are listed in orange and updated live. Scores for completed game show the winner's score in green and the loser's score in orange.

#### Between Competitions

Title: 🏆 Waiting for players to join

Show round table with all matches in Round 1. All scores are listed as 0-0 in red. For matches where players have not yet been assigned, diplay "Waiting..." in place of the player name.

##### Administrator tools

*These buttons are only shown if the user is the server administrator*

* "Start Tournament"
  - If all slots are filled, this button is colored green and enabled. Clicking it starts the competition immediately.
  - If some slots are open but enough players are in the lobby to fill them, this button is colored orange and enabled. Clicking it fills open slots with players from the lobby and starts the competition.
  - If some slots are open and not enough players are in the lobby to fill them, this button is colored blue and enabled. Clicking it fills open slots with players from the lobby and bots of random difficulty, and starts the competition.
  - If the start request succeeds, the admin client can switch directly into Observe mode without any extra manual step.

Below the button, add this INFORMATIONAL NOTE according to context and the state of the `auto_start` server option (`"always"`, `"admit_only"`, or `"never"`):

If auto_start is `"admit_only"` or `"never"`:
 * Green: Click to start
 * Orange: Adds players from lobby and starts
 * Blue: Adds players from lobby and bots, and starts

If auto_start is `"always"`:
 * Green: All slots filled — game starting...
 * Blue: Tournament starts
  automatically when filled. Click to add bots and start now.
 
#### During Rounds

Show the round table for the current round with scores updated live. For matches in progress, show scores in orange. For completed matches, show the winner's score in green and the loser's score in orange.

For active games, show an "Observe" button in blue to the right of the match row that allows the user to observe the game in progress. This button appears when a game is in progress, and is not shown for completed games.

#### Between Rounds

Title: 🏆 Round X results

Show round table for completed round, showing player names and final scores, with the winner's score in green.

#### When competition ends

*This screen appears during the reset delay after a competition ends, and then reverts to the Before Competition state*

Title: 🏆 Competition Winner: <playername>

Show the round table (1 row) for the final match, showing the winner's name and score in green, and the loser's name and score in orange.

Next competion begins in: [countdown timer]

### Lobby (middle, right) 

*This section of the UI shows the list of players (human and AI) waiting to join a competition.*

Title: 👥 Lobby

*Below the title, add a status message according to valut of auto_start:*

* always, admit_only: "New players automatically admitted to next competition"
* never, 0 players in lobby: "Waiting for players to join"
* never, 1+ players in lobby: "Click 'Admit' to add players to  competition"

#### Player View

Show a list of players waiting in the lobby by name.


#### Administrator View

Show a list of players waiting in the lobby by name.

Next to each player, include the following buttons:
* "Kick" (red) - removes the player from the lobby
* "Admit" (green) - moves the player from the lobby to the next open slot in the current round, if the round is not full. If the round is full, this button is disabled.

Below the list of players, include this button:

* "Add Bot [Level]" (blue) - adds a CopperBot opponent to the lobby. [Level] is a dropdown allowing the administrator to select the bot difficulty level (1-10) before adding the bot to the lobby. Valid values for the dropdown are:
  * Random 
  * Level 1 (least difficult)
  * Level 2
  ...
  * Level 10 (most difficult)
The defult selection is: Random.

### Server settings (bottom, centered)

Heading: ⚙️ Server (v <server version>): <websocket server URL>  ⧉ 

*The ⧉ symbol is a "copy to clipboard" button that copies the server URL to the user's clipboard.*

Below, list the settings defined in the server that control the game and competition. Exclude "Arenas".

If the server is not reachable, indicate this instead of displaying the settings.

Below, include this line in a subtle gray: To launch a new game server, see [CopperHead Server](https://github.com/revodavid/copperhead-server)

### Recent Winners and Leaderboard

Below the Server settings section, show two side-by-side panes (hidden if no tournaments have been completed on this server):

#### Left Pane: 🏆 Recent Winners

Show the prior 5 tournament winners by name, starting with the most recent. Do not include number of players or times.

#### Right Pane: 🏅 Leaderboard

Two columns: Name and Wins.

List the top 5 player names ranked by total number of tournament wins, starting with the most wins. Win counts are shown in green.

## Play Game screen

The header section of the Game Screen includes the game logo and name, and a status bar providing messages to the player about the current status of the game.

Below, the game screen is divided into three columns:

### Scoreboard (left, narrow)

Table (heading: Score) listing each player by name and their points in the current match.

Below, display the game status ("Match in progress" or declaring the winner), and the points required to win the match, and the current round number (e.g., Round 2 of 5).

### Gamefield grid (center, wide)

Show the gamefield here.

### Instructions panel (right, narrow)

Provide:
 - Goal 
   - Outlast your opponent by avoiding walls, yourself, and your opponent. Turn left and right to navigate. Collect food to grow your snake and other bonuses. 
   - List all food emojis with propensity greater than zero on a single line
 - Keybindings

## Play Game Screen -- transitions

When a human is playing on the Play Game screen, handle these transitions:

### Game End

The game ends when a player crashes. Wait until the user clicks the "Ready" button or presses space before beginning the next game in the match.

### Round End

At the end of the match, transition to Observer status for the current game. 

If the user lost the round, that player is out of the competition, but can continue to observe games.

If the user won the round, also transition to Observer status. The user is still in the game, and may return to Play status from the Entry Screen by clicking the "Play" button when the next round begins.

## Observer Screen

Header: Same as play screen.

Below, the observer screen is divided into three columns with the same layout and styling as the Game Screen:

### Scoreboard and Round Info (left, narrow)

This column replaces the Play Game scoreboard with a combined view showing:

1. **Score table**: Identical to Play Game screen, showing scores for observed game.

2. **Points to win**: "First to **N** wins" (where N is highlighted in orange).

3. **Round heading**: "Round X of Y" with a separator line below.

4. **Round table**: Same match table as the Entry Screen showing all matches in the current round with player names and current scores. The currently-observed match is highlighted. Scores for active matches are in orange; completed matches show the winner's score in green. The score column never wraps (always displays on one line, e.g. "2 - 1").

5. **Controls**:
   - ↑ ↓ Next / Previous Match (clickable)
   - Esc or \` Return to Entry Screen (clickable)

### Gamefield grid (center, wide)

Identical to Play Game screen, showing gamefield for the observed game. If the game has ended, show the final state and score.

### Right panel

For administrators: Show the Lobby panel (same as Entry Screen) with player list, Admit/Kick buttons, and Add Bot controls.

For non-administrators: Show the Instructions panel (same as Play Game screen) with observer keybindings.

### Observer Behavior: Follow States

The observer has two follow states:

**FOLLOWING_ENABLED** (default): Active whenever watching a live game.
- The center pane always shows an active game.
- When the observed match completes, the observer automatically switches to another active match in the round (if any remain).
- When a new round begins, the observer follows the winning player from the last-observed match to their new game.

**FOLLOWING_DISABLED**: Activated when the observer manually navigates (↑/↓) to a completed match.
- The status bar shows "Match complete: [winner] wins!".
- The observer stays on that completed game until one of the following occurs:
  - The observer navigates to an active game → returns to FOLLOWING_ENABLED
  - The next round begins → follows the winning player to their new game → returns to FOLLOWING_ENABLED
  - A new tournament begins → selects a random active game → returns to FOLLOWING_ENABLED

