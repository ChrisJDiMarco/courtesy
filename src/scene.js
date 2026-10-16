import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const GOLD = 0xedcb8c;
const LILAC = 0xbba4dc;
const POT_POINTS = [new THREE.Vector3(-3.35, 0, -.3), new THREE.Vector3(0, 0, .66), new THREE.Vector3(3.35, 0, -.3)];
const clamp = THREE.MathUtils.clamp;

function surfaceTexture(kind) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const pixels = ctx.createImageData(512, 512);
  let seed = 98371;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < pixels.data.length; i += 4) {
    const n = random() * 24;
    const value = kind === 'felt' ? 112 + n : 150 + n;
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value;
    pixels.data[i + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  if (kind === 'felt') {
    ctx.globalAlpha = .18;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = .5;
    for (let x = -512; x < 1024; x += 4) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 512, 512); ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(kind === 'felt' ? 7 : 2, kind === 'felt' ? 7 : 2);
  return texture;
}

function coinTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#8b8b8b'; ctx.fillRect(0, 0, 512, 512);
  ctx.translate(256, 256);
  ctx.strokeStyle = '#d0d0d0'; ctx.fillStyle = '#c0c0c0'; ctx.lineWidth = 7;
  for (const r of [211, 194]) { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke(); }
  for (let i = 0; i < 8; i++) {
    ctx.save(); ctx.rotate(i * Math.PI / 4);
    ctx.beginPath(); ctx.moveTo(0, -136); ctx.quadraticCurveTo(49, -54, 0, -24); ctx.quadraticCurveTo(-49, -54, 0, -136); ctx.fill();
    ctx.restore();
  }
  ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 32; i++) {
    const a = i * Math.PI / 16;
    ctx.beginPath(); ctx.arc(Math.cos(a) * 174, Math.sin(a) * 174, 2.6, 0, Math.PI * 2); ctx.fill();
  }
  return new THREE.CanvasTexture(canvas);
}

function ovalRing(radiusX, radiusZ, tube, material, y, segments = 128) {
  const path = new THREE.CatmullRomCurve3(Array.from({ length: segments }, (_, i) => {
    const a = i / segments * Math.PI * 2;
    return new THREE.Vector3(Math.cos(a) * radiusX, y, Math.sin(a) * radiusZ);
  }), true);
  return new THREE.Mesh(new THREE.TubeGeometry(path, segments, tube, 6, true), material);
}

function roundedRect(width, depth, radius) {
  const shape = new THREE.Shape();
  const x = -width / 2, y = -depth / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y); shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + depth - radius); shape.quadraticCurveTo(x + width, y + depth, x + width - radius, y + depth);
  shape.lineTo(x + radius, y + depth); shape.quadraticCurveTo(x, y + depth, x, y + depth - radius);
  shape.lineTo(x, y + radius); shape.quadraticCurveTo(x, y, x + radius, y);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: .06, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: .05, bevelThickness: .035, curveSegments: 12 });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

