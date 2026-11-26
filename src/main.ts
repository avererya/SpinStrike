import './ui/styles.css';
import { SandboxApp } from './ui/app';
import { checkForNewerBuild } from './version';

const root = document.getElementById('app');
if (!root) throw new Error('#app element missing');
const app = new SandboxApp(root);
app.start();
// Exposed for manual debugging in the browser console.
(window as unknown as { spinstrike: SandboxApp }).spinstrike = app;

// Stale-deployment check: on load and whenever the tab becomes visible again.
// Shows a small notice; never reloads automatically (no reload loops, no
// interrupted battles).
const check = () =>
  void checkForNewerBuild((build, version) => app.showUpdateNotice(version, build));
check();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') check();
});
