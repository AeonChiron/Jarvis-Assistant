// Regression tests for the 2026-11-21 audit (docs/AUDIT_2026-11-21.md): the shell, pages and release workflow, read
// as files (the Rust shell is built and tested by the release workflow, not here). Run: npm test
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const tauri = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const repo = path.resolve(tauri, '..', '..');
const read = (...p) => fs.readFileSync(path.join(...p), 'utf8');
const main = read(tauri, 'src-tauri', 'src', 'main.rs');

// F01: no page text from a model reaches innerHTML on the home page; pages have no inline scripts; a CSP is set;
// the shell stamps the sending window on every page message.
{
  const home = read(repo, 'showcase', 'panel', 'home.js');
  assert.doesNotMatch(home, /\.innerHTML\s*=\s*`[^`]*\$\{/, 'home.js builds no innerHTML from values');
  for (const page of ['desktop.html', 'panel/index.html', 'onboarding/index.html']) {
    const html = read(repo, 'showcase', page);
    assert.doesNotMatch(html, /<script>(?!\s*<\/script>)/, `${page}: no inline <script> (the CSP allows none)`);
    assert.doesNotMatch(html, /\son[a-z]+\s*=\s*["']/i, `${page}: no inline on* handlers`);
  }
  const csp = JSON.parse(read(tauri, 'src-tauri', 'tauri.conf.json')).app.security.csp;
  assert.ok(csp && typeof csp === 'object', 'tauri.conf.json sets a CSP');
  assert.doesNotMatch(csp['script-src'], /unsafe-inline|'unsafe-eval'|https?:/, 'scripts only from the app itself');
  assert.match(main, /fn sidecar_send\(app: AppHandle, window: WebviewWindow, mut msg: Value\)[\s\S]{0,400}insert\("from"/, 'sidecar_send stamps the window label');
  console.log('F01 pages and shell: ok');
}

// F07: processes are never killed by image name (Animama.exe, roamies.exe are shared with apps the user opens).
{
  for (const f of fs.readdirSync(path.join(tauri, 'src-tauri', 'src')).filter((f) => f.endsWith('.rs'))) {
    assert.doesNotMatch(read(tauri, 'src-tauri', 'src', f), /"\/IM"/, `${f}: no taskkill /IM`);
  }
  assert.match(main, /taskkill"\)\.args\(\["\/PID", &pid\.to_string\(\), "\/T", "\/F"\]\)/, 'stop_animama kills its own child by PID');
  console.log('F07 kill by PID: ok');
}

// F08: Jarvis's own names for start-at-login and the key store (the official Roamies app is installed beside it).
{
  assert.doesNotMatch(main, /"\/v", "Roamies", "\/t"/, 'the Run value is not written as "Roamies"');
  assert.match(main, /const NAME: &str = "Jarvis Assistant";/);
  assert.doesNotMatch(read(tauri, 'src-tauri', 'src', 'linux.rs'), /"roamies\.desktop"/, 'own autostart file on Linux');
  assert.doesNotMatch(read(tauri, 'sidecar', 'secrets.mjs'), /'com\.kenkai\.roamies'/, 'own keyring service on Linux');
  assert.doesNotMatch(read(tauri, 'src-tauri', 'hands', 'main.swift'), /secretService = "com\.kenkai\.roamies"/, 'own keychain service on macOS');
  console.log('F08 own names: ok');
}

// F15: the release is published only after the checks job (syntax check, both bundles, tests) passes.
{
  const wf = read(repo, '.github', 'workflows', 'jarvis-release.yml');
  const checks = wf.slice(wf.indexOf('\n  checks:'), wf.indexOf('\n  release:'));
  assert.ok(checks.length > 20, 'a checks job before release');
  for (const step of [/node --check/, /\.\/bundle\.sh/, /npm test/]) assert.match(checks, step);
  assert.match(wf.slice(wf.indexOf('\n  release:')), /^\s+needs: checks$/m, 'release needs checks');
  console.log('F15 release gated on checks: ok');
}

console.log('audit shell ok');
