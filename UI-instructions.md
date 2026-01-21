# Instructions for building Client UI

## Entry screen

Appears when first launching the client.

Top, centred: Application logo and name

These options must be provided regardless of the next step:

* Your Name: [Free text. Default: Human]
* Server URL: [Drop down.Default: CodeSpaces (bookish-fortnight)]
  - CodeSpaces (bookish-fortnight): [Provides the game server hosted on GitHub CodeSpaces.]
  - Local: [Provides ws://localhost:8000/ws]
  - Custom: [Free text]

There are three options to proceed. Arrange them from left to right:

### Observe a Game

Button launches the "Observe Game" screen.

### Single-Player Game

Button launches the "Play Game" screen vs a spawned AI opponent.

Provide a drop-down to select the spawned AI difficulty level (1-10).

### 2-Player Game

## Play Game screen

Center: Gamefield grid -- size determined by server.
Left: Scoreboard -- games one for each of the two players, listed by name
Right: Game instructions -- goal, keybindings and legend

## Observer Screen

Identical to Play Game screen, but replacing the right pane with keybindings observer, and a table of active rooms with player names and scores.

