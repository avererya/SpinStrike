/**
 * Build information, injected at build time by vite.config.ts (`define`).
 * The version comes from package.json; the build id is the short commit SHA
 * (Cloudflare Pages: CF_PAGES_COMMIT_SHA, else `git rev-parse`), so nothing
 * needs to be updated by hand in several files.
 */
declare const __APP_VERSION__: string;
declare const __BUILD_ID__: string;
declare const __BUILD_TIME__: string;

export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0-dev';
export const BUILD_ID: string = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev';
export const BUILD_TIME: string = typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : '';
export const VERSION_LABEL = `v${APP_VERSION} · ${BUILD_ID}`;

/**
 * Checks /version.json (written at build time, served uncached) and calls
 * `onNewer` when a newer deployment is live. Never reloads by itself, so an
 * active battle is never interrupted; the UI shows a small notice instead.
 */
export async function checkForNewerBuild(onNewer: (build: string, version: string) => void): Promise<void> {
  if (BUILD_ID === 'dev') return;
  try {
    const res = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const j = (await res.json()) as { build?: string; version?: string };
    if (j.build && j.build !== BUILD_ID) onNewer(j.build, j.version ?? '');
  } catch {
    /* offline or not deployed with version.json: ignore */
  }
}
