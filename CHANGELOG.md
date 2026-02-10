# CopperHead Client Changelog

All notable changes to the CopperHead Client are documented in this file.

## [3.5.2] - 2026-02-10

_No client changes in this release._

## [3.5.1] - 2026-02-10

### Changed
- Improved round transition messages for human players (issue #12):
  - Match win: "Round {n} complete: You win!"
  - Waiting: "Waiting for next round to begin..."
  - Next round: "Round begins. Click Start Round to begin." with Start Round button
  - Bye: "You have a bye this round. Waiting for next round to begin."
  - Match loss: "{opponent} wins the round!" with Return to Lobby button

### Fixed
- Winner no longer auto-transitions to observer mode or gets kicked to lobby after winning a match
- Loser no longer auto-redirected to entry screen; sees Return to Lobby button instead

## [3.5.0] - 2026-02-05

### Added
- Championship history section on entry page showing past winners
- Observer handles bye scenarios gracefully (switches to another active match)

### Changed
- Default server port changed from 8000 to 8765
- Keyboard instruction text: "Back to menu" → "Return to lobby"

### Fixed
- Rapid keypress handling: tracks last sent direction locally to avoid false reverse-direction errors

## [3.4.1] - 2026-02-04

### Added
- CHANGELOG.md file documenting version history

### Changed
- Ready button text now contextual: "Start Match", "Next Game", "Return to Lobby"
- "Return to Lobby" button returns player to entry screen after match completion

## [3.4.0] - 2026-02-04

### Added
- Consistent status message colors based on game state
- Game status display in scoreboard panel

### Fixed
- Observer room flicker when switching matches

## [3.3.2] - 2026-02-03

### Fixed
- Food items display in Play screen instructions

## [3.3.1] - 2026-02-02

### Changed
- Updated Play screen instructions panel per UI spec
- Server heading format: "Server (vX.X.X): URL"

## [3.3.0] - 2026-02-01

### Added
- Server URL parameter support (`?server=` in URL)
- Documentation for server URL parameter in README

### Changed
- Simplified server URL to single text box input

## [3.2.1] - 2026-01-31

### Changed
- Minor UI improvements

## [3.2.0] - 2026-01-30

### Added
- Join and Play Bot buttons for easier game entry
- Eyes emoji on snake heads that rotate with direction

### Fixed
- Eat sound timing now matches actual food consumption
- Add Bot button await handling

## [3.1.0] - 2026-01-29

### Added
- Tick-based fruit flashing when food is about to expire
- Fruit emoji rendering for different fruit types

## [3.0.1] - 2026-01-28

### Added
- Add Bots button with "Fill" option to populate all slots
- Backtick (`) key as alternative to ESC for returning to entry screen
- Reverse direction sound alert when player tries invalid move

### Changed
- Dimmed disabled buttons for better visual feedback

## [3.0.0] - 2026-01-27

### Changed
- **BREAKING**: Updated to match server v3.0.0 message format

## [2.2.0] - 2026-01-26

### Added
- WebSocket URL display with copy button in game screen

## [2.1.0] - 2026-01-25

### Added
- Codespace name input that auto-converts to WebSocket URL

### Changed
- Various UI improvements

## [2.0.0] - 2026-01-24

### Added
- Observer mode with room navigation (Up/Down keys)
- Multi-room support showing all active matches
- Competition status display on entry screen
- Player name input field
- Sound effects (Pac-Man style):
  - Eating food (waka-waka)
  - Opponent eating (ominous tone)
  - Game start jingle
  - Win/lose/death sounds
  - Move confirmation blip
  - Invalid move buzzer

### Changed
- **BREAKING**: Updated to match server v2.0.0 competition mode
- Display "Games Won" instead of in-game score
- Use player names instead of "Player 1/2"
- Scores displayed as table format

### Fixed
- Observer display shows actual player names with consistent colors
- Retry as Player 2 on connection rejection
- Show "Waiting..." instead of "Player 1/2" when opponent unknown

## [1.0.0] - 2026-01-20

### Added
- Initial release
- Basic 2-player Snake game client
- Arrow keys and WASD controls
- Real-time WebSocket connection
- Simple score display
