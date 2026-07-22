# AGENTS.md — Tromsø 2026 roadbook

This file is the **Cursor equivalent of `CLAUDE.md`**: persistent project instructions for coding agents in this repo. Cursor also loads always-on rules from [`.cursor/rules/`](.cursor/rules/) and discoverable skills from [`.cursor/skills/`](.cursor/skills/).

## Required skill

Before editing itineraries, chronology, maps, scenarios, optionals, coordinates, or deploy/Pages config, read and follow:

1. **[`.cursor/skills/tromso-roadbook/SKILL.md`](.cursor/skills/tromso-roadbook/SKILL.md)** — architecture, constraints, maps, contingencies, deploy
2. **[`.cursor/skills/tromso-roadbook/itinerary-schema.md`](.cursor/skills/tromso-roadbook/itinerary-schema.md)** — JSON field shapes

Quick orientation: JSON under `option-*/` and `shared/` is the trip; `app/` is presentation only. Run with `make start`. Live site deploys from `main` via GitHub Actions Pages.

## Keep this and the skill up to date

Whenever you change a lasting convention, workflow, or schema in this project, **update the docs in the same change** (do not wait to be asked):

| Change type | Update |
| --- | --- |
| App architecture, run/deploy, trip constraints, map/coord rules, contingency behaviour | `.cursor/skills/tromso-roadbook/SKILL.md` |
| Itinerary / notes / optional / scenario field shapes | `.cursor/skills/tromso-roadbook/itinerary-schema.md` |
| Top-level “how to work in this repo” pointers | `AGENTS.md` (this file) and `.cursor/rules/tromso-roadbook.mdc` if the always-on nudge drifts |

If a new chat would otherwise re-learn something the hard way, it belongs in the skill (or schema reference), not only in chat history.
