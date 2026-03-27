// ═══════════════════════════════════════════════════════
// CHAKRAVISION — CORE ENGINE
// ═══════════════════════════════════════════════════════

const video   = document.getElementById('inputVideo');
const canvas  = document.getElementById('outputCanvas');
const ctx     = canvas.getContext('2d');

const jutsuSfx = new Audio('../audio/kagebunshin-audio-efect.mp3');
jutsuSfx.preload = 'auto';

function playJutsuSfx() {
  jutsuSfx.currentTime = 0;
  jutsuSfx.play().catch(() => {});
}

function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ═══════════════════════════════════════════════════════
// GESTURE ENGINE
// ═══════════════════════════════════════════════════════

const BUFFER_SIZE = 25;
const CLONE_DELAY_MS = 2000;

const gestureBuffer = [];
let lastGesture = null;
let gestureTimeout = null;
let cloneSpawnTimer = null;

function pushFrame(hands) {
  const now = performance.now();
  gestureBuffer.push({ hands, timestamp: now });
  if (gestureBuffer.length > BUFFER_SIZE) gestureBuffer.shift();
}

function dist2D(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getWrist(lm) { return lm[0]; }

class KageBunshinSealAnalyzer {
  static fingerExtended(lm, tipId, mcpId) {
    const wrist = lm[0];
    return dist2D(lm[tipId], wrist) > dist2D(lm[mcpId], wrist) * 1.02;
  }
  static fingerCurled(lm, tipId, mcpId) {
    const wrist = lm[0];
    return dist2D(lm[tipId], wrist) < dist2D(lm[mcpId], wrist) * 1.22;
  }
  static twoFingerBarStrength(lm) {
    let s = 0;
    if (this.fingerExtended(lm, 8, 5)) s += 0.28;
    if (this.fingerExtended(lm, 12, 9)) s += 0.28;
    if (this.fingerCurled(lm, 16, 13)) s += 0.22;
    if (this.fingerCurled(lm, 20, 17)) s += 0.22;
    return s;
  }
  static barDirection(lm) {
    const mx = (lm[8].x + lm[12].x) * 0.5 - lm[0].x;
    const my = (lm[8].y + lm[12].y) * 0.5 - lm[0].y;
    const len = Math.hypot(mx, my) || 1e-6;
    return { x: mx / len, y: my / len };
  }
  static scoreCrossSeal(h1lm, h2lm) {
    const b1 = this.twoFingerBarStrength(h1lm);
    const b2 = this.twoFingerBarStrength(h2lm);
    if (b1 < 0.65 || b2 < 0.65) return 0;
    const w1 = getWrist(h1lm), w2 = getWrist(h2lm);
    const wristDist = dist2D(w1, w2);
    if (wristDist > 0.52) return 0;
    const d1 = this.barDirection(h1lm);
    const d2 = this.barDirection(h2lm);
    const dot = Math.abs(d1.x * d2.x + d1.y * d2.y);
    if (dot > 0.72) return 0;
    const perp = 1 - dot / 0.72;
    const near = 1 - Math.min(1, wristDist / 0.52);
    const barQual = (b1 + b2) * 0.5;
    return 0.35 + 0.3 * perp + 0.2 * near + 0.15 * barQual;
  }
}

function runGestureEngine() {
  if (gestureBuffer.length < 6) return null;
  const recent = gestureBuffer.slice(-10);
  let best = 0;
  for (const f of recent) {
    if (!f.hands || f.hands.length < 2) continue;
    const s = KageBunshinSealAnalyzer.scoreCrossSeal(
      f.hands[0].landmarks,
      f.hands[1].landmarks
    );
    if (s > best) best = s;
  }
  return best > 0.48 ? 'KAGEBUNSHIN' : null;
}

// ═══════════════════════════════════════════════════════
// EFFECT SYSTEM
// ═══════════════════════════════════════════════════════

const activeEffects = [];

let latestSegImage = null;
let latestSegmentationMask = null;
let personCutoutCanvas = null;
let personCutoutCtx = null;

function ensurePersonCutoutBuffer(w, h) {
  if (!personCutoutCanvas || personCutoutCanvas.width !== w || personCutoutCanvas.height !== h) {
    personCutoutCanvas = document.createElement('canvas');
    personCutoutCanvas.width = w;
    personCutoutCanvas.height = h;
    personCutoutCtx = personCutoutCanvas.getContext('2d');
  }
}

function updatePersonCutout() {
  const img = latestSegImage;
  const mask = latestSegmentationMask;
  if (!mask) return null;
  const iw = img ? img.width : mask.width;
  const ih = img ? img.height : mask.height;
  if (iw < 2 || ih < 2) return null;
  ensurePersonCutoutBuffer(iw, ih);
  const mw = mask.width;
  const mh = mask.height;
  const wctx = personCutoutCtx;
  const source = img || video;
  wctx.save();
  wctx.clearRect(0, 0, iw, ih);
  wctx.drawImage(source, 0, 0, iw, ih);
  wctx.globalCompositeOperation = 'destination-in';
  wctx.drawImage(mask, 0, 0, mw, mh, 0, 0, iw, ih);
  wctx.globalCompositeOperation = 'source-over';
  wctx.restore();
  return personCutoutCanvas;
}

class Particle {
  constructor(x, y, color, vx, vy, life = 1) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.color = color;
    this.life = life;
    this.maxLife = life;
    this.size = Math.random() * 4 + 2;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= 0.96;
    this.vy *= 0.96;
    this.life -= 0.02;
  }
  draw(ctx) {
    const a = this.life / this.maxLife;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * a, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }
  get alive() { return this.life > 0; }
}

