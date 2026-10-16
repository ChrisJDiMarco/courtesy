# Courtesy

Every victory changes hands. A local 3D strategy game for Mac, with a computer opponent and two-player play on one screen.

## Play

Open **Courtesy.app**. Select a dish, inspect the action and its counter transfer, then commit. The default match is against Violet; **New game → A friend** starts local two-player play.

- Drag the table to orbit; scroll to zoom; right-drag to pan.
- **Overhead** changes the view; **Reset view** or **R** restores it.
- **1**, **2**, **3** select pots; **Enter** commits.
- **Undo** reverses one move locally, or your move and the computer reply against Violet.
- Sound is optional. The system Reduce Motion preference is respected.
- The match is saved after each move and restored on reopening.

## Rules

24 counters total; 12 in each hand. Three empty pots. Scores start at zero. All information is public.

Take exactly one action per turn:

1. **Start:** Put exactly 1 counter into an empty pot and own it.
2. **Take:** To take an opponent’s pot of n counters, add exactly n + 1 from your hand. The pot becomes yours with 2n + 1 counters.
3. **Collect:** Empty a pot you own. Score its number of counters. Give all those counters to your opponent’s hand.

You cannot add to your own pot. Pass only if no action is legal. The first player to reach 25 points wins immediately. Scores are separate from physical counters: hands and pots always total 24.

Violet uses bounded look-ahead search, with Casual and Thoughtful settings. Neither setting is a claim of perfect play. The underlying game is an original prototype whose competitive balance has not been established by human playtesting.

## Develop

Requires Node and npm. This project uses Electron, Three.js and Vite, with no network calls or external assets during play.

    npm install
    npm start

    npm run check
    npm test
    npm run build
    node tools/smoke.mjs
    node tools/match.mjs

The smoke and match tools interact with the real app and intentionally replace its saved test match, ending at a fresh table. Do not run them over a match you want to keep.

## Build the Mac app

    npm run package
    codesign --force --deep --sign - release/Courtesy-darwin-arm64/Courtesy.app
    codesign --verify --deep --strict release/Courtesy-darwin-arm64/Courtesy.app

The package is for Apple silicon. Ad-hoc signing supports local use; this is not a notarized public-distribution release.

The renderer is served only from a random loopback port. Node integration is disabled, renderer isolation and sandboxing are enabled, and navigation, popup windows and permissions are restricted. Session files live in the app’s macOS Application Support directory as match.json. The renderer can only read/write this fixed session file through the preload API.

## Artwork and credits

The table, dishes, minted counters, textures, animations and app icon were created procedurally for Courtesy. System fonts are used; no models, stock textures, or remote fonts are downloaded at runtime. Three.js is MIT-licensed; see licenses/THREE.txt. Electron ships its applicable third-party notices inside the app bundle.
