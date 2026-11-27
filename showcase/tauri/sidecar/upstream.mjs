// The real Roamies app (github.com/KenKaiii/Roamies), which Jarvis grew from: what's new there since Jarvis last
// took its changes in. Asked only when the panel's Roamies updates button is pressed, never in the background.
export const UPSTREAM = 'KenKaiii/Roamies';
// The last Roamies commit Jarvis has; the two-week check moves this when it brings changes in.
export const SYNCED = { sha: '31054266b77d7beb2c01a806166e2aa30b4a856e', date: '2026-11-21T02:46:52+08:00' };
export const UPSTREAM_PAGE = `https://github.com/${UPSTREAM}/commits/main`;

/** → { ok: true, count, latest } (count capped at 100), or { ok: false, error } in the user's words. */
export async function checkUpstream(fetchImpl = fetch, synced = SYNCED) {
  try {
    const r = await fetchImpl(`https://api.github.com/repos/${UPSTREAM}/commits?sha=main&per_page=100&since=${encodeURIComponent(synced.date)}`, {
      headers: { accept: 'application/vnd.github+json', 'user-agent': 'jarvis-assistant' }, signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return { ok: false, error: r.status === 403 ? 'GitHub is limiting checks right now. Try again in an hour.' : "Couldn't reach GitHub." };
    const list = (await r.json()).filter((c) => c?.sha && c.sha !== synced.sha);
    return { ok: true, count: list.length, latest: String(list[0]?.commit?.message ?? '').split('\n')[0].slice(0, 120) };
  } catch { return { ok: false, error: "Couldn't reach GitHub." }; }
}
