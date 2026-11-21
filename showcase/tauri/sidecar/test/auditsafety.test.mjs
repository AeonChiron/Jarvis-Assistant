// Regression tests for the 2026-11-21 audit (docs/AUDIT_2026-11-21.md): safety rules. Run: npm test
import assert from 'node:assert/strict';
import * as safety from '../safety.mjs';
const { BLOCK, SAFE, checkOpen, checkRead, checkWrite, isYes } = safety;
const permissionMessageOk = safety.permissionMessageOk ?? (() => true);

const failures = [];
const want = (label, got, level) => { if (got.level !== level) failures.push(`${label} → ${got.level} (${got.reason}), wanted ${level}`); };

// F02: on Windows and macOS file names ignore case, so a protected path in other letters is the same file.
if (process.platform === 'win32' || process.platform === 'darwin') {
  const HOME = process.platform === 'win32' ? 'C:/Users/ken' : '/Users/ken';
  // One of each protected kind: secrets (read and write), other apps' private data (read), startup/settings (write).
  for (const p of ['~/.GG/AUTH.JSON', '~/.SSH/id_ed25519', '~/.Ssh/config', '~/.AWS/credentials', '~/project/.ENV', '~/ID_RSA', '~/certs/Server.PEM',
    '~/.Config/GH/hosts.yml', '~/.TAURI/key', '~/appdata/roaming/microsoft/credentials/x', '~/Library/KEYCHAINS/login.keychain-db']) {
    want(`read ${p}`, checkRead(p, HOME), BLOCK);
    want(`write ${p}`, checkWrite(p, HOME), BLOCK);
  }
  for (const p of ['~/LIBRARY/CONTAINERS/com.x/data', '~/appdata/local/PACKAGES/app/x']) want(`read ${p}`, checkRead(p, HOME), BLOCK);
  for (const p of ['~/.ZSHRC', '~/.Bashrc', '~/.GITCONFIG', '~/.gg/Settings.json', '~/Library/LAUNCHAGENTS/x.plist', '~/x.DESKTOP']) want(`write ${p}`, checkWrite(p, HOME), BLOCK);
  // Ordinary files in odd case stay allowed.
  want('read ~/Notes.TXT', checkRead('~/Notes.TXT', HOME), SAFE);
}

// F04: open runs documents only; any other file is shown in its folder (reveal), never launched.
{
  const H = '/Users/ken', WH = 'C:/Users/ken';
  for (const t of ['~/Downloads/x.lnk', '~/Downloads/x.hta', '~/Downloads/x.msi', '~/Downloads/x.vbs', '~/Downloads/x.scr', '~/Downloads/x.wsf',
    '~/Downloads/x.cpl', '~/Downloads/x.reg', '~/Downloads/x.url', '~/Downloads/x.com', '~/Downloads/x.pif', '~/Downloads/x.xlsm', '~/Downloads/x.docm', '~/Downloads/x.jse', '~/Downloads/x.EXE']) {
    const v = checkOpen(t, H);
    if (v.level !== BLOCK || !v.reveal) failures.push(`open ${t} → ${v.level}${v.reveal ? ' reveal' : ''}, wanted block + reveal`);
  }
  for (const t of ['C:\\Users\\ken\\Downloads\\x.lnk', 'C:\\Users\\ken\\Downloads\\x.hta']) { const v = checkOpen(t, WH); if (v.level !== BLOCK || !v.reveal) failures.push(`open ${t} → ${v.level}, wanted block + reveal`); }
  // A file with no extension is shown, not run; a folder (even with a dot) opens.
  const f = checkOpen('~/Downloads/payload', H, { file: true });
  if (f.level !== BLOCK || !f.reveal) failures.push(`open file without extension → ${f.level}, wanted block + reveal`);
  want('open folder my.project', checkOpen('~/code/my.project', H, { dir: true }), SAFE);
  for (const t of ['~/Documents/report.pdf', '~/a.docx', '~/a.XLSX', '~/a.pptx', '~/a.txt', '~/a.md', '~/a.csv', '~/a.png', '~/a.JPG', '~/a.mp3', '~/a.mp4', '~/Documents', 'https://x.com', 'Spotify']) {
    want(`open ${t}`, checkOpen(t, H), SAFE);
  }
}

// F16: only a whole yes is a yes; a condition or a "not" means no.
for (const y of ['Allow', 'y', 'yes', 'Yes please', 'yes, do it', 'OK', 'okay!', 'go ahead', 'Sure.', 'confirm', 'do it', 'run it', 'yep thanks', 'Install']) if (!isYes(y)) failures.push(`isYes("${y}") should be true`);
for (const n of ['okay, but do not delete anything', 'yes but not the photos', "Don't allow", 'ok wait', 'sure, if it is safe', 'yes no', 'go away', 'confirm nothing', 'okay just kidding', 'no', '', null]) if (isYes(n)) failures.push(`isYes("${n}") should be false`);

// F01: permission switches, keys and model servers only from the settings windows (or the shell itself, no `from`).
{
  const ok = [{ type: 'menu', id: 'actions', from: 'panel' }, { type: 'menu', id: 'skipallow', from: 'home' }, { type: 'menu', id: 'actions' },
    { type: 'set_actions', on: true, from: 'onboarding' }, { type: 'menu', id: 'stop', from: 'main', via: 'esc' }, { type: 'answer', from: 'main' },
    { type: 'panel_local_add', url: 'http://localhost:11434', from: 'panel' }];
  const bad = [{ type: 'menu', id: 'actions', from: 'main' }, { type: 'menu', id: 'skipallow', from: 'desktop-1' }, { type: 'set_actions', on: true, from: 'main' },
    { type: 'set_actions', on: 'yes', from: 'panel' }, { type: 'menu', id: ['actions'], from: 'panel' }, { type: 'set_keys', from: 'main' },
    { type: 'panel_local_add', url: 'http://evil', from: 'main' }, { type: 'menu', id: 'login', from: 'main' }, null];
  for (const m of ok) if (!permissionMessageOk(m)) failures.push(`message ${JSON.stringify(m)} should be accepted`);
  for (const m of bad) if (permissionMessageOk(m)) failures.push(`message ${JSON.stringify(m)} should be refused`);
}

assert.deepEqual(failures, [], failures.join('\n'));
console.log('audit safety ok');
