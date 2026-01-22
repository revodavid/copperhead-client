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

### Join the Competion (middle, left)

Button "Play" adds the user to Round 1 of the competition. This adds the user as a player in the first open match on the server if Round 1 is active and waiting for players.

Once all Competition slots are filled, the competition starts and the Play button is disabled and changes to "Competition in Progress" until the next competition begins.

### Competition Status (middle, center)

Show:
 - Current round number (e.g., Round 2 of 5)
 - Table of matches in current round (one row per match), showing player names and live scores. Where matches are waiting for a player, show "Waiting..." as the missing player name(s).

Include a button at the bottom to add an AI player, which adds a CopperBot of random difficulty (1-10) to the competiton. This button is disabled if a competition is in progress.

#### Observe Matches (middle, right)

Button launches the "Observe Game" screen.

This button is active when a competition is in progress, allowing the user to observe any match in the current round.

This button is disabled if no games are in progress.

### Server settings (bottom, centered)

List the settings defined in the server that control the game and competition. Exclude "Arenas".

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