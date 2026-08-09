# Godlike Foundry System (initial)

This repository contains an initial Foundry VTT System package to run the Godlike TTRPG using One-Roll Engine (ORE) dice mechanics.

What I pushed in branch `feat/godlike-system-init`:
- system.json (Foundry manifest)
- README.md (this file)
- MIT license
- templates/sheets/godlike-sheet.html (character sheet mockup)
- styles/godlike.css
- scripts/godlike.js (system registration + sheet class)
- scripts/item-sheet.js (weapon item sheet and UI)
- scripts/ore.js (ORE dice engine used by rolls)

Notes:
- This is an initial implementation and a working mockup of the sheet and rolling logic. It implements the features you requested: spray/slow/area/burn fields, magazines/ammo, a modifier prompt, hard & wiggle dice support, max-10-dice cap, height->location mapping, and damage = base + width.
- The code is intentionally modular and commented so it can be refined with code from the referenced repos (shemetz/one-roll-engine and iconmaster5326/FoundryWildTalents) — I used their concepts but wrote fresh, licensed code for this repo.

Next steps you can request:
- I can open a PR into `main` and ask for review.
- We can expand the sheet UI styling and add actor item lists, compendium support, or persistent magazine entities.

