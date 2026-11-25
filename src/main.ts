import './ui/styles.css';
import { SandboxApp } from './ui/app';

const root = document.getElementById('app');
if (!root) throw new Error('#app element missing');
const app = new SandboxApp(root);
app.start();
// Exposed for manual debugging in the browser console.
(window as unknown as { spinstrike: SandboxApp }).spinstrike = app;
