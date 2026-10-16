# Courtesy — local Mac build receipt

Verified 2026-09-05 on this Apple-silicon Mac.

- Installed app: /Users/chrisdimarco/Applications/Courtesy.app
- Source: /Users/chrisdimarco/Projects/Courtesy
- Release: release/Courtesy-darwin-arm64/Courtesy.app
- Architecture: arm64, Electron 44.2.0, local ad-hoc code signature.
- Signature: codesign --verify --deep --strict passed on release and installed copies.
- Installed disk size reported by du: 291 MB.
- Artwork: original procedural table, porcelain dishes, brass counters, textures and icon. Three.js MIT notice is bundled.
- Runtime: offline; renderer assets and computer opponent are bundled. Local loopback HTTP only.

## Behavior checks

13 deterministic engine/bot tests passed. The suite includes 100 seeded legal games, conservation of all 24 counters, forced passes, immediate wins, illegal action rejection, immutable state, the full two-safe-sevens trap, and small-before-big collection.

Nine interactive smoke journeys passed in the Electron app: rules and keyboard shortcuts; complete financing-trap opening through takeover; local undo; overhead and reset; reload persistence; computer reply and full-turn undo; pausing the computer while reading rules; win/rematch; compact-window pot visibility. No renderer exceptions were reported.

A complete automated game played through the actual UI against Thoughtful Violet finished 15–25 in 28 plies. All positions remained valid, including a forced pass. The completed match restored exactly after reload. This checks implementation and does not establish human enjoyment, game balance, or optimal computer strength.

Two review findings were fixed and independently reverified: numeric-selection/Enter focus behavior and a persistent retry control after a worker failure. The focused JavaScript reviewer approved the corrected candidate.

## Packaged native proof

The installed app was launched from its .app bundle. Its real CoreGraphics window was captured and inspected. Direct clicking on a porcelain dish selected the corresponding pot and showed the correct Start action. A real pointer drag rotated the table, with visible before/after changes. The owner then began a live match in the installed app; verification stopped modifying the game and preserved that match.

Evidence:
- verification/native-initial.png
- verification/native-orbit.png
- verification/smoke.json
- verification/full-game.json
- verification/initial.png
- verification/trap.png
- verification/overhead.png
- verification/compact.png
- verification/winner.png

## Limits

Local two-player play, not network multiplayer. Ad-hoc signed for this Mac, not notarized for public distribution. Computer strength and the game's competitive balance are preliminary. macOS 13+ on Apple silicon is required by this build.