class KageBunshinEffect {
  constructor(canvasW, canvasH) {
    this.life = 280;
    this.t = 0;
    this.particles = [];
    this.canvasW = canvasW;
    this.canvasH = canvasH;
    const W = canvasW;
    const H = canvasH;
    const hPeq = H * 0.36;
    const hMed = H * 0.66;
    this.clones = [
      { x: W * 0.11, targetH: hPeq },
      { x: W * 0.29, targetH: hMed },
      { x: W * 0.71, targetH: hMed },
      { x: W * 0.89, targetH: hPeq }
    ];
  }
  update() {
    this.t++;
    this.life--;
    // if (this.t % 3 === 0) {
    //   const cx = this.canvasW * 0.5 + (Math.random() - 0.5) * 120;
    //   const cy = this.canvasH * 0.35;
    //   this.particles.push(new Particle(
    //     cx, cy,
    //     Math.random() > 0.5 ? '#e8fff8' : '#7fffd4',
    //     (Math.random() - 0.5) * 2,
    //     -0.8 - Math.random() * 1.5,
    //     0.6 + Math.random() * 0.35
    //   ));
    // }
    this.particles = this.particles.filter(p => { p.update(); return p.alive; });
  }
  draw(ctx) {
    const alpha = Math.min(1, this.life / 35);
    const globalFade = Math.min(1, this.life / 40);
    const src = personCutoutCanvas && personCutoutCanvas.width > 2 ? personCutoutCanvas : null;
    this.particles.forEach(p => p.draw(ctx));
    if (!src) return;
    const iw = src.width;
    const ih = src.height;
    const ar = iw / ih;
    const footPad = Math.max(10, this.canvasH * 0.015);
    for (const c of this.clones) {
      const h = c.targetH * globalFade;
      const w = h * ar;
      const wobble = Math.sin(this.t * 0.06 + c.x) * 2;
      const cy = this.canvasH - footPad - h * 0.5;
      ctx.save();
      ctx.globalAlpha = 0.92 * alpha * globalFade;
      ctx.translate(c.x + wobble, cy);
      ctx.shadowColor = 'rgba(0,232,168,0.35)';
      ctx.shadowBlur = 18;
      ctx.drawImage(src, 0, 0, iw, ih, -w * 0.5, -h * 0.5, w, h);
      ctx.restore();
    }
  }
  get alive() { return this.life > 0; }
}

function spawnEffect() {
  const cw = canvas.width;
  const ch = canvas.height;
  const push = () => activeEffects.push(new KageBunshinEffect(cw, ch));
  if (video.videoWidth > 0 && video.videoHeight > 0) {
    push();
    return;
  }
  let tries = 0;
  const wait = () => {
    tries++;
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      push();
      return;
    }
    if (tries < 90) requestAnimationFrame(wait);
  };
  requestAnimationFrame(wait);
}

