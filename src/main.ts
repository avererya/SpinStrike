import './ui/styles.css';
import { GameShell } from './ui/game/shell';
import { checkForNewerBuild } from './version';

const root = document.getElementById('app');
if (!root) throw new Error('#app element missing');
const game = new GameShell(root);
game.start();

// Stale-deployment check: on load and whenever the tab becomes visible again.
// Shows a small notice; never reloads automatically (no reload loops, no
// interrupted battles).
const check = () =>
  void checkForNewerBuild((build, version) => game.showUpdateNotice(version, build));
check();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') check();
});
