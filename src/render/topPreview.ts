import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { TopDefinition } from '../content/tops';
import { buildTopModel, type TopModel } from './topModels';

/**
 * Rotating 3D top previews for menus (Garage, starter selection, Collection).
 *
 * ONE offscreen WebGL renderer serves every preview: each frame the visible
 * previews are rendered in turn and copied into their own 2D canvas. That
 * keeps a single GL context (important on iOS) however many tops are shown,
 * and previews that are detached from the page are skipped and freed.
 * Reuses the procedural battle models, so menus and battles always agree.
 */
interface Preview {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  def: TopDefinition;
  model: TopModel;
  angle: number;
  speed: number;
  dim: boolean;
}

export class PreviewHub {
  private renderer: THREE.WebGLRenderer | null = null;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
  private readonly previews = new Set<Preview>();
  private raf = 0;
  private last = 0;
  private failed = false;
  private readonly lookAt = new THREE.Vector3(0, 0.18, 0);

  private ensure(): THREE.WebGLRenderer | null {
    if (this.renderer || this.failed) return this.renderer;
    try {
      const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.toneMappingExposure = 1.05;
      r.outputColorSpace = THREE.SRGBColorSpace;
      r.setClearColor(0x000000, 0);
      const pmrem = new THREE.PMREMGenerator(r);
      this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
      this.scene.environmentIntensity = 0.9;
      this.scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x20242b, 0.9));
      const key = new THREE.DirectionalLight(0xffffff, 2.4);
      key.position.set(-2, 5, 3);
      this.scene.add(key);
      const rim = new THREE.DirectionalLight(0xff9a50, 0.8);
      rim.position.set(3, 2, -3);
      this.scene.add(rim);
      this.renderer = r;
    } catch {
      this.failed = true;
    }
    return this.renderer;
  }

  /** Creates a canvas showing a rotating preview of `def`. The canvas must be attached to the DOM by the caller. */
  create(def: TopDefinition, opts: { speed?: number; dim?: boolean } = {}): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.className = 'top-preview';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `${def.name} 3D preview`);
    const ctx = canvas.getContext('2d')!;
    const model = buildTopModel(def);
    model.tilt.rotation.z = 0.18; // slight lean so the profile reads
    this.previews.add({ canvas, ctx, def, model, angle: Math.random() * 6, speed: opts.speed ?? 0.9, dim: opts.dim ?? false });
    this.start();
    return canvas;
  }

  private start(): void {
    if (this.raf || !this.ensure()) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (now: number): void => {
    this.raf = 0;
    const r = this.renderer;
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    for (const p of [...this.previews]) {
      if (!p.canvas.isConnected) {
        this.previews.delete(p);
        p.model.dispose();
        continue;
      }
      const rect = p.canvas.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4 || !r) continue;
      if (rect.bottom < 0 || rect.top > innerHeight) continue; // off screen
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.round(rect.width * dpr);
      const h = Math.round(rect.height * dpr);
      if (p.canvas.width !== w || p.canvas.height !== h) {
        p.canvas.width = w;
        p.canvas.height = h;
      }
      p.angle += dt * p.speed;
      p.model.spin.rotation.y = p.angle;
      p.model.root.position.set(0, 0, 0);
      this.scene.add(p.model.root);
      r.setSize(w, h, false);
      this.camera.aspect = w / h;
      // Frame the model: distance from its size and the field of view.
      const dist = 0.62 / Math.tan((this.camera.fov * Math.PI) / 360) / Math.min(1, this.camera.aspect) / 2.55;
      this.camera.position.set(0, this.lookAt.y + dist * 0.42, dist);
      this.camera.lookAt(this.lookAt);
      this.camera.updateProjectionMatrix();
      r.render(this.scene, this.camera);
      this.scene.remove(p.model.root);
      p.ctx.clearRect(0, 0, w, h);
      if (p.dim) p.ctx.globalAlpha = 0.4;
      p.ctx.drawImage(r.domElement, 0, 0);
      p.ctx.globalAlpha = 1;
    }
    if (this.previews.size > 0) this.raf = requestAnimationFrame(this.frame);
  };
}
