# Jarvis Assistant: instructions for Claude

This repo is **Jarvis Assistant**, the user's own app, forked from Roamies (KenKaiii/Roamies, AGPL-3.0). It is pushed
to `AeonChiron/Jarvis-Assistant` (`main`); local branch `agora`. The official Roamies stays installed and untouched beside it.
The user's goal: bring many open-source repos into this one app.

## Rules that stop the loops (learned 2026-11-21)
1. **Right target, every time.** Before changing anything, name the target: this repo (`C:\Users\esteb\Roamies`),
   app id `com.aeonchiron.jarvisassistant`, data `~\JarvisAssistant`, install `%LOCALAPPDATA%\Jarvis Assistant`.
   Never the Python Jarvis (`C:\Users\esteb\Documents\Jarvis\jarvis`, paused) or the official Roamies install.
2. **Done = on the user's screen.** "Pushed", "built" and "tests pass" are steps, not done. After each release:
   download the installer from the release, install it (`/S`), launch the installed app under a watchdog, take a
   screenshot of the running window, and only then report it done.
3. **Integrate repos through their own interfaces.** Use a repo's own entry points, schemas, prompts and formats
   unchanged (for drawing: Roamies' draw.mjs schema and tool text). Prefer plugging repos in as MCP servers via the
   Connections page, or launching their signed apps, over merging their code. Read how a repo is meant to be
   embedded before writing glue, and check its licence (AGPL here: credit it on the Credits page).
4. **This PC's walls (check before planning):** Smart App Control is ON and permanent: local Rust/C++ builds are
   blocked (build scripts fail with os error 4551), so every build runs on GitHub Actions (`jarvis-release.yml`,
   ~25 min; it publishes the release and the updater feed). Signed Node and Python run fine. Unsigned installers may
   be blocked one day and allowed the next. Norton is installed; first launches of new builds run under a watchdog.
   Never kill processes by a shared name (`roamies.exe` is also the official Roamies).
5. **Edit with the file tools or a saved script file**, never inline Python/sed with Windows paths in the shell.
6. **UI first in the browser:** `panel/index.html?home` and the other pages run in a plain browser with sample data
   (launch config `jarvis-assistant-ui`, port 8766). Check there before spending a 25-minute build.
7. **Before every push** (in `showcase/tauri/sidecar`): `npm test`, then `for f in *.mjs; do node --check "$f"; done`,
   then bundle the brain exactly as the build does: `npx --no-install esbuild sidekick.mjs --bundle --platform=node
   --format=esm --target=node22 --outfile=$TEMP/sk.mjs` (tests don't load every file: a quote typo in sidekick.mjs
   passed npm test and broke two 25-minute builds). voicemodel's resume test is timing-sensitive: rerun it alone
   before believing a failure. The release workflow also runs the voice helper's `cargo test`.

## Where things are
- Shell (Rust): `showcase/tauri/src-tauri/src/main.rs` (home window `show_home`, `home_full` + animama).
- Brain (Node sidecar): `showcase/tauri/sidecar/` (`sidekick.mjs`, `about.mjs` describes the app to the AI).
- Pages: `showcase/panel/` (`home.js`/`home.css` = HUD home; `panel.js` CREDITS list), `showcase/roamies/` (overlay).
- Updates: `plugins.updater` in `tauri.conf.json` points at this repo's releases, signed with the key in
  `~\.tauri\jarvis-assistant-updater.key` (GitHub secrets hold it). Versions are `0.2.<run number>`.
- Plans: `C:\Users\esteb\Documents\Jarvis\ROAMIES_ROADMAP.md` and `JARVIS_WISHLIST.md`.