// ═══════════════════════════════════════════════════════
// RENDER LOOP
// ═══════════════════════════════════════════════════════

let currentHands = [];

function renderLoop() {
  requestAnimationFrame(renderLoop);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (currentHands.length > 0) {
    for (const hand of currentHands) {
      drawHandSkeleton(hand.landmarks);
    }
  }

  if (activeEffects.length > 0 && latestSegmentationMask) {
    updatePersonCutout();
  }

  for (let i = activeEffects.length - 1; i >= 0; i--) {
    activeEffects[i].update();
    activeEffects[i].draw(ctx);
    if (!activeEffects[i].alive) activeEffects.splice(i, 1);
  }

  while (activeEffects.length > 6) activeEffects.shift();
}

const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],
  [13,17],[0,17],[17,18],[18,19],[19,20]
];

function landmarkToCanvas(lm) {
  return { x: lm.x * canvas.width, y: lm.y * canvas.height };
}

function drawHandSkeleton(landmarks) {
  ctx.save();
  ctx.strokeStyle = 'rgba(0,200,255,0.5)';
  ctx.lineWidth = 1.5;
  ctx.shadowColor = 'rgba(0,200,255,0.8)';
  ctx.shadowBlur = 6;
  for (const [a,b] of HAND_CONNECTIONS) {
    const pa = landmarkToCanvas(landmarks[a]);
    const pb = landmarkToCanvas(landmarks[b]);
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }
  ctx.restore();
  for (const lm of landmarks) {
    const p = landmarkToCanvas(lm);
    ctx.save();
    ctx.fillStyle = '#00c8ff';
    ctx.shadowColor = '#00c8ff';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.5, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════
// MEDIAPIPE SETUP
// ═══════════════════════════════════════════════════════

function setupMediaPipe() {
  const hands = new Hands({
    locateFile: file =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });

  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.5
  });

  const selfieSegmentation = new SelfieSegmentation({
    locateFile: file =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
  });
  selfieSegmentation.setOptions({ modelSelection: 0, selfieMode: true });
  selfieSegmentation.onResults(results => {
    latestSegImage = results.image || null;
    latestSegmentationMask = results.segmentationMask;
  });

  hands.onResults(results => {
    const detectedHands = results.multiHandLandmarks
      ? results.multiHandLandmarks.map(lm => ({ landmarks: lm }))
      : [];

    currentHands = detectedHands;
    pushFrame(detectedHands);

    const gesture = runGestureEngine();
    if (gesture && gesture !== lastGesture) {
      triggerGesture();
    }
  });

  const camera = new Camera(video, {
    onFrame: async () => {
      await hands.send({ image: video });
      await selfieSegmentation.send({ image: video });
    },
    width: 1280,
    height: 720
  });

  camera.start().catch(err => {
    console.error('Camera error:', err);
  });
}

function triggerGesture() {
  lastGesture = 'KAGEBUNSHIN';
  clearTimeout(gestureTimeout);
  clearTimeout(cloneSpawnTimer);

  playJutsuSfx();
  cloneSpawnTimer = setTimeout(() => {
    cloneSpawnTimer = null;
    spawnEffect();
  }, CLONE_DELAY_MS);

  const display = document.getElementById('gesture-display');
  const nameEl  = document.getElementById('gesture-name');

  if (nameEl) {
    nameEl.className = 'KAGEBUNSHIN';
    nameEl.textContent = 'kagebunshin no jutsu';
  }
  display?.classList.add('visible');

  flashScreen();

  gestureTimeout = setTimeout(() => {
    display?.classList.remove('visible');
    lastGesture = null;
  }, 2200);
}

const KAGEBUNSHIN_FLASH = 'rgba(0,232,168,0.14)';

function flashScreen() {
  const flash = document.getElementById('combo-flash');
  if (!flash) return;
  flash.style.background = KAGEBUNSHIN_FLASH;
  flash.style.opacity = '1';
  setTimeout(() => { flash.style.opacity = '0'; }, 150);
}

setupMediaPipe();
renderLoop();