export function createScene({ canvas, onPotSelect, onProject, onReady } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .98;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x100c16);
  scene.fog = new THREE.FogExp2(0x100c16, .022);
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 100);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, .04);
  scene.environment = environment.texture;
  scene.environmentIntensity = .38;
  room.dispose(); pmrem.dispose();

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = .065;
  controls.minDistance = 12;
  controls.maxDistance = 26;
  controls.minPolarAngle = .14;
  controls.maxPolarAngle = Math.PI / 2.65;
  controls.maxAzimuthAngle = Math.PI / 2.9;
  controls.minAzimuthAngle = -Math.PI / 2.9;
  controls.enablePan = true;
  controls.panSpeed = .45;
  controls.rotateSpeed = .44;
  controls.zoomSpeed = .65;
  controls.target.set(0, 0, .1);

  const feltTexture = surfaceTexture('felt');
  const metalTexture = surfaceTexture('metal');
  const embossTexture = coinTexture();
  const materials = {
    lacquer: new THREE.MeshPhysicalMaterial({ color: 0x2c1228, metalness: .16, roughness: .24, clearcoat: 1, clearcoatRoughness: .23 }),
    underside: new THREE.MeshStandardMaterial({ color: 0x1b1420, roughness: .48, metalness: .2 }),
    felt: new THREE.MeshStandardMaterial({ color: 0x362034, roughness: .98, bumpMap: feltTexture, bumpScale: .022 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc3a367, metalness: .82, roughness: .28 }),
    fineBrass: new THREE.MeshStandardMaterial({ color: 0x9d8155, metalness: .65, roughness: .46 }),
    porcelain: new THREE.MeshPhysicalMaterial({ color: 0xe2d8c7, metalness: .02, roughness: .27, clearcoat: .75, clearcoatRoughness: .2 }),
    rosette: new THREE.MeshStandardMaterial({ color: 0xcac0aa, roughness: .7, metalness: .16 }),
    coin: new THREE.MeshStandardMaterial({ color: 0xb08a40, metalness: .9, roughness: .24, roughnessMap: metalTexture }),
    coinFace: new THREE.MeshStandardMaterial({ color: 0xcba552, metalness: .87, roughness: .29, bumpMap: embossTexture, bumpScale: .037 }),
    coinRim: new THREE.MeshStandardMaterial({ color: 0xd8b46a, metalness: .9, roughness: .23 }),
    bank: new THREE.MeshPhysicalMaterial({ color: 0x1b101e, roughness: .32, metalness: .2, clearcoat: .55 }),
  };
  const makeMesh = (geometry, material, parent = scene) => { const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh; };

  // The set is built as actual objects: lacquer, a fitted felt insert, porcelain and minted brass.
  const board = new THREE.Group(); scene.add(board);
  const lower = makeMesh(new THREE.CylinderGeometry(1, 1, .28, 128), materials.underside, board);
  lower.scale.set(6.64, 1, 3.96); lower.position.y = -.3;
  const slab = makeMesh(new THREE.CylinderGeometry(1, 1, .23, 128), materials.lacquer, board);
  slab.scale.set(6.8, 1, 4.08); slab.position.y = -.11;
  board.add(ovalRing(6.71, 3.99, .025, materials.brass, .021));
  board.add(ovalRing(6.73, 4.0, .018, materials.fineBrass, -.19));
  const felt = makeMesh(new THREE.CylinderGeometry(1, 1, .024, 128), materials.felt, board);
  felt.scale.set(6.46, 1, 3.75); felt.position.y = .026;
  board.add(ovalRing(6.27, 3.57, .007, materials.fineBrass, .044));

  // Fine interrupted stitching follows the edge of the inlaid playing surface.
  const stitchPositions = [];
  for (let i = 0; i < 176; i++) {
    const a = i / 176 * Math.PI * 2, b = a + .013;
    stitchPositions.push(Math.cos(a) * 6.2, .046, Math.sin(a) * 3.5, Math.cos(b) * 6.2, .046, Math.sin(b) * 3.5);
  }
  const stitchGeo = new THREE.BufferGeometry(); stitchGeo.setAttribute('position', new THREE.Float32BufferAttribute(stitchPositions, 3));
  board.add(new THREE.LineSegments(stitchGeo, new THREE.LineBasicMaterial({ color: 0x8c6d80, transparent: true, opacity: .5 })));

  const ground = makeMesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x09060d, roughness: .95 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -.58; ground.castShadow = false;

  const key = new THREE.DirectionalLight(0xffe7c5, 3.1);
  key.position.set(-5, 10, 5); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -10, right: 10, top: 8, bottom: -8, near: .5, far: 32 });
  key.shadow.bias = -.00025; key.shadow.normalBias = .018; key.shadow.radius = 3;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xb7b4f3, .8); rim.position.set(6, 6, -5); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xf4ded0, .13); fill.position.set(0, 5, 9); scene.add(fill);
  scene.add(new THREE.HemisphereLight(0xdfd1e3, 0x20121e, .22));
  RectAreaLightUniformsLib.init();
  const softbox = new THREE.RectAreaLight(0xffeddb, 1.2, 8, 4); softbox.position.set(-3, 7, -1); softbox.lookAt(0, 0, 0); scene.add(softbox);

  const dishProfile = [[0,.065],[.85,.065],[1.13,.08],[1.28,.16],[1.34,.26],[1.33,.32],[1.30,.345],[1.265,.32],[1.22,.255],[1.1,.18],[.9,.154],[0,.154]].map(([x,y]) => new THREE.Vector2(x,y));
  const dishGeo = new THREE.LatheGeometry(dishProfile, 96);
  const rimGeo = new THREE.TorusGeometry(1.307, .018, 8, 96); rimGeo.rotateX(Math.PI / 2);
  const ringGeo = new THREE.TorusGeometry(1.43, .026, 8, 96); ringGeo.rotateX(Math.PI / 2);
  const rosetteGeo = new THREE.TorusGeometry(.2, .007, 4, 40); rosetteGeo.rotateX(Math.PI / 2);
  const pots = [];
  const clickTargets = [];
  for (let i = 0; i < 3; i++) {
    const group = new THREE.Group(); group.position.copy(POT_POINTS[i]); board.add(group);
    const porcelain = makeMesh(dishGeo, materials.porcelain, group);
    porcelain.userData.potIndex = i; clickTargets.push(porcelain);
    const lip = makeMesh(rimGeo, materials.brass, group); lip.position.y = .337;
    const ringMaterial = new THREE.MeshStandardMaterial({ color: 0x8a7384, metalness: .52, roughness: .45, transparent: true, opacity: .5 });
    const ownerRing = makeMesh(ringGeo, ringMaterial, group); ownerRing.position.y = .062;
    const center = makeMesh(rosetteGeo, materials.rosette, group); center.position.y = .16;
    const markGeo = new THREE.BufferGeometry();
    const marks = [];
    for (let petal = 0; petal < 8; petal++) {
      const a = petal * Math.PI / 4;
      marks.push(Math.cos(a) * .25, .162, Math.sin(a) * .25, Math.cos(a) * .35, .162, Math.sin(a) * .35);
    }
    markGeo.setAttribute('position', new THREE.Float32BufferAttribute(marks, 3));
    group.add(new THREE.LineSegments(markGeo, new THREE.LineBasicMaterial({ color: 0xb7aa91 })));
    // A transparent hit disc fills the concave interior without changing its appearance.
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(1.36, 1.36, .25, 32), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    hit.position.y = .2; hit.userData.potIndex = i; group.add(hit); clickTargets.push(hit);
    pots.push({ group, ownerRing, ringMaterial, owner: null });
  }

  const bankGeo = roundedRect(4.0, .84, .3);
  const banks = [];
  for (let player = 0; player < 2; player++) {
    const group = new THREE.Group(); group.position.set(player === 0 ? -5.22 : 5.22, .068, 0); group.rotation.y = Math.PI / 2; board.add(group);
    makeMesh(bankGeo, materials.bank, group);
    const line = makeMesh(new THREE.BoxGeometry(3.35, .013, .014), new THREE.MeshStandardMaterial({ color: player === 0 ? GOLD : LILAC, roughness: .44, metalness: .6 }), group);
    line.position.set(0, .073, player === 0 ? .34 : -.34);
    banks.push(group);
  }

  const coinBody = new THREE.CylinderGeometry(.305, .305, .092, 64);
  const coinFace = new THREE.CircleGeometry(.278, 64); coinFace.rotateX(-Math.PI / 2);
  const rimTop = new THREE.TorusGeometry(.286, .012, 5, 56); rimTop.rotateX(Math.PI / 2);
  const ridges = [];
  for (let i = 0; i < 40; i++) {
    const a = i / 40 * Math.PI * 2;
    const part = new THREE.BoxGeometry(.012, .065, .014);
    part.rotateY(-a); part.translate(Math.cos(a) * .305, 0, Math.sin(a) * .305); ridges.push(part);
  }
  const ridgeGeo = mergeGeometries(ridges); ridges.forEach(g => g.dispose());
  const emblemParts = [];
  for (let petal = 0; petal < 8; petal++) {
    const shape = new THREE.Shape();
    shape.moveTo(0, -.168); shape.lineTo(.026, -.072); shape.lineTo(0, -.036); shape.lineTo(-.026, -.072); shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: .006, bevelEnabled: false, steps: 1 });
    geometry.rotateX(-Math.PI / 2); geometry.rotateY(petal * Math.PI / 4); geometry.translate(0, .05, 0);
    emblemParts.push(geometry);
  }
  const emblemGeo = mergeGeometries(emblemParts); emblemParts.forEach(geometry => geometry.dispose());
  const emblemMaterial = new THREE.MeshStandardMaterial({ color: 0x775224, metalness: .67, roughness: .4 });
  const coins = [];
  for (let i = 0; i < 24; i++) {
    const group = new THREE.Group(); board.add(group);
    makeMesh(coinBody, materials.coin, group);
    const face = makeMesh(coinFace, materials.coinFace, group); face.position.y = .047; face.castShadow = false;
    const border = makeMesh(rimTop, materials.coinRim, group); border.position.y = .047; border.castShadow = false;
    makeMesh(ridgeGeo, materials.coinRim, group).castShadow = false;
    makeMesh(emblemGeo, emblemMaterial, group).castShadow = false;
    group.rotation.y = (i * 2.39996) % (Math.PI * 2);
    coins.push({ group, bucket: i < 12 ? 0 : 1, tween: null, target: new THREE.Vector3() });
  }

  let state = { hands: [12, 12], scores: [0, 0], pots: Array.from({ length: 3 }, () => ({ count: 0, owner: null })), turn: 0, winner: null, ply: 0 };
  let reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let selected = null, hovered = null, disposed = false, hidden = document.hidden;
  let width = 1, height = 1, raf = 0, view = 'perspective', cameraTween = null;
  let initialized = false, lastTime = 0;

  function coinPosition(bucket, slot) {
    if (bucket < 2) {
      const col = slot % 6, layer = Math.floor(slot / 6);
      return new THREE.Vector3(bucket === 0 ? -5.22 : 5.22, .208 + layer * .096, (col - 2.5) * .63);
    }
    const position = POT_POINTS[bucket - 2].clone();
    const cluster = slot % 3;
    const offsets = [[-.34,-.18],[.34,-.18],[0,.39]];
    position.x += offsets[cluster][0]; position.z += offsets[cluster][1];
    position.y = .202 + Math.floor(slot / 3) * .096;
    return position;
  }

  function update(next, { animate = true } = {}) {
    const desired = [...next.hands, ...next.pots.map(p => p.count)].map(v => Math.max(0, Math.floor(Number(v) || 0)));
    if (desired.reduce((sum, count) => sum + count, 0) !== 24) {
      console.warn('Courtesy scene requires exactly 24 coins in hands and pots.');
      return;
    }
    state = next;
    const buckets = Array.from({ length: 5 }, (_, bucket) => coins.filter(c => c.bucket === bucket));
    const spare = [];
    for (let bucket = 0; bucket < 5; bucket++) while (buckets[bucket].length > desired[bucket]) spare.push(buckets[bucket].pop());
    for (let bucket = 0; bucket < 5; bucket++) while (buckets[bucket].length < desired[bucket]) {
      const coin = spare.shift(); coin.bucket = bucket; buckets[bucket].push(coin);
    }
    const now = performance.now(); let movingIndex = 0;
    for (let bucket = 0; bucket < 5; bucket++) {
      buckets[bucket].forEach((coin, slot) => {
        const target = coinPosition(bucket, slot);
        const distance = coin.group.position.distanceTo(target);
        if (initialized && animate && !reducedMotion && distance > .025) {
          coin.tween = { from: coin.group.position.clone(), to: target, start: now + movingIndex++ * 32, duration: 640 + Math.min(distance * 18, 200), arc: Math.min(2.2, .5 + distance * .18) };
        } else { coin.group.position.copy(target); coin.tween = null; }
        coin.target.copy(target);
      });
    }
    pots.forEach((pot, i) => { pot.owner = next.pots[i].owner; });
    initialized = true;
    start();
  }

  function setSelected(index) { selected = index === null ? null : clamp(index, 0, 2); start(); }
  function homePosition() {
    const scale = width / height < 1.45 ? 1.15 : 1;
    return view === 'top' ? new THREE.Vector3(0, 18.9 * scale, .08) : new THREE.Vector3(0, 11.3 * scale, 14.5 * scale);
  }
  function moveHome(animate = true) {
    if (animate && !reducedMotion && initialized) cameraTween = { from: camera.position.clone(), to: homePosition(), target: controls.target.clone(), start: performance.now() };
    else { camera.position.copy(homePosition()); controls.target.set(0, 0, .1); camera.lookAt(controls.target); controls.update(); }
    start();
  }
  function setView(nextView) { view = nextView === 'top' ? 'top' : 'perspective'; moveHome(); }
  function resetView() { view = 'perspective'; moveHome(); }
  function setReducedMotion(value) {
    reducedMotion = Boolean(value);
    controls.enableDamping = !reducedMotion;
    if (reducedMotion) {
      coins.forEach(c => { if (c.tween) c.group.position.copy(c.target); c.tween = null; });
      if (cameraTween) { camera.position.copy(cameraTween.to); controls.target.set(0, 0, .1); cameraTween = null; controls.update(); }
    }
    start();
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width); height = Math.max(1, rect.height);
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
    if (!initialized) moveHome(false);
    start();
  }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(canvas);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(); let pointerDown = null;
  function hitPot(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(clickTargets, false)[0]?.object.userData.potIndex ?? null;
  }
  const onDown = event => { if (event.button === 0) pointerDown = { x: event.clientX, y: event.clientY, id: event.pointerId }; cameraTween = null; };
  const onUp = event => {
    if (pointerDown && event.pointerId === pointerDown.id && Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) < 6) {
      const pot = hitPot(event); if (pot !== null) onPotSelect?.(pot);
    }
    pointerDown = null;
  };
  const onMove = event => { hovered = pointerDown ? null : hitPot(event); canvas.style.cursor = pointerDown ? 'grabbing' : hovered !== null ? 'pointer' : 'grab'; };
  const onLeave = () => { hovered = null; pointerDown = null; canvas.style.cursor = 'grab'; };
  const onWheel = () => { cameraTween = null; };
  canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointermove', onMove); canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('pointercancel', onLeave); canvas.addEventListener('wheel', onWheel, { passive: true });
  canvas.style.cursor = 'grab';
  controls.addEventListener('change', () => {
    controls.target.x = clamp(controls.target.x, -1.8, 1.8);
    controls.target.y = clamp(controls.target.y, -.2, .6);
    controls.target.z = clamp(controls.target.z, -1.3, 1.3);
  });

  const projected = new THREE.Vector3();
  function frame(now) {
    raf = 0; if (disposed || hidden) return;
    lastTime = now;
    if (cameraTween) {
      const t = clamp((now - cameraTween.start) / 650, 0, 1), smooth = t * t * (3 - 2 * t);
      camera.position.lerpVectors(cameraTween.from, cameraTween.to, smooth);
      controls.target.copy(cameraTween.target).lerp(new THREE.Vector3(0, 0, .1), smooth);
      if (t === 1) cameraTween = null;
    }
    for (const coin of coins) {
      const motion = coin.tween;
      if (!motion) continue;
      const t = clamp((now - motion.start) / motion.duration, 0, 1), ease = t * t * (3 - 2 * t);
      coin.group.position.lerpVectors(motion.from, motion.to, ease);
      coin.group.position.y += Math.sin(t * Math.PI) * motion.arc;
      coin.group.rotation.z = Math.sin(t * Math.PI * 2) * .17;
      if (t === 1) { coin.tween = null; coin.group.rotation.z = 0; }
    }
    pots.forEach((pot, i) => {
      const active = selected === i, hover = hovered === i;
      const color = pot.owner === 0 ? GOLD : pot.owner === 1 ? LILAC : 0x8a7384;
      pot.ringMaterial.color.setHex(active ? 0xf8e3b6 : color);
      pot.ringMaterial.opacity = active ? 1 : hover ? .88 : pot.owner === null ? .4 : .86;
      pot.ringMaterial.emissive.setHex(active ? 0x785826 : 0x000000);
      pot.ringMaterial.emissiveIntensity = active ? .2 : 0;
    });
    controls.update();
    renderer.render(scene, camera);
    if (onProject) onProject(POT_POINTS.map(position => {
      projected.copy(position); projected.z += 1.5; projected.y = .16; projected.project(camera);
      return { x: (projected.x + 1) * width / 2, y: (1 - projected.y) * height / 2, visible: projected.z > -1 && projected.z < 1 && Math.abs(projected.x) < 1.2 && Math.abs(projected.y) < 1.2 };
    }));
    raf = requestAnimationFrame(frame);
  }
  function start() { if (!raf && !disposed && !hidden) raf = requestAnimationFrame(frame); }
  function visibilityChange() { hidden = document.hidden; if (hidden) { cancelAnimationFrame(raf); raf = 0; } else start(); }
  document.addEventListener('visibilitychange', visibilityChange);
  resize(); update(state, { animate: false }); moveHome(false); start();
  requestAnimationFrame(() => { if (!disposed) onReady?.(); });

  return {
    update, setSelected, setView, resetView, setReducedMotion,
    getStats: () => ({ coinCount: coins.length, drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, view, reducedMotion, lastFrame: lastTime }),
    dispose() {
      disposed = true; cancelAnimationFrame(raf); resizeObserver.disconnect(); controls.dispose();
      canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('pointercancel', onLeave); canvas.removeEventListener('wheel', onWheel);
      document.removeEventListener('visibilitychange', visibilityChange);
      const geometries = new Set(), allMaterials = new Set();
      scene.traverse(object => { if (object.geometry) geometries.add(object.geometry); if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => allMaterials.add(m)); });
      geometries.forEach(geometry => geometry.dispose()); allMaterials.forEach(material => material.dispose());
      feltTexture.dispose(); metalTexture.dispose(); embossTexture.dispose(); environment.dispose(); renderer.dispose();
    },
  };
}
