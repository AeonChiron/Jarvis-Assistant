# Animama companions inside Jarvis Assistant

Goal: animama's characters (Andrew and Annie) live **inside** Jarvis Assistant with all their animation, emotions,
gestures, reactions and effects, driven by Jarvis's own brain. Nothing else from animama (its app, chat, settings,
backend) comes along. Source: github.com/raymond-van/animama (AGPL-3.0), cloned (no LFS) at `C:\Users\esteb\animama-src`.

## What animama's character system is (checked 2026-11-21)
- `src/frontend/web/src/lib/avatar/Avatar.ts` (3,610 lines): plain three.js + `@pixiv/three-vrm`. `load()` a VRM,
  `update(delta)` every frame, `playClip`/`loadAndPlayClip`, `setEmotionalState`, `setExpression`.
- Around it: `lib/lipsync` (48 files), `lib/scene-vfx` (25), `lib/emotion`, `lib/effects`, `three.quarks` particles,
  `@mochiya/three-liltoon` materials. React only in the scene host (`ui/main/canvas/*`, react-three-fiber) and a few
  editor files: the host is rewritten as a small plain three.js stage.
- Content (`content/included/`, Git LFS): avatars Andrew.vrm and Annie.vrm, 304 gestures, 336 reactions, 632 effect
  files, poses, appearances.
- Catalogs use Vite's `import.meta.glob`, so the companion is built with Vite, in the cloud (local builds are
  blocked here).
- Who picks a gesture or reaction: animama's Python backend has the AI choose from the catalog. In Jarvis the brain
  does the same through a tool listing the catalog's names.
- Licences: code AGPL-3.0; Andrew and Annie allow redistribution and modification, personal use and personal profit
  (pixiv VRoid presets edited by Raymond Van). Credit both on the Credits page.

## How it fits the app (so nobody gets lost in it)
Same shape as the rest of Jarvis Assistant: each piece in its own place, talking through one small, named interface.
- `showcase/companion/vendor/animama/`: animama's files **copied unchanged**, with `SOURCE.md` naming the commit
  they came from. Never edited, so a newer animama can be copied over them.
- `showcase/companion/stage.ts`: the only new rendering code: a plain three.js stage (renderer, camera, lights)
  around animama's `Avatar`. It exposes one small API: `mount(canvas)`, `load('andrew'|'annie')`,
  `emotion(name)`, `reaction(name)`, `gesture(name)`, `speaking(level)`, `dispose()`.
- `showcase/panel/home.js`: the HUD only calls that API (shows the companion in full screen, the globe otherwise).
- `showcase/tauri/sidecar/companion.mjs`: the brain side: the catalog of gesture and reaction names, the `companion`
  tool and the feeling → emotion map, with `test/companion.test.mjs` beside it, like `draw.mjs`.
- One message type between brain and screen (`{ kind: 'companion', ... }`), the way drawings already travel.
- `build.sh` builds the companion with Vite before the app; the release workflow does the rest.

## Taken from animama (only what's essential)
The character engine (Andrew, Annie), emotions, reactions, gestures, effects, lip sync, idle life and camera
framing. Left out: its chat, memory, settings, backend, voice input and picture-in-picture. Maybe later: Pocket TTS
(a free on-PC voice that can clone a voice).

## Steps (each ends with the companion on screen in the installed app, screenshotted)
0. **Probe:** `showcase/companion/` = the vendored engine + Andrew + a few gestures + a plain three.js stage, built
   with Vite in GitHub Actions. Download the built page and render Andrew idling and waving in the browser pane.
   Proves the engine runs outside animama before anything else is built on it.
1. **On stage:** the companion lives in the Jarvis Assistant window itself (any size; the Full screen button stays
   but isn't needed), in place of the globe (Andrew or Annie, picked in Settings). Idle life (blinking, breathing,
   looking around, small idle moves), lip sync from Jarvis's voice, camera framing presets. A clear **Minimize to
   buddy** button hides the window and shows the little desktop buddy; **double-clicking the buddy** brings the
   window back; closing the window still quits. The separate-app launch of animama goes away.
2. **Emotions and reactions:** each spoken sentence's feeling (Roamies' speech cues) sets animama's emotion and
   plays a matching reaction.
3. **Gestures:** a `companion` tool for the brain with the gesture catalog's names, so Jarvis gestures as he talks.
4. **Effects:** reaction and gesture effects (particles, stickers, scene effects).
