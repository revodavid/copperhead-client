# Instructions for building Client UI

## Entry screen

Appears when first launching the client.

### Header (top, centered)

Application logo and name

Tagline: "Compete against human and AI players in a knockout Snake Game tournament!"

### Connect to a Server (top, centered)

Looking for a server? Launch one in GitHub CodeSpaces: [link to copperhead-server repo]

* Your Name: [Free text. Default: Human]
* Server URL: [Drop down. Default: Local]
  - Local: [Provides ws://localhost:8000/ws]
  - CodeSpaces: [user may enter name of their CodeSpace, e.g., bookish-fortnight-1234]
  - Custom: [Free text, user will provide full WebSocket URL]
* Server URL free text box: appears to the right of the drop down if "Custom" or "CodeSpaces" is selected

### Join the Competition (middle, left)

Button "Join" adds the user to Round 1 of the competition. This adds the user as a player in the first open match on the server if Round 1 is active and waiting for players.

There is a button below "Join" labeled "Play Bot". In the special case of a competion with just one arena, this button is enabled and adds the user and a random CopperBot opponent to the single match in Round 1 for immediate play.

Once all Competition slots are filled, the competition starts and the Play button is disabled and changes to "Competition in Progress" until the next competition begins.

### Competition Status (middle, center)

Title: 🏆 Competition Status

Subtitle is context dependent:
  - Competition not started: "Waiting for players to join... (X/Y)" with X = current players, Y = total slots
  - Round underway: "Round X in Progress" with X = current round number
  - Between rounds: "Round X Complete! Next round starting in Y seconds..." with X = completed round number, Y = countdown to next round
  - Competition complete: "Winner: <Playername>! New competition starting in Y seconds..." Y = countdown to new competition

Below show a table of matches:
 - Before competition start: Table of all matches in Round 1 (one row per match), showing player names or "Waiting..." for empty slots.
 - Current round underway: Table of matches in current round (one row per match), showing player names and live scores.
   - For completed rounds, show final scores with the winner's score in green
 - Between rounds: Table of matches in completed round (one row per match), showing final scores with the winner's score in green
 - Competition complete: Larger final-round scoreboard with winner score highlighted in green.

Below the table: AI button
 - Include a button at the bottom to add an AI player
 - Include a dropdown to the right of the button to select difficulty of added AI player (1-10, or "Random") or to add random bots until the server is full or ("Fill"). The default is "Random".
   - 1, 2, ... 10: Adds one Copperbot at selected difficulty level (e.g. Copperbot L5
   - Random: Adds one Copperbot at a random difficulty level (1-10)
   - Fill: Adds multiple random copperbots to fill all available slots. The button reads "Add Bots" instead of "Add Bots" when this option is selected.
 - The button has the following states:
    - Before competition start: "Add Bot" (active appearance)
      - After click: "Adding..." (disabled appearance)
      - After all bots are confirmed added: revert to appropriate "Add Bot" state
    - Competition underway: "Add Bot" (disabled appearance)
    - Between rounds: "Add Bot" (disabled appearance)
    - Competition complete: "Add Bot" (disabled appearance)
#### Observe Matches (middle, right)

Button launches the "Observe Game" screen.

This button is active when a competition is in progress, allowing the user to observe any match in the current round.

This button is disabled if no games are in progress.

### Server settings (bottom, centered)

Heading: ⚙️ Server (v <server version>): <websocket server URL> 

Below, list the settings defined in the server that control the game and competition. Exclude "Arenas".

If the server is not reachable, indicate this instead of displaying the settings.

## Play Game screen

The header section of the Game Screen includes the game logo and name, and a status bar providing messages to the user.

Below, the game screen is divided into three columns:

### Scoreboard (left, narrow)

Table (heading: Score) listing each player by name and their points in the current match.

Also display the current round number (e.g., Round 2 of 5) and the points required to win the match.

### Gamefield grid (center, wide)

Show the gamefield here.

### Instructions panel (right, narrow)

Provide:
 - Game goal
 - Keybindings
 - Legend for gamefield symbols (exclude player colors)

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

### Scoreboard (left, narrow)

Identical to Play Game screen, showing scores for observed game.

### Gamefield grid (center, wide)

Identical to Play Game screen, showing gamefield for the observed game. (The user can switch between games in the round. If the game has ended, show the final state and score.)

### Instructions panel (right, narrow)

Controls: Same styling as Play Game screen, but with keybindings for observer mode:
 - Up: Previous match
 - Down: Next match
 - ESC: Return to Lobby 

Current round matches: Include the same table from the Entry Screen in the current round of the competition, with player names and current scores.

Make this column wide enough to show the full match table without horizontal scrolling or wrapping.

## Active Gameplay

When a game is active, the status bar at the top of the screen displays a message like this:

"Round X Match in Progress: PlayerA vs PlayerB"

## Game End

The game ends when a player crashes. The client waits for the next game to begin. The status banner at the top of the screen displays a message like this:

"PlayerB Wins the Game! Next game starting soon..."

## Match End

The match ends when a player reaches the required points to win. The status banner at the top of the screen displays a message like this:

"Round X Match Complete: PlayerA Wins! Waiting for next round to begin..."

## Round End

When all matches in a round are complete, the status banner for all matches updates to declare the round winners, like this:

"Round X Complete: PlayerA Advances to Round Y! Next round starting soon..."

When the next round begins the view automatically switches to game in the next round that includes the winning player.

## Competition End

When the last match in the final round ends, the status banner updates to declare the overall competition winner. 

The game then returns to the Entry Screen after when the server resets for a new competition. The countdown to reset is displayed in the status bar.