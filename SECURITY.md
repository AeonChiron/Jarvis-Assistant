# Security policy

Roamies reads your AI provider API keys and OAuth tokens from your machine (`~/.gg/auth.json`) and runs a
local agent that can take screenshots, read windows and read files, and, if you turn
them on, click and type in other apps, write files and run commands. Security reports are taken seriously.

## Supported versions

Only the latest release gets security fixes: [latest Jarvis Assistant release](https://github.com/AeonChiron/Jarvis-Assistant/releases/latest).

## Reporting a vulnerability

Please **do not open a public issue**. Report privately through [Jarvis Assistant's GitHub security advisories](https://github.com/AeonChiron/Jarvis-Assistant/security/advisories/new). If it also affects upstream Roamies, report it there too: [Roamies security advisories](https://github.com/KenKaiii/Roamies/security/advisories/new).

Include:

- what an attacker can do, and what they need first (e.g. "a malicious web page", "a file the user opens", "local access")
- steps to reproduce, or a proof of concept
- affected version and OS

You'll get an acknowledgement within 7 days. Once a fix ships, the advisory will be published with credit to you unless you'd rather stay anonymous.

## In scope

- the agent sidecar and its tools: file access, commands, screenshots, app control
- the safety switches for writing files and running commands
- the Tauri shell and its commands
- the macOS helpers (voice and hands)
- memory, settings and session files in `~/Roamies/Data/`

## Out of scope

- an AI model choosing to do something you asked for or that your settings allow
- attacks that need an already-compromised user account or machine

## Known advisories

- **glib 0.18.5 (Linux builds only):** the Linux GTK stack Tauri 2 depends on pins glib 0.18, which has a published
  advisory for its `VariantStrIter` iterator. Jarvis Assistant ships Windows builds only, and nothing here calls that
  API; it is not overridden by force because glib 0.18 is what the Tauri/gtk-rs release line supports. It will go away
  with Tauri's move to the newer gtk-rs stack. (Audit 2026-11-21, F13.)
