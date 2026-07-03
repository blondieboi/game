var mathReward = document.querySelector("#math-reward");
var mathQuestion = document.querySelector("#math-question");
var mathAnswer = document.querySelector("#math-answer");
var mathFeedback = document.querySelector("#math-feedback");
var mathVisual = document.querySelector("#math-visual");
var mathClose = document.querySelector("#math-close");
var mathForm = document.querySelector("#math-form");
var readingForm = document.querySelector("#reading-form");
var readingPassage = document.querySelector("#reading-passage");
var readingQuestion = document.querySelector("#reading-question");
var readingChoices = document.querySelector("#reading-choices");
var logicForm = document.querySelector("#logic-form");
var logicTitle = document.querySelector("#logic-title");
var logicPromptText = document.querySelector("#logic-prompt-text");
var logicMachine = document.querySelector("#logic-machine");
var logicChoices = document.querySelector("#logic-choices");
var shopPanel = document.querySelector("#shop-panel");
var shopClose = document.querySelector("#shop-close");
var shopItems = document.querySelector("#shop-items");
var labPanel = document.querySelector("#lab-panel");
var labClose = document.querySelector("#lab-close");
var labStartTest = document.querySelector("#lab-start-test");
var labItems = document.querySelector("#lab-items");
var inventoryPanel = document.querySelector("#inventory-panel");
var inventoryClose = document.querySelector("#inventory-close");
var inventoryItems = document.querySelector("#inventory-items");
var emeraldCounter = document.querySelector("#emerald-counter");
var diamondCounter = document.querySelector("#diamond-counter");
var rubyCounter = document.querySelector("#ruby-counter");
var emeraldCounterValue = emeraldCounter.querySelector(".counter-value");
var diamondCounterValue = diamondCounter.querySelector(".counter-value");
var rubyCounterValue = rubyCounter.querySelector(".counter-value");

var g = null;

function setGameRef(gameRef) {
  g = gameRef;
}

var activeProblem = null;
var pendingCluster = null;
var currentReadingProblem = null;
var currentLogicProblem = null;
var pendingChallenge = null;
var gameStatusClearTimer = null;
var GAME_STATUS_CLEAR_DELAY = 4000;

function clearGameStatusTimer() {
  if (!gameStatusClearTimer) return;
  window.clearTimeout(gameStatusClearTimer);
  gameStatusClearTimer = null;
}

function setGameStatusText(message, { autoClear = false } = {}) {
  clearGameStatusTimer();
  gameStatus.textContent = message;

  if (!autoClear || !message) return;

  gameStatusClearTimer = window.setTimeout(() => {
    if (gameStatus.textContent === message) {
      gameStatus.textContent = "";
    }
    gameStatusClearTimer = null;
  }, GAME_STATUS_CLEAR_DELAY);
}

function setMathFeedback(message) {
  mathFeedback.textContent = message;
  mathFeedback.hidden = !message;
}

function closeMathPanel({ restoreCluster = false } = {}) {
  if (typeof resetMobileInput === "function") resetMobileInput();
  if (restoreCluster && pendingCluster && g) {
    pendingCluster.userData.available = true;
    const away = g.scratch.away.set(
      g.avatar.position.x - pendingCluster.position.x,
      0,
      g.avatar.position.z - pendingCluster.position.z,
    );
    away.normalize().multiplyScalar(3.5);
    g.avatar.position.x = pendingCluster.position.x + away.x;
    g.avatar.position.z = pendingCluster.position.z + away.z;
    g.avatar.position.x = clamp(g.avatar.position.x, -WORLD_LIMIT, WORLD_LIMIT);
    g.avatar.position.z = clamp(g.avatar.position.z, -WORLD_LIMIT, WORLD_LIMIT);
    g.avatar.position.y = getTerrainHeight(g.avatar.position.x, g.avatar.position.z);
  }

  mathPanel.hidden = true;
  mathVisual.innerHTML = "";
  logicMachine.innerHTML = "";
  logicChoices.innerHTML = "";
  activeProblem = null;
  currentReadingProblem = null;
  currentLogicProblem = null;
  pendingChallenge = null;
  pendingCluster = null;
  setMathFeedback("");
  autoLockPointer();
}

function clearGameState() {
  activeProblem = null;
  pendingCluster = null;
  currentReadingProblem = null;
  currentLogicProblem = null;
  pendingChallenge = null;
}

function closeShop() {
  if (typeof resetMobileInput === "function") resetMobileInput();
  if (!gameUI.shopOpen) return;
  gameUI.shopOpen = false;
  shopPanel.hidden = true;
  autoLockPointer();
}

function closeLabBench({ restorePointer = true } = {}) {
  if (typeof resetMobileInput === "function") resetMobileInput();
  if (!gameUI.labOpen) return;
  gameUI.labOpen = false;
  labPanel.hidden = true;
  if (restorePointer) autoLockPointer();
}

function closeInventory() {
  if (typeof resetMobileInput === "function") resetMobileInput();
  if (!gameUI.inventoryOpen) return;
  gameUI.inventoryOpen = false;
  inventoryPanel.hidden = true;
  autoLockPointer();
}

function autoLockPointer() {
  if (!g || !g.running) return;
  if (!mathPanel.hidden || gameUI.shopOpen || gameUI.labOpen || gameUI.inventoryOpen || gameUI.pointerLocked) return;
  if (typeof shouldUsePointerLock === "function" && !shouldUsePointerLock()) return;
  g.renderer.domElement.requestPointerLock();
}

function updateResourceCounters() {
  emeraldCounterValue.textContent = resources.emeralds;
  diamondCounterValue.textContent = resources.diamonds;
  rubyCounterValue.textContent = resources.rubies;
}

function distance2D(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.hypot(dx, dz);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function smoothStep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function terrainNoise(x, z) {
  return (
    Math.sin(x * 0.085 + z * 0.035) * 0.55 +
    Math.cos(z * 0.075 - x * 0.025) * 0.42 +
    Math.sin((x + z) * 0.045) * 0.34
  );
}

function terrainFlattenFactor(x, z) {
  const pads = [
    { x: 0, z: 0, radius: 7 },
    { x: storePosition.x, z: storePosition.z, radius: 6.8 },
    { x: labPosition.x, z: labPosition.z, radius: 7 },
    { x: -18, z: 18, radius: 5.5 },
    { x: 23, z: 23, radius: 6 },
    { x: -12, z: 8, radius: 5 },
  ];
  let factor = 1;
  pads.forEach((pad) => {
    const distance = Math.hypot(x - pad.x, z - pad.z);
    factor = Math.min(factor, smoothStep(pad.radius * 0.45, pad.radius, distance));
  });
  return factor;
}

function getTerrainHeight(x, z) {
  const rolling = terrainNoise(x, z) * terrainFlattenFactor(x, z) * 0.32;
  const edgeDistance = Math.max(Math.abs(x), Math.abs(z));
  const edgeRise = smoothStep(WORLD_EDGE_START + 4, WORLD_LIMIT + 10, edgeDistance) * 1.4;
  return rolling + edgeRise;
}

function createTerrainMesh() {
  const geometry = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 80, 80);
  const positions = geometry.attributes.position;
  const colors = [];
  const color = new THREE.Color();
  const lowGrass = new THREE.Color(0x3f8f57);
  const midGrass = new THREE.Color(0x55b96b);
  const highGrass = new THREE.Color(0x72d27d);
  const dryGrass = new THREE.Color(0x8abf62);
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const z = -positions.getY(i);
    const height = getTerrainHeight(x, z);
    const patch = Math.sin(x * 0.42 + z * 0.18) * 0.5 + Math.cos(z * 0.31 - x * 0.14) * 0.5;
    positions.setZ(i, height);
    if (height > 1.7) {
      color.copy(highGrass);
    } else if (patch > 0.48) {
      color.copy(dryGrass);
    } else if (patch < -0.35) {
      color.copy(lowGrass);
    } else {
      color.copy(midGrass);
    }
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  positions.needsUpdate = true;
  geometry.computeVertexNormals();

  const ground = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.96 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  return ground;
}

function material(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
}

var _gradientMap = null;
function getGradientMap() {
  if (!_gradientMap) {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");
    const grad = ctx.createLinearGradient(0, 0, 0, 32);
    grad.addColorStop(0.0, "#ffffff");
    grad.addColorStop(0.3, "#c8c8c8");
    grad.addColorStop(0.65, "#888888");
    grad.addColorStop(1.0, "#333333");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1, 32);
    _gradientMap = new THREE.CanvasTexture(canvas);
    _gradientMap.minFilter = THREE.NearestFilter;
    _gradientMap.magFilter = THREE.NearestFilter;
  }
  return _gradientMap;
}

function toonMat(color) {
  return new THREE.MeshToonMaterial({ color, gradientMap: getGradientMap() });
}

function box(width, height, depth, mat, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat);
  mesh.position.set(x, y, z);
  return mesh;
}

function sphere(radius, mat, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 24), mat);
  mesh.position.set(x, y, z);
  return mesh;
}

function limb(radius, height, mat, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 20), mat);
  mesh.position.set(x, y, z);
  return mesh;
}

function ellipsoid(radius, mat, x, y, z, sx, sy, sz) {
  const mesh = sphere(radius, mat, x, y, z);
  mesh.scale.set(sx, sy, sz);
  return mesh;
}

function createWorldObjects(scene, trees) {
  addTrees(scene, trees);
  createStore(scene);
  createProfessorPixelLab(scene);
  createPath(scene);
  createPond(scene);
  createCampfire(scene);
  createRuins(scene);
  createDecorations(scene);
}

function addTrees(scene, trees) {
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8b5e3c, roughness: 0.9 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3a8c42, roughness: 0.85 });
  const darkLeafMat = new THREE.MeshStandardMaterial({ color: 0x2d6b33, roughness: 0.85 });
  const bushMat = new THREE.MeshStandardMaterial({ color: 0x4a9c52, roughness: 0.85 });

  const treePositions = [
    [-10, -8], [-7, -11], [-4, -9], [3, -10], [8, -9],
    [11, -6], [-12, -4], [-9, -2], [10, -3], [13, 0],
    [-13, 2], [11, 3], [8, 7], [-10, 6], [-6, 9],
    [0, 10], [5, 9], [-11, 9], [13, -8], [-4, 12],
    [12, 11], [-13, -9], [4, -12], [-8, -12],
    [18, -16], [-20, -6], [-18, -16], [22, 5], [25, -14],
    [-25, 10], [20, 18], [-22, 20], [28, -22], [-30, -18],
    [15, 26], [-16, 24], [30, 15], [-28, 25], [-32, 0],
    [34, -10], [-36, -14], [32, 22], [-34, 20], [26, 30],
    [-30, 32], [35, -28], [-35, -30], [28, -34], [-26, -35],
    [36, 12], [-34, -8], [-38, 8], [0, 34], [-4, -34],
    [18, -32], [-18, -30], [10, 36], [-12, 36], [38, -18],
  ];

  treePositions.forEach(([x, z]) => {
    const scale = 1.2 + Math.random() * 1.0;
    const groundY = getTerrainHeight(x, z);
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16 * scale, 0.3 * scale, 2.0 * scale, 5),
      trunkMat,
    );
    trunk.position.set(x, groundY + scale, z);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    scene.add(trunk);

    const mat = Math.random() > 0.5 ? leafMat : darkLeafMat;
    const foliage = new THREE.Mesh(
      new THREE.ConeGeometry(1.0 * scale, 1.8 * scale, 6),
      mat,
    );
    foliage.position.set(x, groundY + 1.6 * scale, z);
    foliage.rotation.y = Math.random() * Math.PI;
    foliage.castShadow = true;
    foliage.receiveShadow = true;
    scene.add(foliage);

    trees.push({ x, z, radius: 0.5 });
  });

  const bushPositions = [
    [-8, -6], [-2, -11], [6, -8], [-11, 0], [9, 0],
    [-7, 7], [4, 11], [-9, 11], [11, 8], [-11, -7],
    [2, -6], [-5, 5], [7, -4],
    [-17, 14], [14, -17], [20, 10], [-20, -12], [16, 20],
    [-24, -5], [24, -8], [-14, 22], [10, -22], [-26, 16],
    [30, -5], [-30, 5], [34, 18], [-34, -18], [28, -28],
    [-28, 28], [22, 32], [-22, -32], [-36, -24], [36, 24],
    [0, -28], [32, 0], [-32, 0], [0, 30],
  ];

  bushPositions.forEach(([x, z]) => {
    const size = 0.6 + Math.random() * 0.5;
    const groundY = getTerrainHeight(x, z);
    const bush = new THREE.Mesh(
      new THREE.SphereGeometry(size, 6, 5),
      bushMat,
    );
    bush.position.set(x, groundY + size * 0.7, z);
    bush.castShadow = true;
    bush.receiveShadow = true;
    scene.add(bush);
  });

  addBoundaryForest(scene, trees, trunkMat, leafMat, darkLeafMat);
}

function addBoundaryForest(scene, trees, trunkMat, leafMat, darkLeafMat) {
  const hillMat = new THREE.MeshStandardMaterial({ color: 0x3d8b50, roughness: 0.96 });
  for (let i = 0; i < 76; i += 1) {
    const angle = (i / 76) * Math.PI * 2;
    const radius = WORLD_LIMIT + 4 + (i % 5) * 0.9;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const groundY = getTerrainHeight(x, z);
    const scale = 1.7 + (i % 4) * 0.32;

    if (i % 3 === 0) {
      const hillRadius = 3.0 + (i % 4) * 0.45;
      const hillHeight = 2.6 + (Math.floor(i / 3) % 3) * 0.3;
      const maxDirection = Math.max(Math.abs(Math.cos(angle)), Math.abs(Math.sin(angle)));
      const hillDistance = (WORLD_LIMIT + hillRadius + 5) / maxDirection + (i % 5) * 0.7;
      const hillX = Math.cos(angle) * hillDistance;
      const hillZ = Math.sin(angle) * hillDistance;
      const hillGroundY = getTerrainHeight(hillX, hillZ);
      const hill = new THREE.Mesh(new THREE.ConeGeometry(hillRadius, hillHeight, 7), hillMat);
      hill.position.set(hillX, hillGroundY + hillHeight / 2 + 0.03, hillZ);
      hill.rotation.y = angle;
      hill.castShadow = true;
      hill.receiveShadow = true;
      scene.add(hill);
    }

    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16 * scale, 0.32 * scale, 2.0 * scale, 5),
      trunkMat,
    );
    trunk.position.set(x, groundY + scale, z);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    scene.add(trunk);

    const foliage = new THREE.Mesh(
      new THREE.ConeGeometry(1.1 * scale, 2.0 * scale, 6),
      i % 2 === 0 ? leafMat : darkLeafMat,
    );
    foliage.position.set(x, groundY + 1.75 * scale, z);
    foliage.rotation.y = angle + Math.PI * 0.25;
    foliage.castShadow = true;
    foliage.receiveShadow = true;
    scene.add(foliage);

    trees.push({ x, z, radius: 1.0 });
  }
}

function createStore(scene) {
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8a5730, roughness: 0.92 });
  const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x56361f, roughness: 0.96 });
  const warmWoodMat = new THREE.MeshStandardMaterial({ color: 0xb0743f, roughness: 0.9 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xb94032, roughness: 0.88 });
  const roofStripeMat = new THREE.MeshStandardMaterial({ color: 0xf0c86b, roughness: 0.86 });
  const counterMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.9 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x735338, roughness: 0.94 });
  const signMat = new THREE.MeshStandardMaterial({ color: 0x285f3a, roughness: 0.82 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xf1d48a, roughness: 0.7 });
  const lanternMat = new THREE.MeshStandardMaterial({ color: 0xffc95a, emissive: 0xff9e22, emissiveIntensity: 0.7, roughness: 0.45 });
  const jarMat = new THREE.MeshStandardMaterial({ color: 0x9ee8ff, transparent: true, opacity: 0.45, roughness: 0.12, metalness: 0.1 });
  const emeraldMat = new THREE.MeshStandardMaterial({ color: 0x17b87a, emissive: 0x065c3c, emissiveIntensity: 0.35, roughness: 0.18 });
  const diamondMat = new THREE.MeshStandardMaterial({ color: 0xb8f4ff, emissive: 0x2b7f9a, emissiveIntensity: 0.35, roughness: 0.08 });

  const store = new THREE.Group();

  function addStoreBox(width, height, depth, mat, x, y, z, rotY) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY || 0;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    store.add(mesh);
    return mesh;
  }

  function addCrystal(x, y, z, mat, scale) {
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), mat);
    crystal.position.set(x, y, z);
    crystal.scale.set(0.75, scale, 0.75);
    crystal.rotation.set(0.2, Math.random() * Math.PI, 0.25);
    crystal.castShadow = true;
    store.add(crystal);
    return crystal;
  }

  for (let i = 0; i < 5; i += 1) {
    addStoreBox(0.78, 0.1, 3.05, i % 2 === 0 ? floorMat : warmWoodMat, -1.55 + i * 0.78, 0.05, 0, 0);
  }

  addStoreBox(3.75, 0.16, 0.16, darkWoodMat, 0, 0.18, -1.56, 0);
  addStoreBox(3.75, 0.16, 0.16, darkWoodMat, 0, 0.18, 1.48, 0);
  addStoreBox(0.16, 0.16, 3.05, darkWoodMat, -1.88, 0.18, 0, 0);
  addStoreBox(0.16, 0.16, 3.05, darkWoodMat, 1.88, 0.18, 0, 0);

  for (let i = 0; i < 6; i += 1) {
    addStoreBox(0.58, 1.95, 0.12, i % 2 === 0 ? woodMat : warmWoodMat, -1.45 + i * 0.58, 1.12, -1.45, 0);
  }

  for (const xOff of [-1.65, 1.65]) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.13, 2.45, 7),
      darkWoodMat,
    );
    post.position.set(xOff, 1.25, -1.45);
    post.castShadow = true;
    post.receiveShadow = true;
    store.add(post);
  }

  for (const xOff of [-1.65, 1.65]) {
    const frontPost = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 2.05, 7), darkWoodMat);
    frontPost.position.set(xOff, 1.08, 1.2);
    frontPost.castShadow = true;
    frontPost.receiveShadow = true;
    store.add(frontPost);
  }

  const backRoof = addStoreBox(4.15, 0.12, 1.7, roofMat, 0, 2.28, -0.74, 0);
  backRoof.rotation.x = 0.22;
  const frontRoof = addStoreBox(4.15, 0.12, 2.0, roofMat, 0, 2.12, 0.76, 0);
  frontRoof.rotation.x = -0.16;

  for (let i = 0; i < 5; i += 1) {
    const stripe = addStoreBox(0.28, 0.13, 2.1, i % 2 === 0 ? roofStripeMat : roofMat, -1.5 + i * 0.75, 2.08, 0.84, 0);
    stripe.rotation.x = -0.16;
  }

  addStoreBox(4.3, 0.16, 0.16, darkWoodMat, 0, 2.03, 1.7, 0);

  addStoreBox(3.3, 0.75, 0.58, counterMat, 0, 0.4, 0.75, 0);
  addStoreBox(3.45, 0.12, 0.72, warmWoodMat, 0, 0.82, 0.75, 0);
  for (let i = 0; i < 5; i += 1) {
    addStoreBox(0.08, 0.42, 0.04, darkWoodMat, -1.3 + i * 0.65, 0.43, 1.05, 0);
  }

  addStoreBox(2.8, 0.12, 0.28, darkWoodMat, 0, 1.25, -1.24, 0);
  addStoreBox(2.45, 0.1, 0.25, darkWoodMat, -0.1, 1.68, -1.23, 0);

  for (let i = 0; i < 4; i += 1) {
    const x = -1.05 + i * 0.7;
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.34, 10), jarMat);
    jar.position.set(x, 1.47, -1.13);
    jar.castShadow = true;
    store.add(jar);
    addCrystal(x, 1.47, -1.13, i % 2 === 0 ? emeraldMat : diamondMat, 0.85);
  }

  for (let i = 0; i < 5; i += 1) {
    addCrystal(-1.15 + i * 0.56, 0.98 + (i % 2) * 0.03, 0.86, i % 2 === 0 ? emeraldMat : diamondMat, 0.8 + Math.random() * 0.35);
  }

  const sign = addStoreBox(1.8, 0.46, 0.08, signMat, 0, 1.86, 1.76, 0);
  sign.rotation.x = -0.08;
  addStoreBox(1.95, 0.08, 0.1, trimMat, 0, 2.12, 1.77, 0);
  addStoreBox(1.95, 0.08, 0.1, trimMat, 0, 1.6, 1.77, 0);
  addStoreBox(0.08, 0.54, 0.1, trimMat, -0.96, 1.86, 1.77, 0);
  addStoreBox(0.08, 0.54, 0.1, trimMat, 0.96, 1.86, 1.77, 0);

  addCrystal(-0.34, 1.86, 1.84, emeraldMat, 0.75);
  addCrystal(0.34, 1.86, 1.84, diamondMat, 0.75);
  addStoreBox(0.55, 0.08, 0.1, trimMat, 0, 1.86, 1.84, 0);

  for (const xOff of [-1.55, 1.55]) {
    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.28, 8), lanternMat);
    lantern.position.set(xOff, 1.62, 1.58);
    lantern.castShadow = true;
    store.add(lantern);
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.018, 6, 10), darkWoodMat);
    hook.position.set(xOff, 1.82, 1.58);
    hook.rotation.x = Math.PI / 2;
    store.add(hook);
    const light = new THREE.PointLight(0xffbf5a, 0.35, 4);
    light.position.set(xOff, 1.55, 1.62);
    store.add(light);
  }

  store.add(createShopkeeper());

  store.scale.set(1.62, 1.62, 1.62);
  store.position.set(storePosition.x, getTerrainHeight(storePosition.x, storePosition.z), storePosition.z);
  scene.add(store);
}

function createProfessorPixelLab(scene) {
  const lab = new THREE.Group();
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x4c6870, roughness: 0.88 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xcfe7e2, roughness: 0.78 });
  const darkWallMat = new THREE.MeshStandardMaterial({ color: 0x24414a, roughness: 0.82 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x2a7782, roughness: 0.72 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xffd36a, roughness: 0.55 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x8bf3ff,
    emissive: 0x145b66,
    emissiveIntensity: 0.24,
    transparent: true,
    opacity: 0.48,
    roughness: 0.16,
    metalness: 0.05,
  });
  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x18313a,
    emissive: 0x37f2a5,
    emissiveIntensity: 0.48,
    roughness: 0.4,
  });
  const wireMat = new THREE.MeshStandardMaterial({ color: 0xf05d5e, roughness: 0.56 });
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0xfff1a8,
    emissive: 0xffc34d,
    emissiveIntensity: 0.85,
    roughness: 0.35,
  });

  function addLabBox(width, height, depth, mat, x, y, z, rotY) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY || 0;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    lab.add(mesh);
    return mesh;
  }

  function addTube(x, z, height, mat) {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, height, 14), mat);
    tube.position.set(x, height / 2 + 0.12, z);
    tube.castShadow = true;
    tube.receiveShadow = true;
    lab.add(tube);
    return tube;
  }

  addLabBox(5.6, 0.14, 4.6, floorMat, 0, 0.07, 0, 0);
  addLabBox(5.15, 2.2, 0.22, wallMat, 0, 1.2, -1.8, 0);
  addLabBox(0.22, 2.0, 3.55, wallMat, -2.55, 1.1, -0.08, 0);
  addLabBox(0.22, 2.0, 3.55, wallMat, 2.55, 1.1, -0.08, 0);
  addLabBox(1.4, 1.3, 0.18, darkWallMat, -1.75, 0.86, 1.62, 0);
  addLabBox(1.4, 1.3, 0.18, darkWallMat, 1.75, 0.86, 1.62, 0);

  const backRoof = addLabBox(5.9, 0.16, 2.35, roofMat, 0, 2.35, -0.78, 0);
  backRoof.rotation.x = 0.22;
  const frontRoof = addLabBox(5.9, 0.16, 2.35, roofMat, 0, 2.35, 0.78, 0);
  frontRoof.rotation.x = -0.22;
  addLabBox(5.95, 0.18, 0.22, trimMat, 0, 2.62, 0, 0);

  addLabBox(5.75, 0.16, 0.18, trimMat, 0, 2.13, 1.72, 0);
  addLabBox(5.35, 0.18, 0.24, trimMat, 0, 2.23, -1.95, 0);
  addLabBox(0.16, 2.2, 0.16, trimMat, -2.7, 1.2, 1.75, 0);
  addLabBox(0.16, 2.2, 0.16, trimMat, 2.7, 1.2, 1.75, 0);

  addLabBox(1.05, 0.75, 0.08, glassMat, -0.85, 1.22, 1.78, 0);
  addLabBox(1.05, 0.75, 0.08, glassMat, 0.85, 1.22, 1.78, 0);
  addLabBox(2.0, 0.82, 0.16, screenMat, 0, 1.16, -1.68, 0);
  addLabBox(1.55, 0.08, 0.18, trimMat, 0, 1.64, -1.58, 0);
  addLabBox(1.55, 0.08, 0.18, trimMat, 0, 0.68, -1.58, 0);

  for (let i = 0; i < 5; i += 1) {
    addLabBox(0.18, 0.1, 0.08, glowMat, -0.72 + i * 0.36, 1.18 + (i % 2) * 0.18, -1.56, 0);
  }

  addTube(-2.05, 1.0, 1.35, glassMat);
  addTube(2.05, 0.95, 1.15, glassMat);
  addLabBox(0.62, 0.1, 0.62, trimMat, -2.05, 0.12, 1.0, 0);
  addLabBox(0.62, 0.1, 0.62, trimMat, 2.05, 0.12, 0.95, 0);
  addLabBox(0.14, 0.9, 0.14, wireMat, -1.42, 0.72, 1.22, -0.5);
  addLabBox(0.14, 0.75, 0.14, wireMat, 1.42, 0.62, 1.18, 0.5);

  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 1.0, 8), trimMat);
  antenna.position.set(0, 3.35, -0.1);
  antenna.castShadow = true;
  lab.add(antenna);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 10), glowMat);
  bulb.position.set(0, 3.9, -0.1);
  bulb.castShadow = true;
  lab.add(bulb);
  const labLight = new THREE.PointLight(0x8fffe8, 0.85, 10);
  labLight.position.set(0, 2.1, 0.4);
  lab.add(labLight);

  lab.add(createProfessorPixel());
  lab.position.set(labPosition.x, getTerrainHeight(labPosition.x, labPosition.z), labPosition.z);
  lab.rotation.y = -0.2;
  scene.add(lab);
}

function createProfessorPixel() {
  const group = new THREE.Group();
  const skinMat = material("#c68f6b");
  const coatMat = material("#f4f0df");
  const pantsMat = material("#24414a");
  const gloveMat = material("#ffd36a");
  const hairMat = material("#26323a");
  const eyeMat = material("#17212b");
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x9ee8ff, transparent: true, opacity: 0.58, roughness: 0.12 });
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x18313a, emissive: 0x37f2a5, emissiveIntensity: 0.45, roughness: 0.42 });

  function addPart(mesh, x, y, z, rx, ry, rz) {
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx || 0, ry || 0, rz || 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  addPart(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.62, 10), pantsMat), -0.14, 0.34, 0, 0.04, 0, 0);
  addPart(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.62, 10), pantsMat), 0.14, 0.34, 0, -0.04, 0, 0);
  addPart(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.42), pantsMat), -0.14, 0.05, 0.08, 0, 0.08, 0);
  addPart(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.42), pantsMat), 0.14, 0.05, 0.08, 0, -0.08, 0);
  addPart(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.34), coatMat), 0, 0.96, 0, 0, 0, 0);
  addPart(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.04), screenMat), 0, 0.96, 0.2, 0, 0, 0);
  addPart(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.52, 10), coatMat), -0.42, 1.02, 0.04, 0.2, 0.1, 0.45);
  addPart(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.52, 10), coatMat), 0.42, 1.02, 0.04, 0.2, -0.1, -0.45);
  addPart(new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), gloveMat), -0.55, 0.84, 0.18, 0, 0, 0);
  addPart(new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), gloveMat), 0.55, 0.84, 0.18, 0, 0, 0);
  addPart(new THREE.Mesh(new THREE.SphereGeometry(0.27, 24, 16), skinMat), 0, 1.55, 0.03, 0, 0, 0);
  addPart(new THREE.Mesh(new THREE.SphereGeometry(0.25, 14, 10), hairMat), 0, 1.68, -0.03, 0, 0, 0);
  addPart(new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), eyeMat), -0.1, 1.58, 0.27, 0, 0, 0);
  addPart(new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), eyeMat), 0.1, 1.58, 0.27, 0, 0, 0);
  addPart(new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.018, 7, 18), glassMat), -0.1, 1.58, 0.29, 0, 0, 0);
  addPart(new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.018, 7, 18), glassMat), 0.1, 1.58, 0.29, 0, 0, 0);
  addPart(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.025, 0.025), eyeMat), 0, 1.58, 0.3, 0, 0, 0);
  addPart(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.28, 0.08), screenMat), 0, 0.9, 0.48, -0.15, 0, 0);

  group.scale.setScalar(0.82);
  group.position.set(0, 0.02, 2.1);
  group.rotation.y = 0;
  return group;
}

function createShopkeeper() {
  const group = new THREE.Group();
  const skinMat = material("#f0c7a2");
  const shirtMat = material("#d9603b");
  const sleeveMat = material("#f0b66f");
  const apronMat = new THREE.MeshStandardMaterial({ color: 0x2f6f55, roughness: 0.82 });
  const apronTrimMat = new THREE.MeshStandardMaterial({ color: 0xf1d48a, roughness: 0.76 });
  const pantsMat = material("#33485f");
  const bootMat = material("#2a1d17");
  const hatMat = material("#2a6b3c");
  const hairMat = material("#3a2418");
  const eyeMat = material("#17212b");
  const blushMat = material("#d98278");

  function addPart(mesh, x, y, z, rx, ry, rz) {
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx || 0, ry || 0, rz || 0);
    group.add(mesh);
    return mesh;
  }

  addPart(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.72, 10), pantsMat), -0.18, 0.43, 0, 0.08, 0, 0);
  addPart(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.72, 10), pantsMat), 0.18, 0.43, 0, -0.04, 0, 0);
  addPart(new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.5), bootMat), -0.18, 0.08, 0.08, 0, 0.08, 0);
  addPart(new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.5), bootMat), 0.18, 0.08, 0.08, 0, -0.08, 0);

  addPart(new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.82, 0.36), shirtMat), 0, 1.08, 0, 0, 0, 0);
  addPart(new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.72, 0.04), apronMat), 0, 1.03, 0.2, 0, 0, 0);
  addPart(new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.06, 0.05), apronTrimMat), 0, 1.39, 0.23, 0, 0, 0);
  addPart(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.05), apronTrimMat), -0.18, 1.2, 0.23, 0, 0, 0.52);
  addPart(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.05), apronTrimMat), 0.18, 1.2, 0.23, 0, 0, -0.52);

  addPart(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.58, 10), sleeveMat), -0.45, 1.15, 0.08, 0.25, 0.1, 0.45);
  addPart(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.58, 10), sleeveMat), 0.45, 1.15, 0.08, 0.25, -0.1, -0.45);
  addPart(new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), skinMat), -0.62, 0.96, 0.22, 0, 0, 0);
  addPart(new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), skinMat), 0.62, 0.96, 0.22, 0, 0, 0);

  addPart(new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16), skinMat), 0, 1.73, 0.03, 0, 0, 0);
  addPart(new THREE.Mesh(new THREE.SphereGeometry(0.31, 16, 12), hairMat), 0, 1.81, -0.03, 0, 0, 0);
  addPart(new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), eyeMat), -0.1, 1.79, 0.29, 0, 0, 0);
  addPart(new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), eyeMat), 0.1, 1.79, 0.29, 0, 0, 0);
  addPart(new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), skinMat), 0, 1.72, 0.33, 0, 0, 0);
  addPart(new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), blushMat), -0.18, 1.69, 0.27, 0, 0, 0);
  addPart(new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), blushMat), 0.18, 1.69, 0.27, 0, 0, 0);

  const mustacheLeft = addPart(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.035, 0.035), hairMat), -0.06, 1.65, 0.32, 0, 0, 0.18);
  const mustacheRight = addPart(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.035, 0.035), hairMat), 0.06, 1.65, 0.32, 0, 0, -0.18);
  mustacheLeft.castShadow = true;
  mustacheRight.castShadow = true;

  const hatBrim = addPart(new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.08, 18), hatMat), 0, 1.96, 0.02, 0, 0, 0);
  hatBrim.scale.z = 0.82;
  addPart(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.28, 12), hatMat), 0, 2.1, -0.02, 0, 0, 0);
  addPart(new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.05, 0.04), apronTrimMat), 0, 2.02, 0.27, 0, 0, 0);

  group.scale.setScalar(0.58);
  group.position.set(0, 0.02, -0.62);
  group.traverse((child) => {
    child.castShadow = true;
    child.receiveShadow = true;
  });
  return group;
}

function createPath(scene) {
  const pathMats = [
    new THREE.MeshStandardMaterial({ color: 0x9c835c, roughness: 0.98 }),
    new THREE.MeshStandardMaterial({ color: 0x7f6b4a, roughness: 0.98 }),
    new THREE.MeshStandardMaterial({ color: 0xb19366, roughness: 0.98 }),
  ];
  const pebbleMat = new THREE.MeshStandardMaterial({ color: 0x6c6254, roughness: 0.96 });
  const edgeGrassMat = new THREE.MeshStandardMaterial({ color: 0x3f8c52, roughness: 0.9 });
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(4.5, 0, -3.2),
    new THREE.Vector3(9.5, 0, -8.1),
    new THREE.Vector3(14.7, 0, -12.8),
    new THREE.Vector3(19.5, 0, -19.8),
    new THREE.Vector3(storePosition.x, 0, storePosition.z),
  ]);

  for (let i = 0; i < 30; i += 1) {
    const t = i / 29;
    const point = curve.getPoint(t);
    const tangent = curve.getTangent(t);
    const angle = Math.atan2(tangent.x, tangent.z);
    const side = i % 2 === 0 ? -1 : 1;
    const offset = side * (0.15 + Math.random() * 0.35);
    const width = 1.05 + Math.random() * 0.45;
    const depth = 0.72 + Math.random() * 0.38;
    const stone = new THREE.Mesh(new THREE.CircleGeometry(0.5, 9), pathMats[i % pathMats.length]);
    const stoneX = point.x + Math.cos(angle) * offset;
    const stoneZ = point.z - Math.sin(angle) * offset;
    stone.rotation.x = -Math.PI / 2;
    stone.rotation.z = angle + (Math.random() - 0.5) * 0.4;
    stone.scale.set(width, depth, 1);
    stone.position.set(
      stoneX,
      getTerrainHeight(stoneX, stoneZ) + 0.018 + i * 0.0005,
      stoneZ,
    );
    stone.receiveShadow = true;
    scene.add(stone);

    if (i % 3 === 0) {
      for (let p = 0; p < 2; p += 1) {
        const pebbleSide = p === 0 ? -1 : 1;
        const pebble = new THREE.Mesh(new THREE.DodecahedronGeometry(0.08 + Math.random() * 0.05), pebbleMat);
        const pebbleX = point.x + Math.cos(angle + Math.PI / 2) * pebbleSide * (0.85 + Math.random() * 0.3);
        const pebbleZ = point.z - Math.sin(angle + Math.PI / 2) * pebbleSide * (0.85 + Math.random() * 0.3);
        pebble.position.set(
          pebbleX,
          getTerrainHeight(pebbleX, pebbleZ) + 0.06,
          pebbleZ,
        );
        pebble.rotation.set(Math.random() * 4, Math.random() * 4, Math.random() * 4);
        pebble.castShadow = true;
        pebble.receiveShadow = true;
        scene.add(pebble);
      }
    }

    if (i % 4 === 1) {
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 5), edgeGrassMat);
      const tuftX = point.x + Math.cos(angle + Math.PI / 2) * side * (0.95 + Math.random() * 0.35);
      const tuftZ = point.z - Math.sin(angle + Math.PI / 2) * side * (0.95 + Math.random() * 0.35);
      tuft.position.set(
        tuftX,
        getTerrainHeight(tuftX, tuftZ) + 0.16,
        tuftZ,
      );
      tuft.rotation.y = Math.random() * Math.PI;
      tuft.castShadow = true;
      scene.add(tuft);
    }
  }
}

function createPond(scene) {
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x4a9ebb,
    transparent: true,
    opacity: 0.5,
    roughness: 0.1,
    metalness: 0.3,
  });
  const pond = new THREE.Mesh(new THREE.CircleGeometry(4, 24), waterMat);
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(-12, getTerrainHeight(-12, 8) + 0.03, 8);
  pond.receiveShadow = true;
  scene.add(pond);

  const rockMat = new THREE.MeshStandardMaterial({ color: 0x7a7a7a, roughness: 0.9 });
  const rockPositions = [
    [-15.5, 8.5], [-14, 11.5], [-10, 11], [-8.5, 9],
    [-8, 6.5], [-10, 5], [-14, 5.5], [-16, 6.5],
  ];
  rockPositions.forEach(([x, z]) => {
    const size = 0.3 + Math.random() * 0.5;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(size), rockMat);
    rock.position.set(x, getTerrainHeight(x, z) + size * 0.4, z);
    rock.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    rock.castShadow = true;
    rock.receiveShadow = true;
    scene.add(rock);
  });
}

function createCampfire(scene) {
  const logMat = new THREE.MeshStandardMaterial({ color: 0x5a3518, roughness: 0.92 });
  const barkMat = new THREE.MeshStandardMaterial({ color: 0x3d2714, roughness: 0.95 });
  const emberMat = new THREE.MeshStandardMaterial({ color: 0xff6a1a, emissive: 0xff3b00, emissiveIntensity: 0.85 });
  const ashMat = new THREE.MeshStandardMaterial({ color: 0x3b3832, roughness: 1 });
  const stoneMats = [
    new THREE.MeshStandardMaterial({ color: 0x6c6a61, roughness: 0.95 }),
    new THREE.MeshStandardMaterial({ color: 0x858071, roughness: 0.95 }),
    new THREE.MeshStandardMaterial({ color: 0x504f4b, roughness: 0.95 }),
  ];
  const flameMats = [
    new THREE.MeshStandardMaterial({ color: 0xff3318, emissive: 0xff2200, emissiveIntensity: 1.1, transparent: true, opacity: 0.8 }),
    new THREE.MeshStandardMaterial({ color: 0xff8a18, emissive: 0xff6600, emissiveIntensity: 1.2, transparent: true, opacity: 0.82 }),
    new THREE.MeshStandardMaterial({ color: 0xffe37a, emissive: 0xffb300, emissiveIntensity: 1.35, transparent: true, opacity: 0.78 }),
  ];

  const fire = new THREE.Group();
  fire.position.set(-18, getTerrainHeight(-18, 18), 18);

  const ash = new THREE.Mesh(new THREE.CircleGeometry(0.95, 18), ashMat);
  ash.rotation.x = -Math.PI / 2;
  ash.position.y = 0.012;
  ash.receiveShadow = true;
  fire.add(ash);

  for (let i = 0; i < 13; i += 1) {
    const angle = (i / 13) * Math.PI * 2;
    const stone = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.16 + Math.random() * 0.07),
      stoneMats[i % stoneMats.length],
    );
    stone.position.set(Math.cos(angle) * 0.85, 0.11, Math.sin(angle) * 0.85);
    stone.scale.y = 0.55 + Math.random() * 0.35;
    stone.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    stone.castShadow = true;
    stone.receiveShadow = true;
    fire.add(stone);
  }

  for (let i = 0; i < 5; i += 1) {
    const angle = (i / 5) * Math.PI * 2;
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 1.1, 7), i % 2 === 0 ? logMat : barkMat);
    log.position.set(Math.cos(angle) * 0.24, 0.16, Math.sin(angle) * 0.24);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = angle + 0.4;
    log.castShadow = true;
    log.receiveShadow = true;
    fire.add(log);
  }

  const embers = new THREE.Mesh(new THREE.SphereGeometry(0.22, 9, 7), emberMat);
  embers.scale.set(1.2, 0.35, 1);
  embers.position.set(0, 0.13, 0);
  fire.add(embers);

  for (let i = 0; i < 5; i += 1) {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.18 - i * 0.015, 0.75 - i * 0.07, 7), flameMats[i % flameMats.length]);
    const angle = (i / 5) * Math.PI * 2;
    flame.position.set(Math.cos(angle) * 0.08, 0.58 + i * 0.045, Math.sin(angle) * 0.08);
    flame.rotation.set((Math.random() - 0.5) * 0.35, angle, (Math.random() - 0.5) * 0.35);
    flame.castShadow = true;
    fire.add(flame);
  }

  for (let i = 0; i < 8; i += 1) {
    const spark = new THREE.Mesh(new THREE.SphereGeometry(0.025, 5, 4), emberMat);
    const angle = Math.random() * Math.PI * 2;
    spark.position.set(Math.cos(angle) * (0.12 + Math.random() * 0.25), 0.8 + Math.random() * 0.75, Math.sin(angle) * (0.12 + Math.random() * 0.25));
    fire.add(spark);
  }

  for (let i = 0; i < 3; i += 1) {
    const angle = (i / 3) * Math.PI * 2 + 0.35;
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.35, 7), logMat);
    seat.position.set(Math.cos(angle) * 1.7, 0.2, Math.sin(angle) * 1.7);
    seat.rotation.z = Math.PI / 2;
    seat.rotation.y = -angle;
    seat.castShadow = true;
    seat.receiveShadow = true;
    fire.add(seat);
  }

  const glow = new THREE.PointLight(0xff7a18, 1.15, 9);
  glow.position.set(0, 1.05, 0);
  fire.add(glow);

  scene.add(fire);
}

function createRuins(scene) {
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x78756b, roughness: 0.94 });
  const darkStoneMat = new THREE.MeshStandardMaterial({ color: 0x56544f, roughness: 0.96 });
  const mossMat = new THREE.MeshStandardMaterial({ color: 0x426a3f, roughness: 0.9 });
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x3c8a4d, roughness: 0.88 });

  const ruins = new THREE.Group();
  ruins.position.set(23, getTerrainHeight(23, 23), 23);

  function addBlock(width, height, depth, mat, x, y, z, rotY) {
    const block = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat);
    block.position.set(x, y, z);
    block.rotation.y = rotY || 0;
    block.castShadow = true;
    block.receiveShadow = true;
    ruins.add(block);
    return block;
  }

  function addColumn(x, z, pieces, radius, broken) {
    let y = 0;
    for (let i = 0; i < pieces; i += 1) {
      const height = 0.34 + Math.random() * 0.12;
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.9, radius, height, 10), i % 2 === 0 ? stoneMat : darkStoneMat);
      drum.position.set(x + (Math.random() - 0.5) * 0.06, y + height / 2, z + (Math.random() - 0.5) * 0.06);
      drum.rotation.y = Math.random() * Math.PI;
      drum.rotation.x = broken && i === pieces - 1 ? 0.12 : 0;
      drum.castShadow = true;
      drum.receiveShadow = true;
      ruins.add(drum);
      y += height + 0.02;
    }
    addBlock(radius * 2.4, 0.16, radius * 2.4, stoneMat, x, y + 0.08, z, Math.random() * 0.4);
  }

  for (let x = -1; x <= 1; x += 1) {
    for (let z = -1; z <= 1; z += 1) {
      if (Math.random() > 0.2) {
        const tile = addBlock(1.05, 0.06, 1.05, Math.random() > 0.35 ? stoneMat : darkStoneMat, x * 0.95, 0.03, z * 0.95, (Math.random() - 0.5) * 0.2);
        tile.position.y = 0.02 + Math.random() * 0.02;
      }
    }
  }

  addColumn(-1.45, -0.95, 5, 0.24, false);
  addColumn(1.45, -0.95, 4, 0.24, true);
  addColumn(-1.45, 1.1, 2, 0.22, true);
  addColumn(1.35, 1.25, 3, 0.22, true);

  for (let i = 0; i < 9; i += 1) {
    const angle = -Math.PI * 0.86 + i * (Math.PI * 0.72 / 8);
    const archStone = addBlock(0.34, 0.24, 0.42, i % 2 === 0 ? stoneMat : darkStoneMat, Math.cos(angle) * 1.5, 1.8 + Math.sin(angle) * 0.7, -0.95, -angle);
    archStone.rotation.z = angle + Math.PI / 2;
  }

  addBlock(0.35, 1.2, 0.42, stoneMat, -1.45, 0.92, -0.95, 0.04);
  addBlock(0.35, 0.95, 0.42, darkStoneMat, 1.45, 0.78, -0.95, -0.08);
  addBlock(1.8, 0.22, 0.4, darkStoneMat, 0.35, 1.15, 1.2, 0.18);

  for (let i = 0; i < 17; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 1.1 + Math.random() * 2.1;
    const rubble = new THREE.Mesh(new THREE.DodecahedronGeometry(0.14 + Math.random() * 0.18), i % 2 === 0 ? stoneMat : darkStoneMat);
    rubble.position.set(Math.cos(angle) * dist, 0.08, Math.sin(angle) * dist);
    rubble.scale.y = 0.45 + Math.random() * 0.6;
    rubble.rotation.set(Math.random() * 4, Math.random() * 4, Math.random() * 4);
    rubble.castShadow = true;
    rubble.receiveShadow = true;
    ruins.add(rubble);
  }

  const mossSpots = [
    [-0.8, 0.08, -0.2], [0.55, 0.09, 0.35], [1.35, 1.32, 1.2], [-1.45, 1.85, -0.95],
  ];
  mossSpots.forEach(([x, y, z]) => {
    const moss = new THREE.Mesh(new THREE.CircleGeometry(0.22 + Math.random() * 0.16, 7), mossMat);
    moss.position.set(x, y + 0.01, z);
    moss.rotation.x = -Math.PI / 2;
    moss.rotation.z = Math.random() * Math.PI;
    ruins.add(moss);
  });

  for (let i = 0; i < 10; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.1 + Math.random() * 0.05, 0.38 + Math.random() * 0.18, 5), grassMat);
    tuft.position.set(Math.cos(angle) * (0.9 + Math.random() * 1.9), 0.18, Math.sin(angle) * (0.9 + Math.random() * 1.9));
    tuft.rotation.y = Math.random() * Math.PI;
    tuft.castShadow = true;
    ruins.add(tuft);
  }

  scene.add(ruins);
}

function createDecorations(scene) {
  const flowerMat1 = new THREE.MeshStandardMaterial({ color: 0xff6b8a, roughness: 0.6 });
  const flowerMat2 = new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.6 });
  const flowerMat3 = new THREE.MeshStandardMaterial({ color: 0xff9ff3, roughness: 0.6 });
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x3a8c42, roughness: 0.8 });
  const mushroomCap = new THREE.MeshStandardMaterial({ color: 0xcc4444, roughness: 0.7 });
  const mushroomStem = new THREE.MeshStandardMaterial({ color: 0xe8dcc8, roughness: 0.8 });
  const patchMats = [
    new THREE.MeshStandardMaterial({ color: 0x3f9b58, roughness: 0.98 }),
    new THREE.MeshStandardMaterial({ color: 0x74b95b, roughness: 0.98 }),
    new THREE.MeshStandardMaterial({ color: 0x8f7d54, roughness: 0.98 }),
    new THREE.MeshStandardMaterial({ color: 0x5aa866, roughness: 0.98 }),
  ];

  function groundPatch(x, z, radius, mat, stretch) {
    const patch = new THREE.Mesh(new THREE.CircleGeometry(radius, 9), mat);
    patch.rotation.x = -Math.PI / 2;
    patch.rotation.z = Math.random() * Math.PI;
    patch.scale.set(stretch, 0.7 + Math.random() * 0.5, 1);
    patch.position.set(x, getTerrainHeight(x, z) + 0.022, z);
    patch.receiveShadow = true;
    scene.add(patch);
  }

  function flower(x, z, mat) {
    const groundY = getTerrainHeight(x, z);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.25, 4), stemMat);
    stem.position.set(x, groundY + 0.12, z);
    scene.add(stem);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), mat);
    head.position.set(x, groundY + 0.28, z);
    scene.add(head);
  }

  function mushroom(x, z) {
    const groundY = getTerrainHeight(x, z);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.18, 6), mushroomStem);
    stem.position.set(x, groundY + 0.09, z);
    scene.add(stem);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.1, 6), mushroomCap);
    cap.position.set(x, groundY + 0.22, z);
    scene.add(cap);
  }

  const flowerSpots = [
    [-2, 4], [3, -5], [-5, -3], [7, -8], [-8, 12],
    [6, 14], [-14, -4], [16, -6], [-18, 10], [14, 16],
    [10, -14], [-6, -10], [22, 8], [-24, -8], [0, -16],
    [28, -18], [-30, 14], [20, 26], [-20, -24], [34, 4],
    [-34, -6], [12, -30], [-12, 30], [30, -30], [-30, -30],
    [36, 20], [-36, -20], [0, 36], [26, -36], [-26, 36],
  ];
  flowerSpots.forEach(([x, z], i) => {
    flower(x, z, [flowerMat1, flowerMat2, flowerMat3][i % 3]);
  });

  const mushroomSpots = [
    [-3, 6], [9, -7], [12, 5], [-7, -8], [-16, 14],
    [18, -12], [-22, -6], [8, 20],
    [26, -24], [-28, 18], [32, -8], [-32, 10],
    [14, 28], [-14, -28], [34, -26], [-34, 26],
    [0, -32], [22, 34], [-22, -34],
  ];
  mushroomSpots.forEach(([x, z]) => mushroom(x, z));

  const patchSpots = [
    [-6, 3], [5, 2], [11, -5], [-12, -9], [18, -18], [25, -24],
    [-17, 18], [-21, 15], [20, 22], [26, 18], [-28, 6], [31, -11],
    [-34, -18], [36, 21], [8, 29], [-10, 33], [34, -33], [-32, 30],
    [2, -27], [-22, -28], [16, 36], [-37, 2], [42, 5], [-44, -8],
  ];
  patchSpots.forEach(([x, z], index) => {
    groundPatch(x, z, 0.6 + (index % 4) * 0.18, patchMats[index % patchMats.length], 1.1 + (index % 3) * 0.35);
  });
}

function syncPixelPet() {
  if (!g) return;
  if (g.pixelPet) {
    g.scene.remove(g.pixelPet);
    g.pixelPet = null;
  }
  if (!activePixelPet) return;
  g.pixelPet = createPixelPet(activePixelPet);
  if (g.avatar) {
    g.pixelPet.position.set(
      g.avatar.position.x - 0.9,
      getTerrainHeight(g.avatar.position.x - 0.9, g.avatar.position.z + 0.75) + 0.75,
      g.avatar.position.z + 0.75,
    );
  }
  g.scene.add(g.pixelPet);
}

function createPixelPet(petId) {
  const group = new THREE.Group();
  const rubyMat = new THREE.MeshStandardMaterial({
    color: 0xd92757,
    emissive: 0x6b0d25,
    emissiveIntensity: 0.3,
    roughness: 0.28,
    metalness: 0.08,
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x26323a, roughness: 0.72 });
  const lightMat = new THREE.MeshStandardMaterial({
    color: 0xffd36a,
    emissive: 0xffb84a,
    emissiveIntensity: 0.4,
    roughness: 0.35,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x9ee8ff,
    emissive: 0x1b7f91,
    emissiveIntensity: 0.22,
    transparent: true,
    opacity: 0.66,
    roughness: 0.12,
  });

  function addPetPart(mesh, x, y, z, rx, ry, rz) {
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx || 0, ry || 0, rz || 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  if (petId === "minirobot") {
    addPetPart(new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.42, 0.36), rubyMat), 0, 0.28, 0, 0, 0, 0);
    addPetPart(new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.24, 0.16), glassMat), 0, 0.34, 0.2, 0, 0, 0);
    addPetPart(new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), lightMat), -0.1, 0.36, 0.29, 0, 0, 0);
    addPetPart(new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), lightMat), 0.1, 0.36, 0.29, 0, 0, 0);
    addPetPart(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.28, 8), darkMat), -0.15, 0.02, 0.02, 0, 0, 0);
    addPetPart(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.28, 8), darkMat), 0.15, 0.02, 0.02, 0, 0, 0);
  } else if (petId === "gnistdronare") {
    addPetPart(new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 12), rubyMat), 0, 0.34, 0, 0, 0, 0);
    addPetPart(new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.025, 8, 28), glassMat), 0, 0.34, 0, Math.PI / 2, 0, 0);
    addPetPart(new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), lightMat), 0, 0.64, 0, 0, 0, 0);
    const glow = new THREE.PointLight(0xff5d84, 0.55, 4);
    glow.position.set(0, 0.45, 0);
    group.add(glow);
  } else {
    addPetPart(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.46), rubyMat), 0, 0.28, 0, 0.15, 0.3, 0.08);
    addPetPart(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.04), lightMat), 0, 0.32, 0.25, 0, 0, 0);
    addPetPart(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.04), darkMat), -0.1, 0.4, 0.25, 0, 0, 0);
    addPetPart(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.04), darkMat), 0.1, 0.4, 0.25, 0, 0, 0);
  }

  group.userData.petId = petId;
  group.scale.setScalar(0.85);
  return group;
}

function updatePixelPet(delta) {
  if (!g || !g.avatar) return;
  if (activePixelPet && !g.pixelPet) {
    syncPixelPet();
  }
  if (!g.pixelPet) return;

  const side = g.scratch.petSide.set(-Math.cos(g.avatar.rotation.y), 0, Math.sin(g.avatar.rotation.y));
  const back = g.scratch.petBack.set(-Math.sin(g.avatar.rotation.y), 0, -Math.cos(g.avatar.rotation.y));
  const target = g.scratch.petTarget
    .copy(g.avatar.position)
    .add(side.multiplyScalar(0.8))
    .add(back.multiplyScalar(0.95));
  target.y = getTerrainHeight(target.x, target.z) + 0.68 + Math.sin(g.clock.elapsedTime * 3.4) * 0.08;
  g.pixelPet.position.lerp(target, Math.min(delta * 5.5, 1));
  g.pixelPet.rotation.y += delta * 1.8;
}

function createAvatar() {
  var root = new THREE.Group();
  var visual = new THREE.Group();
  root.userData.visual = visual;
  root.userData.leftArm = null;
  root.userData.rightArm = null;
  root.userData.leftLeg = null;
  root.userData.rightLeg = null;
  root.add(visual);

  visual.add(createFallbackAvatarVisual());
  bindFallbackParts(root, visual);

  return root;
}

function createFallbackAvatarVisual() {
  var group = new THREE.Group();
  var skinMat = toonMat(colorLookup[characterState.skin] || '#b97455');
  var shirtMat = toonMat(colorLookup[characterState.shirtColor] || '#1e88e5');
  var pantsMat = toonMat(colorLookup[characterState.pantsColor] || '#43a047');
  var hairMat = toonMat(colorLookup[characterState.hairColor] || '#4b2d1c');
  var eyeMat = toonMat(colorLookup[characterState.eyes] || '#17212b');
  var mouthMat = toonMat('#7d2b36');
  var badgeMat = toonMat(colorLookup[characterState.badgeColor] || '#fb8c00');
  var shoeMat = toonMat('#1a1f29');

  var trimMat = toonMat('#f7f0d6');
  var shadowMat = toonMat('#222833');

  var leftArm = createStylizedArm(shirtMat, skinMat, trimMat, -0.43, 1.34, 0, -1);
  var rightArm = createStylizedArm(shirtMat, skinMat, trimMat, 0.43, 1.34, 0, 1);
  var leftLeg = createStylizedLeg(pantsMat, shoeMat, -0.18, 0.87, 0);
  var rightLeg = createStylizedLeg(pantsMat, shoeMat, 0.18, 0.87, 0);
  leftArm.rotation.z = -0.16;
  rightArm.rotation.z = 0.16;
  group.userData.leftArm = leftArm;
  group.userData.rightArm = rightArm;
  group.userData.leftLeg = leftLeg;
  group.userData.rightLeg = rightLeg;
  group.add(leftArm);
  group.add(rightArm);
  group.add(leftLeg);
  group.add(rightLeg);
  addStylizedBody(group, shirtMat, pantsMat, trimMat, shadowMat, badgeMat);
  group.add(limb(0.085, 0.24, skinMat, 0, 1.48, 0));
  group.add(ellipsoid(0.28, skinMat, 0, 1.71, 0.02, 0.9, 1.05, 0.86));
  group.add(ellipsoid(0.055, skinMat, -0.25, 1.69, 0, 0.65, 1, 0.45));
  group.add(ellipsoid(0.055, skinMat, 0.25, 1.69, 0, 0.65, 1, 0.45));
  addFallbackHair(group, hairMat);
  addFallbackFace(group, skinMat, eyeMat, mouthMat);
  addFallbackBadge(group, badgeMat, trimMat);
  group.traverse(function (child) {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return group;
}

function addStylizedBody(group, shirtMat, pantsMat, trimMat, shadowMat, badgeMat) {
  var torso = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.35, 0.66, 18), shirtMat);
  torso.position.set(0, 1.08, 0);
  torso.scale.z = 0.72;
  group.add(torso);

  var chest = ellipsoid(0.24, shirtMat, 0, 1.15, 0.22, 1.18, 1.35, 0.22);
  chest.rotation.x = -0.08;
  group.add(chest);
  group.add(ellipsoid(0.14, shirtMat, -0.28, 1.36, 0, 1.05, 0.78, 0.9));
  group.add(ellipsoid(0.14, shirtMat, 0.28, 1.36, 0, 1.05, 0.78, 0.9));
  group.add(ellipsoid(0.22, shirtMat, 0, 1.38, 0.01, 1.35, 0.38, 0.72));
  group.add(box(0.56, 0.055, 0.31, trimMat, 0, 1.39, 0.03));
  group.add(box(0.55, 0.07, 0.33, trimMat, 0, 0.76, 0.01));

  var collarLeft = box(0.18, 0.05, 0.035, trimMat, -0.08, 1.4, 0.19);
  var collarRight = box(0.18, 0.05, 0.035, trimMat, 0.08, 1.4, 0.19);
  collarLeft.rotation.z = -0.45;
  collarRight.rotation.z = 0.45;
  group.add(collarLeft);
  group.add(collarRight);

  var shorts = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.28, 0.2, 18), pantsMat);
  shorts.position.set(0, 0.68, 0);
  shorts.scale.z = 0.74;
  group.add(shorts);
  group.add(box(0.42, 0.035, 0.035, shadowMat, 0, 0.74, 0.21));

  var pack = ellipsoid(0.2, badgeMat, 0, 1.08, -0.26, 1.15, 1.35, 0.48);
  group.add(pack);
  var strapLeft = box(0.055, 0.58, 0.035, shadowMat, -0.16, 1.14, -0.23);
  var strapRight = box(0.055, 0.58, 0.035, shadowMat, 0.16, 1.14, -0.23);
  strapLeft.rotation.z = 0.16;
  strapRight.rotation.z = -0.16;
  group.add(strapLeft);
  group.add(strapRight);
  group.add(box(0.18, 0.035, 0.03, trimMat, 0, 1.22, -0.37));
}

function createStylizedArm(shirtMat, skinMat, trimMat, x, y, z, side) {
  var grp = new THREE.Group();
  grp.position.set(x, y, z);

  var shoulder = ellipsoid(0.115, shirtMat, 0, -0.02, 0, 1.08, 0.82, 0.96);
  grp.add(shoulder);

  var sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.09, 0.32, 18), shirtMat);
  sleeve.position.y = -0.16;
  grp.add(sleeve);

  var cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.045, 18), trimMat);
  cuff.position.y = -0.32;
  grp.add(cuff);

  var forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.3, 18), skinMat);
  forearm.position.y = -0.48;
  forearm.rotation.z = side * 0.08;
  grp.add(forearm);

  grp.add(ellipsoid(0.055, skinMat, side * 0.01, -0.36, 0.01, 0.9, 0.7, 0.9));
  var hand = ellipsoid(0.09, skinMat, side * 0.015, -0.66, 0.02, 0.9, 0.75, 1.05);
  grp.add(hand);
  return grp;
}

function createStylizedLeg(pantsMat, shoeMat, x, y, z) {
  var grp = new THREE.Group();
  grp.position.set(x, y, z);

  var thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.115, 0.36, 18), pantsMat);
  thigh.position.y = -0.18;
  grp.add(thigh);

  var knee = ellipsoid(0.08, pantsMat, 0, -0.38, 0.02, 0.95, 0.58, 0.9);
  grp.add(knee);

  var shin = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.095, 0.34, 18), pantsMat);
  shin.position.y = -0.55;
  grp.add(shin);

  var shoe = ellipsoid(0.16, shoeMat, 0, -0.79, 0.1, 0.9, 0.42, 1.55);
  shoe.rotation.x = -0.05;
  grp.add(shoe);
  grp.add(ellipsoid(0.08, shoeMat, 0, -0.77, 0.29, 1.15, 0.38, 0.85));
  return grp;
}

function addFallbackHair(group, hairMat) {
  group.add(ellipsoid(0.3, hairMat, 0, 1.81, -0.03, 0.95, 0.72, 0.88));
  group.add(ellipsoid(0.18, hairMat, 0, 1.84, 0.13, 1.45, 0.42, 0.5));

  if (characterState.hair === 'hair-short') {
    group.add(ellipsoid(0.12, hairMat, 0, 1.86, 0.1, 1.85, 0.48, 0.9));
    group.add(ellipsoid(0.08, hairMat, -0.18, 1.77, 0.12, 0.65, 1.2, 0.6));
    group.add(ellipsoid(0.08, hairMat, 0.18, 1.77, 0.12, 0.65, 1.2, 0.6));
    group.add(ellipsoid(0.06, hairMat, 0.02, 1.9, 0.21, 0.8, 0.55, 0.7));
    return;
  }

  if (characterState.hair === 'hair-curly') {
    var curls = [
      [-0.2, 1.86, 0.08], [0, 1.92, 0.12], [0.2, 1.86, 0.08],
      [-0.17, 1.76, 0.21], [0, 1.77, 0.23], [0.17, 1.76, 0.21],
      [-0.22, 1.69, 0.04], [0.22, 1.69, 0.04],
    ];
    curls.forEach(function (pos) {
      group.add(ellipsoid(0.085, hairMat, pos[0], pos[1], pos[2], 1.05, 0.95, 0.9));
    });
    return;
  }

  if (characterState.hair === 'hair-long') {
    group.add(ellipsoid(0.22, hairMat, 0, 1.61, -0.2, 1.1, 1.75, 0.42));
    group.add(ellipsoid(0.12, hairMat, -0.25, 1.65, 0.02, 0.75, 1.7, 0.7));
    group.add(ellipsoid(0.12, hairMat, 0.25, 1.65, 0.02, 0.75, 1.7, 0.7));
    group.add(ellipsoid(0.08, hairMat, -0.14, 1.83, 0.17, 0.95, 0.6, 0.7));
    group.add(ellipsoid(0.08, hairMat, 0.14, 1.83, 0.17, 0.95, 0.6, 0.7));
    return;
  }

  var wave = ellipsoid(0.11, hairMat, -0.06, 1.9, 0.12, 1.8, 0.48, 0.82);
  wave.rotation.z = -0.12;
  group.add(wave);
  group.add(ellipsoid(0.11, hairMat, 0.19, 1.79, 0.09, 0.85, 1.2, 0.7));
  group.add(ellipsoid(0.065, hairMat, -0.18, 1.78, 0.12, 0.8, 1.1, 0.65));
}

function addFallbackFace(group, skinMat, eyeMat, mouthMat) {
  var blushMat = toonMat('#ec8d83');
  var shineMat = toonMat('#fffaf2');
  var maskLightMat = toonMat('#f4f7fb');

  group.add(ellipsoid(0.032, skinMat, 0, 1.66, 0.28, 0.75, 0.9, 1.15));
  group.add(ellipsoid(0.024, blushMat, -0.15, 1.64, 0.265, 1.35, 0.55, 0.28));
  group.add(ellipsoid(0.024, blushMat, 0.15, 1.64, 0.265, 1.35, 0.55, 0.28));

  if (characterState.face === 'face-apoc') {
    group.add(ellipsoid(0.035, eyeMat, -0.1, 1.71, 0.25, 0.8, 1.05, 0.55));
    group.add(ellipsoid(0.035, eyeMat, 0.1, 1.71, 0.25, 0.8, 1.05, 0.55));
    group.add(box(0.32, 0.12, 0.035, maskLightMat, 0, 1.64, 0.3));
    group.add(box(0.09, 0.035, 0.04, skinMat, -0.08, 1.65, 0.32));
    group.add(box(0.09, 0.035, 0.04, skinMat, 0.08, 1.65, 0.32));
    return;
  }

  if (characterState.face === 'face-calm') {
    group.add(box(0.2, 0.025, 0.025, eyeMat, -0.1, 1.71, 0.27));
    group.add(box(0.2, 0.025, 0.025, eyeMat, 0.1, 1.71, 0.27));
    group.add(box(0.16, 0.022, 0.025, mouthMat, 0, 1.59, 0.28));
    return;
  }

  group.add(ellipsoid(0.035, eyeMat, -0.1, 1.71, 0.25, 0.8, 1.05, 0.55));
  group.add(ellipsoid(0.035, eyeMat, 0.1, 1.71, 0.25, 0.8, 1.05, 0.55));
  group.add(ellipsoid(0.011, shineMat, -0.09, 1.725, 0.275, 0.9, 0.9, 0.4));
  group.add(ellipsoid(0.011, shineMat, 0.11, 1.725, 0.275, 0.9, 0.9, 0.4));
  group.add(ellipsoid(0.026, eyeMat, -0.1, 1.765, 0.235, 1.35, 0.32, 0.26));
  group.add(ellipsoid(0.026, eyeMat, 0.1, 1.765, 0.235, 1.35, 0.32, 0.26));

  if (characterState.face === 'face-focus') {
    group.add(box(0.22, 0.025, 0.025, mouthMat, 0, 1.59, 0.28));
    group.add(ellipsoid(0.035, eyeMat, -0.15, 1.76, 0.24, 1.1, 0.45, 0.35));
    group.add(ellipsoid(0.035, eyeMat, 0.15, 1.76, 0.24, 1.1, 0.45, 0.35));
    return;
  }

  group.add(ellipsoid(0.018, mouthMat, -0.055, 1.6, 0.252, 1.15, 0.48, 0.24));
  group.add(ellipsoid(0.018, mouthMat, 0, 1.58, 0.258, 1.25, 0.48, 0.22));
  group.add(ellipsoid(0.018, mouthMat, 0.055, 1.6, 0.252, 1.15, 0.48, 0.24));
}

function addFallbackBadge(group, badgeMat, trimMat) {
  var badge = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.018, 24), badgeMat);
  badge.position.set(0.17, 1.16, 0.25);
  badge.rotation.x = Math.PI / 2;
  group.add(badge);

  var shine = box(0.055, 0.015, 0.016, trimMat, 0.15, 1.19, 0.27);
  shine.rotation.z = -0.55;
  group.add(shine);
  group.add(ellipsoid(0.018, trimMat, 0.19, 1.14, 0.27, 0.9, 0.9, 0.32));
}

function bindFallbackParts(root, visual) {
  var fallback = visual.children[0];
  if (!fallback) return;
  root.userData.leftArm = fallback.userData.leftArm;
  root.userData.rightArm = fallback.userData.rightArm;
  root.userData.leftLeg = fallback.userData.leftLeg;
  root.userData.rightLeg = fallback.userData.rightLeg;
  setFallbackPartBase(root.userData.leftArm);
  setFallbackPartBase(root.userData.rightArm);
  setFallbackPartBase(root.userData.leftLeg);
  setFallbackPartBase(root.userData.rightLeg);
}

function setFallbackPartBase(part) {
  if (!part) return;
  part.userData.baseRotation = part.rotation.clone();
}

var LEG_SWING = 0.22;
var ARM_SWING = 0.28;

function animateAvatar(hadInput, delta) {
  const ud = g.avatar.userData;
  const visual = ud.visual || g.avatar;
  const t = g.clock.elapsedTime * 10;
  const settle = Math.min(delta * 8, 1);

  if (hadInput) {
    const swing = Math.sin(t);
    applyBoneSwing(ud.leftArm, swing * ARM_SWING);
    applyBoneSwing(ud.rightArm, -swing * ARM_SWING);
    applyBoneSwing(ud.leftLeg, -swing * LEG_SWING);
    applyBoneSwing(ud.rightLeg, swing * LEG_SWING);
    visual.position.y = Math.abs(Math.sin(t)) * 0.04;
  } else {
    resetBoneSwing(ud.leftArm, settle);
    resetBoneSwing(ud.rightArm, settle);
    resetBoneSwing(ud.leftLeg, settle);
    resetBoneSwing(ud.rightLeg, settle);
    visual.position.y += (0 - visual.position.y) * settle;
  }
}

function applyBoneSwing(bone, amount) {
  if (!bone || !bone.userData.baseRotation) return;
  bone.rotation.x = bone.userData.baseRotation.x + amount;
}

function resetBoneSwing(bone, settle) {
  if (!bone || !bone.userData.baseRotation) return;
  bone.rotation.x += (bone.userData.baseRotation.x - bone.rotation.x) * settle;
}

function applyWorldMood() {
  const mood = backgroundLookup[characterState.background] || backgroundLookup["background-sunny"];
  g.scene.background = new THREE.Color(mood.sky);
  g.scene.fog = new THREE.Fog(mood.fog, 34, 92);
  g.ground.material.color.setHex(mood.ground);
  g.sunLight.intensity = characterState.background === "background-night" ? 0.35 : 1.1;
}

function collidesWithTrees(position, trees) {
  for (const tree of trees) {
    const dx = position.x - tree.x;
    const dz = position.z - tree.z;
    if (dx * dx + dz * dz < (PLAYER_RADIUS + tree.radius) * (PLAYER_RADIUS + tree.radius)) {
      return true;
    }
  }
  return false;
}

function collidesWithStore(position) {
  const dx = Math.abs(position.x - storePosition.x);
  const dz = Math.abs(position.z - storePosition.z);
  return dx < storeHalfWidth + PLAYER_RADIUS && dz < storeHalfDepth + PLAYER_RADIUS;
}

function collidesWithLab(position) {
  const dx = Math.abs(position.x - labPosition.x);
  const dz = Math.abs(position.z - labPosition.z);
  return dx < labHalfWidth + PLAYER_RADIUS && dz < labHalfDepth + PLAYER_RADIUS;
}

function ensureCollectibleClusters() {
  if (g.collectibleClusters.length > 0) return;

  for (let index = 0; index < 6; index += 1) {
    spawnCollectibleCluster("emerald");
  }
  for (let index = 0; index < 5; index += 1) {
    spawnCollectibleCluster("diamond");
  }
}

function spawnCollectibleCluster(kind) {
  const position = findOpenSpawnPoint();
  const cluster = createGemCluster(kind, kind === "diamond" ? 3 : 4);
  cluster.position.set(position.x, getTerrainHeight(position.x, position.z), position.z);
  cluster.userData.kind = kind;
  cluster.userData.available = true;
  g.collectibleClusters.push(cluster);
  g.scene.add(cluster);
}

function createGemCluster(kind, value) {
  const cluster = new THREE.Group();
  const primaryColor = kind === "diamond" ? 0x9ee8ff : 0x18b875;
  const secondaryColor = kind === "diamond" ? 0xf4fdff : 0x08784f;
  const glowColor = kind === "diamond" ? 0xc9f6ff : 0x60ffba;
  const baseColor = kind === "diamond" ? 0x576b7b : 0x234638;
  const primaryMaterial = new THREE.MeshPhysicalMaterial({
    color: primaryColor,
    emissive: kind === "diamond" ? 0x123c4d : 0x063d2b,
    emissiveIntensity: 0.18,
    metalness: 0.05,
    roughness: kind === "diamond" ? 0.08 : 0.18,
    transparent: true,
    opacity: kind === "diamond" ? 0.7 : 0.88,
    clearcoat: 0.9,
  });
  const secondaryMaterial = new THREE.MeshPhysicalMaterial({
    color: secondaryColor,
    emissive: kind === "diamond" ? 0x1d4b5c : 0x04261c,
    emissiveIntensity: 0.16,
    metalness: 0.08,
    roughness: kind === "diamond" ? 0.06 : 0.2,
    transparent: true,
    opacity: kind === "diamond" ? 0.62 : 0.9,
    clearcoat: 0.92,
  });
  const crystalGeometry =
    kind === "diamond" ? new THREE.OctahedronGeometry(0.5, 1) : new THREE.OctahedronGeometry(0.45, 0);
  const baseGeometry = new THREE.CylinderGeometry(0.72, 0.9, 0.25, 9);
  const base = new THREE.Mesh(
    baseGeometry,
    new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.92 }),
  );
  base.position.y = 0.12;
  base.receiveShadow = true;
  cluster.add(base);

  for (let index = 0; index < value; index += 1) {
    const crystal = new THREE.Mesh(
      crystalGeometry,
      index % 2 === 0 ? primaryMaterial : secondaryMaterial,
    );
    const angle = (index / value) * Math.PI * 2;
    const radius = index === 0 ? 0 : 0.28 + Math.random() * 0.24;
    crystal.position.set(Math.cos(angle) * radius, 0.72 + index * 0.05, Math.sin(angle) * radius);
    crystal.scale.set(
      0.55 + Math.random() * 0.2,
      kind === "diamond" ? 0.9 + Math.random() * 0.45 : 1.15 + Math.random() * 0.8,
      0.55,
    );
    crystal.rotation.set(Math.random() * 0.45, angle, Math.random() * 0.45);
    crystal.userData.baseY = crystal.position.y;
    crystal.castShadow = true;
    crystal.receiveShadow = true;
    cluster.add(crystal);
  }

  const sparkle = new THREE.PointLight(glowColor, kind === "diamond" ? 0.9 : 0.75, 5);
  sparkle.position.set(0, 1.5, 0);
  cluster.add(sparkle);

  return cluster;
}

function findOpenSpawnPoint() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const x = Math.round(-WORLD_EDGE_START + Math.random() * WORLD_EDGE_START * 2);
    const z = Math.round(-WORLD_EDGE_START + Math.random() * WORLD_EDGE_START * 2);
    const tooCloseToPlayer =
      g.avatar && distance2D(g.avatar.position, { x, z }) < 5.5;
    const tooCloseToCluster = g.collectibleClusters.some(
      (cluster) => distance2D(cluster.position, { x, z }) < 5,
    );
    const tooCloseToStore = distance2D({ x, z }, storePosition) < 7;
    const tooCloseToLab = distance2D({ x, z }, labPosition) < 8;

    if (!tooCloseToPlayer && !tooCloseToCluster && !tooCloseToStore && !tooCloseToLab) {
      return { x, z };
    }
  }

  return { x: -WORLD_EDGE_START * 0.7 + Math.random() * WORLD_EDGE_START * 1.4, z: -WORLD_EDGE_START * 0.7 + Math.random() * WORLD_EDGE_START * 1.4 };
}

function updateCollectibleClusters(delta) {
  g.collectibleClusters.forEach((cluster) => {
    cluster.rotation.y += delta * 0.45;
    cluster.children.forEach((child, index) => {
      if (child.isMesh && index > 0) {
        child.position.y = child.userData.baseY + Math.sin(g.clock.elapsedTime * 2 + index) * 0.035;
      }
    });
  });
}

function checkForCollectibleChallenge() {
  if (!mathPanel.hidden || !g.avatar || gameUI.shopOpen || gameUI.labOpen || gameUI.inventoryOpen) return;

  const target = findFacingCluster();
  if (target) {
    openMathPanel(target);
  }
}

function findFacingCluster() {
  const avatar = g.avatar;
  const forward = g.scratch.clusterForward.set(Math.sin(avatar.rotation.y), 0, Math.cos(avatar.rotation.y));

  return (
    g.collectibleClusters.find((cluster) => {
      if (!cluster.userData.available) return false;

      const toCluster = g.scratch.toCluster.set(
        cluster.position.x - avatar.position.x,
        0,
        cluster.position.z - avatar.position.z,
      );
      const distance = toCluster.length();

      if (distance > 3.2) return false;

      toCluster.normalize();
      return forward.dot(toCluster) > 0.25;
    }) || null
  );
}

function openMathPanel(cluster) {
  if (gameUI.pointerLocked && document.exitPointerLock) document.exitPointerLock();
  pendingCluster = cluster;
  pendingCluster.userData.available = false;
  pendingChallenge = createChallenge(cluster.userData.kind);
  mathReward.textContent = rewardText(
    pendingChallenge.kind,
    pendingChallenge.reward,
    pendingChallenge.level,
    true,
  );
  mathReward.className = `math-reward math-reward--${cluster.userData.kind}`;
  setMathFeedback("");
  mathPanel.hidden = false;
  setGameStatusText("");

  if (cluster.userData.kind === "diamond") {
    mathForm.hidden = true;
    readingForm.hidden = false;
    logicForm.hidden = true;
    currentReadingProblem = makeReadingProblem(pendingChallenge.level);
    if (!currentReadingProblem) {
      closeMathPanel({ restoreCluster: true });
      setGameStatusText("Du har svarat på alla läsfrågor just nu.", { autoClear: true });
      return;
    }
    readingPassage.textContent = currentReadingProblem.passage;
    readingQuestion.textContent = currentReadingProblem.question;
    readingChoices.innerHTML = "";
    currentReadingProblem.options.forEach((option, index) => {
      const btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.type = "button";
      btn.textContent = option;
      btn.addEventListener("click", () => submitReadingAnswer(index));
      readingChoices.appendChild(btn);
    });
    activeProblem = null;
    return;
  }

  mathForm.hidden = false;
  readingForm.hidden = true;
  logicForm.hidden = true;
  activeProblem = makeMathProblem(pendingChallenge.level);
  if (!activeProblem) {
    closeMathPanel({ restoreCluster: true });
    setGameStatusText("Du har svarat på alla mattefrågor just nu.", { autoClear: true });
    return;
  }
  mathQuestion.textContent = activeProblem.prompt || "Räkna ut:";
  mathVisual.innerHTML = renderColumnVisual(activeProblem);
  mathAnswer.value = "";
  currentReadingProblem = null;
  currentLogicProblem = null;
  mathAnswer.focus();
}

function createChallenge(kind) {
  const skill = kind === "diamond" ? "reading" : kind === "logic" ? "logic" : "math";
  const level = learningProgress[skill].level;
  return {
    kind,
    skill,
    level,
    attempts: 0,
    reward: rewardForChallenge(kind, level),
    progressRecorded: false,
  };
}

function rewardForChallenge(kind, level) {
  if (kind === "logic") return level + 1;
  if (kind === "diamond") return level;
  return level + 1;
}

function recordLearningAnswer(skill, correct) {
  const progress = learningProgress[skill];
  progress.recent.push(Boolean(correct));
  if (progress.recent.length > 5) progress.recent.shift();
  if (progress.recent.length < 5) {
    saveGame();
    return;
  }

  const correctCount = progress.recent.filter(Boolean).length;
  const wrongCount = progress.recent.length - correctCount;
  if (correctCount >= 4) {
    progress.level = Math.min(progress.level + 1, 4);
    progress.recent = [];
  } else if (wrongCount >= 3) {
    progress.level = Math.max(progress.level - 1, 1);
    progress.recent = [];
  }
  saveGame();
}

function recordChallengeResult(correct) {
  if (!pendingChallenge || pendingChallenge.progressRecorded) return;
  pendingChallenge.progressRecorded = true;
  recordLearningAnswer(pendingChallenge.skill, correct);
}

function getAnsweredQuestions(skill) {
  const progress = learningProgress[skill];
  if (!progress) return [];
  if (!Array.isArray(progress.answered)) progress.answered = [];
  return progress.answered;
}

function markAnsweredQuestion(skill, problem) {
  if (!problem || !problem.id) return;
  const answered = getAnsweredQuestions(skill);
  if (!answered.includes(problem.id)) answered.push(problem.id);
  saveGame();
}

function pickUnansweredProblem(skill, problems) {
  const answered = getAnsweredQuestions(skill);
  const available = problems.filter((problem) => !answered.includes(problem.id));
  if (available.length === 0) return null;

  const picked = available[Math.floor(Math.random() * available.length)];
  return {
    ...picked,
    options: picked.options ? picked.options.slice() : undefined,
    items: picked.items ? picked.items.slice() : undefined,
    accepted: picked.accepted ? picked.accepted.slice() : undefined,
    rejected: picked.rejected ? picked.rejected.slice() : undefined,
  };
}

function makeMathProblems(level) {
  const problems = [];

  if (level === 1) {
    for (let left = 1; left <= 5; left += 1) {
      for (let right = 1; right < 10 - left + 1; right += 1) {
        problems.push({ id: `math-1-add-${left}-${right}`, left, right, operator: "+", answer: left + right, level });
      }
    }
    for (let left = 3; left <= 10; left += 1) {
      for (let right = 0; right < left; right += 1) {
        problems.push({ id: `math-1-sub-${left}-${right}`, left, right, operator: "-", answer: left - right, level });
      }
    }
    return problems;
  }

  if (level === 2) {
    for (let left = 4; left <= 13; left += 1) {
      for (let right = 2; right < 20 - left + 2; right += 1) {
        problems.push({ id: `math-2-add-${left}-${right}`, left, right, operator: "+", answer: left + right, level });
      }
    }
    for (let left = 10; left <= 20; left += 1) {
      const maxRight = Math.min(left, 12);
      for (let right = 1; right <= maxRight; right += 1) {
        problems.push({ id: `math-2-sub-${left}-${right}`, left, right, operator: "-", answer: left - right, level });
      }
    }
    return problems;
  }

  if (level === 3) {
    for (let target = 10; target <= 20; target += 1) {
      for (let missing = 2; missing < target - 1; missing += 1) {
        const shown = target - missing;
        problems.push({ id: `math-3-right-${target}-${missing}`, left: shown, right: "?", operator: "+", answer: missing, target, level });
        problems.push({ id: `math-3-left-${target}-${missing}`, left: "?", right: shown, operator: "+", answer: missing, target, level });
      }
    }
    return problems;
  }

  [2, 3, 4, 5, 10].forEach((groupSize) => {
    for (let groups = 2; groups <= 10; groups += 1) {
      problems.push({
        id: `math-4-groups-${groups}-${groupSize}`,
        left: groups,
        right: groupSize,
        operator: "×",
        answer: groups * groupSize,
        level,
        prompt: "Räkna grupperna:",
      });
    }
  });
  [2, 3, 4, 5, 10].forEach((groupSize) => {
    for (let groups = 2; groups <= 10; groups += 1) {
      problems.push({
        id: `math-4-missing-${groups}-${groupSize}`,
        left: "?",
        right: groupSize,
        operator: "×",
        answer: groups,
        target: groups * groupSize,
        level,
        prompt: "Vilket tal saknas?",
      });
    }
  });
  return problems;
}

function makeMathProblem(level) {
  return pickUnansweredProblem("math", makeMathProblems(level));
}

function makeReadingProblem(level) {
  if (level === 1) {
    const simpleQuestions = [
      {
        id: "reading-1-mira-hatt",
        passage: "Mira har en gul hatt. Hon går till parken.",
        question: "Vad har Mira?",
        options: ["En gul hatt", "En blå bil", "En röd bok"],
        answer: 0,
      },
      {
        id: "reading-1-leo-fiskar",
        passage: "Leo ser tre fiskar i dammen. Fiskarna simmar snabbt.",
        question: "Hur många fiskar ser Leo?",
        options: ["Två", "Tre", "Fem"],
        answer: 1,
      },
      {
        id: "reading-1-nora-vaska",
        passage: "Nora packar en macka och ett äpple i sin väska.",
        question: "Vad packar Nora?",
        options: ["En macka och ett äpple", "En boll och en sko", "En sten och en pinne"],
        answer: 0,
      },
      {
        id: "reading-1-ida-boll",
        passage: "Ida sparkar en röd boll på gården. Bollen rullar till bänken.",
        question: "Vilken färg har bollen?",
        options: ["Röd", "Grön", "Svart"],
        answer: 0,
      },
      {
        id: "reading-1-max-bok",
        passage: "Max läser en bok om rymden. Han sitter i soffan.",
        question: "Vad läser Max om?",
        options: ["Rymden", "Havet", "Skogen"],
        answer: 0,
      },
      {
        id: "reading-1-alva-kaka",
        passage: "Alva bakar en kaka med sin farmor. Kakan luktar gott.",
        question: "Vad bakar Alva?",
        options: ["En kaka", "En soppa", "En pizza"],
        answer: 0,
      },
      {
        id: "reading-1-tage-cykel",
        passage: "Tage cyklar till skolan. Han har en blå hjälm.",
        question: "Vad har Tage på huvudet?",
        options: ["En blå hjälm", "En gul krona", "En röd keps"],
        answer: 0,
      },
      {
        id: "reading-1-liv-hund",
        passage: "Liv går ut med sin hund. Hunden heter Bosse.",
        question: "Vad heter hunden?",
        options: ["Bosse", "Milo", "Sally"],
        answer: 0,
      },
      {
        id: "reading-1-noel-sten",
        passage: "Noel hittar en blank sten vid sjön. Han lägger stenen i fickan.",
        question: "Var hittar Noel stenen?",
        options: ["Vid sjön", "I köket", "På taket"],
        answer: 0,
      },
      {
        id: "reading-1-ella-lampa",
        passage: "Ella tänder lampan i rummet. Nu kan hon se sina pennor.",
        question: "Vad tänder Ella?",
        options: ["Lampan", "Spisen", "Radion"],
        answer: 0,
      },
      {
        id: "reading-1-axel-batar",
        passage: "Axel ser två båtar på vattnet. Den ena båten är vit.",
        question: "Hur många båtar ser Axel?",
        options: ["Två", "Fyra", "Sex"],
        answer: 0,
      },
      {
        id: "reading-1-saga-morot",
        passage: "Saga ger en morot till kaninen. Kaninen tuggar snabbt.",
        question: "Vad får kaninen?",
        options: ["En morot", "Ett päron", "En pinne"],
        answer: 0,
      },
      {
        id: "reading-1-milo-sand",
        passage: "Milo bygger ett torn av sand. Tornet står nära hinken.",
        question: "Vad bygger Milo?",
        options: ["Ett torn", "En bro", "Ett hus av trä"],
        answer: 0,
      },
      {
        id: "reading-1-freja-snosre",
        passage: "Freja knyter sitt skosnöre innan hon springer.",
        question: "Vad knyter Freja?",
        options: ["Sitt skosnöre", "Sin halsduk", "Sin väska"],
        answer: 0,
      },
      {
        id: "reading-1-oliver-sang",
        passage: "Oliver sjunger en sång för sin lillebror. Lillebror ler.",
        question: "Vad gör Oliver?",
        options: ["Sjunger en sång", "Målar en dörr", "Sover i soffan"],
        answer: 0,
      },
    ];
    return pickUnansweredProblem("reading", simpleQuestions);
  }

  if (level === 3) {
    const sequenceQuestions = [
      {
        id: "reading-3-sam-karta",
        passage: "Först hittade Sam en karta vid trädet. Sedan följde han stigen till sjön. Till slut såg han en blå kristall bakom en sten.",
        question: "Vad gjorde Sam efter att han hittade kartan?",
        options: ["Han följde stigen till sjön", "Han köpte en hatt", "Han gick hem direkt"],
        answer: 0,
      },
      {
        id: "reading-3-elin-regnjacka",
        passage: "Elin hörde åskan mullra. Därför tog hon på sig regnjackan innan hon gick ut. När regnet kom var hon torr.",
        question: "Varför tog Elin på sig regnjackan?",
        options: ["För att hon hörde åskan", "För att hon skulle sova", "För att hon tappade nyckeln"],
        answer: 0,
      },
      {
        id: "reading-3-amir-kristall",
        passage: "Vid ruinen låg tre stenar i rad. Den första var liten, den andra var större och den tredje var störst. Amir lade en kristall på den största stenen.",
        question: "Var lade Amir kristallen?",
        options: ["På den största stenen", "I ryggsäcken", "Under bron"],
        answer: 0,
      },
      {
        id: "reading-3-mina-bro",
        passage: "Mina såg att bron var trasig. Hon gick runt sjön och hittade en liten spång. Sedan kunde hon fortsätta till tornet.",
        question: "Vad gjorde Mina efter att hon såg den trasiga bron?",
        options: ["Hon gick runt sjön", "Hon simmade över", "Hon klättrade i tornet"],
        answer: 0,
      },
      {
        id: "reading-3-viggo-fron",
        passage: "Viggo lade tre frön i jorden. Han täckte dem med jord och vattnade försiktigt. Efter några dagar kom små gröna blad upp.",
        question: "Vad gjorde Viggo direkt efter att han lade fröna i jorden?",
        options: ["Han täckte dem med jord", "Han plockade bladen", "Han målade krukan"],
        answer: 0,
      },
      {
        id: "reading-3-ebba-lykta",
        passage: "Ebba tände sin lykta när grottan blev mörk. Hon såg fotspår i sanden och följde dem till en dörr.",
        question: "Varför tände Ebba lyktan?",
        options: ["För att grottan blev mörk", "För att dörren var öppen", "För att sanden var varm"],
        answer: 0,
      },
      {
        id: "reading-3-jon-ryggsack",
        passage: "Jon packade vatten, karta och kompass. När stigen delade sig tog han fram kartan och valde vägen mot berget.",
        question: "Vad använde Jon när stigen delade sig?",
        options: ["Kartan", "Vattnet", "En blomma"],
        answer: 0,
      },
      {
        id: "reading-3-siri-brev",
        passage: "Siri hittade ett brev under mattan. På brevet stod det: 'Gå till brunnen.' Siri sprang till brunnen och hittade en ny ledtråd.",
        question: "Vart gick Siri efter att hon läste brevet?",
        options: ["Till brunnen", "Till köket", "Till stranden"],
        answer: 0,
      },
      {
        id: "reading-3-oskar-klocka",
        passage: "Oskar skulle möta sin vän klockan tre. När klockan blev halv tre tog han på sig jackan och gick mot torget.",
        question: "Varför gick Oskar mot torget?",
        options: ["För att möta sin vän", "För att köpa glass", "För att leta efter jackan"],
        answer: 0,
      },
      {
        id: "reading-3-maja-stegen",
        passage: "Maja såg ett äpple högt upp i trädet. Hon hämtade en stege, klättrade upp och plockade äpplet.",
        question: "Vad gjorde Maja innan hon klättrade upp?",
        options: ["Hon hämtade en stege", "Hon åt äpplet", "Hon målade trädet"],
        answer: 0,
      },
      {
        id: "reading-3-hugo-spar",
        passage: "Hugo följde små spår i snön. Spåren gick förbi staketet och slutade vid en sovande katt.",
        question: "Var slutade spåren?",
        options: ["Vid en sovande katt", "Vid en cykel", "Vid en brasa"],
        answer: 0,
      },
      {
        id: "reading-3-tuva-marknad",
        passage: "Tuva hade fem mynt. Hon köpte ett päron för två mynt och en bulle för ett mynt. Sedan hade hon två mynt kvar.",
        question: "Vad köpte Tuva först?",
        options: ["Ett päron", "En bulle", "En mössa"],
        answer: 0,
      },
      {
        id: "reading-3-nils-fackla",
        passage: "Nils bar en fackla genom tunneln. När vinden blåste ut lågan stannade han och tände den igen med en tändsticka.",
        question: "Vad gjorde Nils när lågan slocknade?",
        options: ["Han tände den igen", "Han kastade facklan", "Han sprang hem"],
        answer: 0,
      },
      {
        id: "reading-3-ruth-damm",
        passage: "Ruth såg att dammen var nästan tom. Hon öppnade kranen vid bäcken och väntade tills vattnet steg.",
        question: "Vad hände efter att Ruth öppnade kranen?",
        options: ["Vattnet steg", "Dammen frös", "Bäcken försvann"],
        answer: 0,
      },
      {
        id: "reading-3-adam-stjarna",
        passage: "Adam ritade en karta med tre märken: en måne, en stjärna och en sol. Skatten låg vid märket som såg ut som en stjärna.",
        question: "Vilket märke visade var skatten låg?",
        options: ["Stjärnan", "Månen", "Solen"],
        answer: 0,
      },
    ];
    return pickUnansweredProblem("reading", sequenceQuestions);
  }

  if (level === 4) {
    const inferenceQuestions = [
      {
        id: "reading-4-lina-regn",
        passage: "Lina såg mörka moln över skogen. Hon lade ner sin bok i väskan och sprang mot vindskyddet. Strax efter började droppar slå mot taket.",
        question: "Vad förstod Lina troligen?",
        options: ["Att det skulle börja regna", "Att solen skulle bli starkare", "Att väskan var tom"],
        answer: 0,
      },
      {
        id: "reading-4-omar-vattna",
        passage: "Omar hittade en skylt där det stod: 'Här växer inga blommor utan vatten.' Marken var torr och blommorna hängde. Omar fyllde sin kanna vid dammen.",
        question: "Vad tänkte Omar göra?",
        options: ["Vattna blommorna", "Måla skylten", "Räkna stenar"],
        answer: 0,
      },
      {
        id: "reading-4-sara-nyckel",
        passage: "En liten nyckel låg bredvid den låsta kistan. På kistan fanns samma stjärna som på nyckeln. Sara log och plockade upp nyckeln.",
        question: "Varför log Sara?",
        options: ["Hon trodde att nyckeln passade", "Hon ville kasta nyckeln", "Hon hittade sin mössa"],
        answer: 0,
      },
      {
        id: "reading-4-teo-fonster",
        passage: "Teo såg att fönstret stod öppet och att pappren låg utspridda över golvet. Han stängde fönstret innan han samlade ihop pappren.",
        question: "Vad trodde Teo troligen hade hänt?",
        options: ["Vinden hade blåst in", "Någon hade målat pappren", "Golvet hade blivit varmt"],
        answer: 0,
      },
      {
        id: "reading-4-hanna-skor",
        passage: "Hannas skor var leriga när hon kom in. Ute på gården fanns stora vattenpölar efter nattens oväder.",
        question: "Varför var Hannas skor leriga?",
        options: ["Hon hade gått ute efter regnet", "Hon hade bakat bröd", "Hon hade suttit i soffan"],
        answer: 0,
      },
      {
        id: "reading-4-ali-ljud",
        passage: "Ali hörde ett svagt pip från skåpet. När han öppnade dörren låg hans lilla robot där med blinkande batterilampa.",
        question: "Varför pep det från skåpet?",
        options: ["Robotens batteri var svagt", "Skåpet sjöng", "Dörren var målad"],
        answer: 0,
      },
      {
        id: "reading-4-nova-kaka",
        passage: "Nova lade kakorna högt upp på hyllan. När hon kom tillbaka stod en stol bredvid hyllan och burken var tom.",
        question: "Vad kan Nova ana?",
        options: ["Någon använde stolen för att nå kakorna", "Kakorna blev till stenar", "Hyllan blev högre"],
        answer: 0,
      },
      {
        id: "reading-4-melker-kompass",
        passage: "Melker såg att kompassen pekade åt norr. Han vände kartan så att norr på kartan låg åt samma håll och började gå.",
        question: "Varför vände Melker kartan?",
        options: ["För att lättare hitta rätt riktning", "För att kartan var blöt", "För att kompassen var tung"],
        answer: 0,
      },
      {
        id: "reading-4-signe-lampa",
        passage: "Signe tryckte på lampknappen men inget hände. Hon såg att sladden inte satt i väggen och kröp ner bakom bordet.",
        question: "Vad tänkte Signe troligen göra?",
        options: ["Sätta i sladden", "Rita på bordet", "Byta skor"],
        answer: 0,
      },
      {
        id: "reading-4-loke-fisk",
        passage: "Loke såg ringar på vattenytan och små bubblor nära bryggan. Han tog fram sitt metspö och satte sig tyst.",
        question: "Vad trodde Loke troligen?",
        options: ["Att det fanns fisk nära bryggan", "Att bryggan skulle flyga", "Att vattnet var tomt"],
        answer: 0,
      },
      {
        id: "reading-4-juni-halsduk",
        passage: "Juni såg frost på gräset när hon öppnade dörren. Hon gick tillbaka in och hämtade sin tjocka halsduk.",
        question: "Varför hämtade Juni halsduken?",
        options: ["Det verkade kallt ute", "Hon skulle bada", "Hon ville putsa fönstret"],
        answer: 0,
      },
      {
        id: "reading-4-vidar-bibliotek",
        passage: "Vidar viskade när han frågade efter en bok. Runt honom satt andra barn och läste tyst vid små bord.",
        question: "Var var Vidar troligen?",
        options: ["På ett bibliotek", "På en fotbollsplan", "I en simhall"],
        answer: 0,
      },
      {
        id: "reading-4-meja-snigel",
        passage: "Efter regnet såg Meja små blanka spår på stenen. Vid slutet av ett spår satt en snigel under ett blad.",
        question: "Vad hade troligen gjort de blanka spåren?",
        options: ["Snigeln", "En penna", "En cykel"],
        answer: 0,
      },
      {
        id: "reading-4-aron-karta",
        passage: "Aron gick först åt fel håll och kom till en återvändsgränd. Han studerade kartan igen, vände om och hittade porten.",
        question: "Vad hjälpte Aron att hitta porten?",
        options: ["Att han tittade på kartan igen", "Att han stängde ögonen", "Att han tappade kartan"],
        answer: 0,
      },
      {
        id: "reading-4-iris-mynt",
        passage: "Iris lade ett mynt i automaten och tryckte på knappen. Maskinen surrade och en biljett gled ut.",
        question: "Vad köpte Iris troligen?",
        options: ["En biljett", "En blomma", "En kudde"],
        answer: 0,
      },
    ];
    return pickUnansweredProblem("reading", inferenceQuestions);
  }

  const pool = readingQuestions.filter((problem) => (problem.level || 2) === level);
  const source = (pool.length > 0 ? pool : readingQuestions).map((problem, index) => ({
    id: `reading-${level}-${index}-${problem.question}`,
    ...problem,
  }));
  return pickUnansweredProblem("reading", source);
}

function openLogicLab() {
  closeLabBench({ restorePointer: false });
  if (gameUI.pointerLocked && document.exitPointerLock) document.exitPointerLock();
  pendingCluster = null;
  pendingChallenge = createChallenge("logic");
  currentLogicProblem = makeLogicProblem(pendingChallenge.level);
  if (!currentLogicProblem) {
    pendingChallenge = null;
    setGameStatusText("Pixel: Du har löst alla logikproblem just nu.", { autoClear: true });
    return;
  }
  activeProblem = null;
  currentReadingProblem = null;
  mathReward.textContent = rewardText("logic", pendingChallenge.reward, pendingChallenge.level, true);
  mathReward.className = "math-reward math-reward--logic";
  setMathFeedback("");
  mathForm.hidden = true;
  readingForm.hidden = true;
  logicForm.hidden = false;
  logicTitle.textContent = currentLogicProblem.title;
  logicPromptText.textContent = currentLogicProblem.prompt;
  renderLogicProblem(currentLogicProblem);
  mathPanel.hidden = false;
  labPrompt.hidden = true;
  setGameStatusText("");
}

function makeLogicProblem(level) {
  return pickUnansweredProblem("logic", makeLogicProblems(level));
}

function makeLogicProblems(level) {
  return makePatternProblems(level).concat(makeSortingProblems(level), makeRuleProblems(level));
}

function makePatternProblems(level) {
  if (level === 1) {
    const patternSets = [
      { sequence: ["blå cirkel", "röd triangel", "blå cirkel", "röd triangel"], answer: "blå cirkel", options: ["blå cirkel", "röd triangel", "gul stjärna"] },
      { sequence: ["gul stjärna", "gul stjärna", "grön fyrkant", "gul stjärna", "gul stjärna"], answer: "grön fyrkant", options: ["grön fyrkant", "gul stjärna", "blå cirkel"] },
      { sequence: ["måne", "sol", "måne", "sol"], answer: "måne", options: ["måne", "sol", "moln"] },
      { sequence: ["röd", "röd", "blå", "röd", "röd"], answer: "blå", options: ["blå", "röd", "gul"] },
      { sequence: ["1", "2", "1", "2"], answer: "1", options: ["1", "2", "3"] },
      { sequence: ["liten", "stor", "liten", "stor"], answer: "liten", options: ["liten", "stor", "mellan"] },
      { sequence: ["triangel", "triangel", "cirkel", "triangel", "triangel"], answer: "cirkel", options: ["cirkel", "triangel", "fyrkant"] },
      { sequence: ["A", "B", "A", "B"], answer: "A", options: ["A", "B", "C"] },
      { sequence: ["hög", "låg", "hög", "låg"], answer: "hög", options: ["hög", "låg", "tyst"] },
      { sequence: ["äpple", "päron", "äpple", "päron"], answer: "äpple", options: ["äpple", "päron", "banan"] },
    ];
    return patternSets.map((picked, index) => ({
      id: `logic-1-pattern-${index}`,
      title: "Mönstermaskinen",
      prompt: "Maskinen har tappat nästa symbol. Vad kommer sedan?",
      kind: "pattern",
      items: picked.sequence,
      answer: picked.answer,
      options: picked.options,
    }));
  }

  if (level === 2) {
    const patternSets = [
      { sequence: ["1", "3", "5", "7"], answer: "9", options: ["8", "9", "10"] },
      { sequence: ["A", "B", "B", "A", "B", "B"], answer: "A", options: ["A", "B", "C"] },
      { sequence: ["2", "4", "6", "8"], answer: "10", options: ["9", "10", "12"] },
      { sequence: ["röd", "blå", "grön", "röd", "blå"], answer: "grön", options: ["grön", "röd", "gul"] },
      { sequence: ["cirkel", "fyrkant", "fyrkant", "cirkel", "fyrkant"], answer: "fyrkant", options: ["cirkel", "fyrkant", "triangel"] },
      { sequence: ["10", "9", "8", "7"], answer: "6", options: ["5", "6", "8"] },
      { sequence: ["A", "C", "E", "G"], answer: "I", options: ["H", "I", "J"] },
      { sequence: ["sol", "sol", "måne", "sol", "sol"], answer: "måne", options: ["måne", "sol", "stjärna"] },
      { sequence: ["3", "6", "9", "12"], answer: "15", options: ["14", "15", "18"] },
      { sequence: ["liten", "mellan", "stor", "liten", "mellan"], answer: "stor", options: ["stor", "liten", "hög"] },
    ];
    return patternSets.map((picked, index) => ({
      id: `logic-2-pattern-${index}`,
      title: "Mönstermaskinen",
      prompt: "Hitta regeln och välj nästa ruta.",
      kind: "pattern",
      items: picked.sequence,
      answer: picked.answer,
      options: picked.options,
    }));
  }

  const patternSets = level === 3 ? [
    { sequence: ["röd cirkel", "blå triangel", "gul fyrkant", "röd cirkel", "blå triangel"], answer: "gul fyrkant", options: ["gul fyrkant", "röd triangel", "blå cirkel"] },
    { sequence: ["2", "4", "8", "16"], answer: "32", options: ["20", "24", "32"] },
    { sequence: ["1", "4", "7", "10"], answer: "13", options: ["12", "13", "14"] },
    { sequence: ["A", "B", "D", "E", "G"], answer: "H", options: ["H", "I", "J"] },
    { sequence: ["grön liten", "grön stor", "blå liten", "blå stor", "grön liten"], answer: "grön stor", options: ["grön stor", "blå liten", "röd stor"] },
    { sequence: ["5", "10", "20", "40"], answer: "80", options: ["60", "80", "100"] },
    { sequence: ["sol", "måne", "stjärna", "sol", "måne"], answer: "stjärna", options: ["stjärna", "sol", "moln"] },
    { sequence: ["triangel", "cirkel", "cirkel", "fyrkant", "triangel", "cirkel", "cirkel"], answer: "fyrkant", options: ["fyrkant", "triangel", "cirkel"] },
  ] : [
    { sequence: ["3", "6", "12", "24"], answer: "48", options: ["36", "42", "48"] },
    { sequence: ["1", "1", "2", "3", "5"], answer: "8", options: ["6", "8", "10"] },
    { sequence: ["A1", "B2", "C3", "D4"], answer: "E5", options: ["E5", "E4", "F5"] },
    { sequence: ["röd liten", "röd stor", "blå liten", "blå stor", "gul liten"], answer: "gul stor", options: ["gul stor", "röd liten", "blå liten"] },
    { sequence: ["20", "17", "14", "11"], answer: "8", options: ["7", "8", "9"] },
    { sequence: ["2", "3", "5", "8", "12"], answer: "17", options: ["16", "17", "20"] },
    { sequence: ["cirkel 1", "triangel 2", "fyrkant 3", "cirkel 4"], answer: "triangel 5", options: ["triangel 5", "fyrkant 5", "cirkel 5"] },
    { sequence: ["kall", "varm", "varmare", "kall", "varm"], answer: "varmare", options: ["varmare", "kallare", "ljusare"] },
  ];
  return patternSets.map((picked, index) => ({
    id: `logic-${level}-pattern-${index}`,
    title: "Mönstermaskinen",
    prompt: "Regeln är lite lurigare nu. Vilken ruta fortsätter mönstret?",
    kind: "pattern",
    items: picked.sequence,
    answer: picked.answer,
    options: picked.options,
  }));
}

function makeSortingProblems(level) {
  if (level === 1) {
    const sortSets = [
      { id: "number", prompt: "Maskinen sorterar från minst till störst. Vilket tal ligger fel?", items: ["2", "4", "7", "6", "9"], answer: "6", options: ["4", "6", "9"] },
      { id: "color", prompt: "Färgerna ska växla röd, blå. Vilken ruta ligger fel?", items: ["röd", "blå", "röd", "röd", "blå"], answer: "andra röd", options: ["första röd", "andra röd", "blå"] },
      { id: "size", prompt: "Orden ska gå liten, mellan, stor. Vilket ord ligger fel?", items: ["liten", "mellan", "stor", "mellan"], answer: "mellan", options: ["liten", "stor", "mellan"] },
      { id: "days", prompt: "Dagarna ska komma i rätt ordning. Vilken dag ligger fel?", items: ["måndag", "tisdag", "torsdag", "onsdag"], answer: "torsdag", options: ["tisdag", "torsdag", "onsdag"] },
    ];
    return sortSets.map((picked) => ({
      id: `logic-1-sort-${picked.id}`,
      title: "Sorteringsröret",
      prompt: picked.prompt,
      kind: "sort",
      items: picked.items,
      answer: picked.answer,
      options: picked.options,
    }));
  }

  if (level === 2) {
    const sortSets = [
      { id: "words", prompt: "Orden ska ligga i alfabetisk ordning. Vilket ord ligger fel?", items: ["apa", "bil", "dator", "citron", "eka"], answer: "citron", options: ["bil", "dator", "citron"] },
      { id: "tens", prompt: "Talen ska öka med tio. Vilket tal stör ordningen?", items: ["10", "20", "30", "50", "40"], answer: "50", options: ["30", "50", "40"] },
      { id: "length", prompt: "Orden ska bli längre och längre. Vilket ord ligger fel?", items: ["ko", "sol", "stol", "bok", "karta"], answer: "bok", options: ["sol", "bok", "karta"] },
      { id: "months", prompt: "Månaderna ska komma i ordning. Vilken månad ligger fel?", items: ["mars", "april", "juni", "maj"], answer: "juni", options: ["april", "juni", "maj"] },
    ];
    return sortSets.map((picked) => ({
      id: `logic-2-sort-${picked.id}`,
      title: "Sorteringsröret",
      prompt: picked.prompt,
      kind: "sort",
      items: picked.items,
      answer: picked.answer,
      options: picked.options,
    }));
  }

  const sortSets = level === 3 ? [
    { id: "step", prompt: "Talen ska öka med 3 varje steg. Vilket tal stör regeln?", items: ["3", "6", "12", "9", "15"], answer: "12", options: ["6", "12", "9"] },
    { id: "double", prompt: "Talen ska dubbleras. Vilket tal ligger fel?", items: ["2", "4", "8", "12", "16"], answer: "12", options: ["8", "12", "16"] },
    { id: "alphabet", prompt: "Bokstäverna hoppar över en bokstav varje gång. Vilken ligger fel?", items: ["A", "C", "E", "H", "I"], answer: "H", options: ["E", "H", "I"] },
    { id: "shape-color", prompt: "Formerna ska först sorteras efter färg, sedan form. Vilken bryter ordningen?", items: ["blå cirkel", "blå fyrkant", "grön cirkel", "röd cirkel", "grön fyrkant"], answer: "röd cirkel", options: ["grön cirkel", "röd cirkel", "grön fyrkant"] },
  ] : [
    { id: "shape", prompt: "Maskinen sorterar först färg, sedan storlek. Vilken ruta bryter ordningen?", items: ["röd liten", "röd stor", "blå liten", "blå stor", "grön liten"], answer: "grön liten", options: ["röd stor", "blå stor", "grön liten"] },
    { id: "minus-four", prompt: "Talen ska minska med 4. Vilket tal ligger fel?", items: ["28", "24", "20", "18", "12"], answer: "18", options: ["20", "18", "12"] },
    { id: "vowels", prompt: "Orden ska sorteras efter antal vokaler. Vilket ord stör regeln?", items: ["bil", "kaka", "banan", "sol", "melodi"], answer: "sol", options: ["kaka", "sol", "melodi"] },
    { id: "mixed-code", prompt: "Koderna ska öka med en bokstav och ett tal. Vilken kod ligger fel?", items: ["A1", "B2", "C3", "E4", "D5"], answer: "E4", options: ["C3", "E4", "D5"] },
  ];
  return sortSets.map((picked) => ({
    id: `logic-${level}-sort-${picked.id}`,
    title: "Sorteringsröret",
    prompt: picked.prompt,
    kind: "sort",
    items: picked.items,
    answer: picked.answer,
    options: picked.options,
  }));
}

function makeRuleProblems(level) {
  if (level === 1) {
    const ruleSets = [
      { id: "even", prompt: "Maskinen gillar 2, 4 och 8. Den gillar inte 3, 5 och 7. Vilken regel använder den?", accepted: ["2", "4", "8"], rejected: ["3", "5", "7"], answer: "Jämna tal", options: ["Jämna tal", "Tal större än 5", "Tal med två siffror"] },
      { id: "red", prompt: "Maskinen gillar röd boll, röd bil och röd hatt. Den gillar inte blå boll eller gul hatt.", accepted: ["röd boll", "röd bil", "röd hatt"], rejected: ["blå boll", "gul hatt"], answer: "Röda saker", options: ["Röda saker", "Runda saker", "Saker med hjul"] },
      { id: "animals", prompt: "Maskinen gillar katt, hund och häst. Den gillar inte stol, sten och sko.", accepted: ["katt", "hund", "häst"], rejected: ["stol", "sten", "sko"], answer: "Djur", options: ["Djur", "Möbler", "Saker av sten"] },
      { id: "small", prompt: "Maskinen gillar liten boll och liten bok. Den gillar inte stor boll eller stor bok.", accepted: ["liten boll", "liten bok"], rejected: ["stor boll", "stor bok"], answer: "Små saker", options: ["Små saker", "Alla böcker", "Alla bollar"] },
    ];
    return ruleSets.map((picked) => ({
      id: `logic-1-rule-${picked.id}`,
      title: "Regeldetektiven",
      prompt: picked.prompt,
      kind: "rule",
      accepted: picked.accepted,
      rejected: picked.rejected,
      answer: picked.answer,
      options: picked.options,
    }));
  }

  if (level === 2) {
    const ruleSets = [
      { id: "three-letters", prompt: "Maskinen gillar orden sol, ros och vas. Den gillar inte sten, blomma och karta.", accepted: ["sol", "ros", "vas"], rejected: ["sten", "blomma", "karta"], answer: "Tre bokstäver", options: ["Tre bokstäver", "Börjar på s", "Saker i rymden"] },
      { id: "ends-a", prompt: "Maskinen gillar apa, kaka och stjärna. Den gillar inte sol, hus och träd.", accepted: ["apa", "kaka", "stjärna"], rejected: ["sol", "hus", "träd"], answer: "Slutar på a", options: ["Slutar på a", "Börjar på s", "Är djur"] },
      { id: "greater-five", prompt: "Maskinen gillar 6, 9 och 12. Den gillar inte 1, 3 och 5.", accepted: ["6", "9", "12"], rejected: ["1", "3", "5"], answer: "Större än 5", options: ["Större än 5", "Mindre än 5", "Jämna tal"] },
      { id: "round", prompt: "Maskinen gillar boll, hjul och apelsin. Den gillar inte bok, dörr och penna.", accepted: ["boll", "hjul", "apelsin"], rejected: ["bok", "dörr", "penna"], answer: "Runda saker", options: ["Runda saker", "Saker att läsa", "Saker av trä"] },
    ];
    return ruleSets.map((picked) => ({
      id: `logic-2-rule-${picked.id}`,
      title: "Regeldetektiven",
      prompt: picked.prompt,
      kind: "rule",
      accepted: picked.accepted,
      rejected: picked.rejected,
      answer: picked.answer,
      options: picked.options,
    }));
  }

  const ruleSets = level === 3 ? [
    { id: "blue", prompt: "Maskinen gillar blå cirklar och blå fyrkanter, men inte röda cirklar.", accepted: ["blå cirkel", "blå fyrkant"], rejected: ["röd cirkel", "gul fyrkant"], answer: "Blå former", options: ["Blå former", "Bara cirklar", "Gula former"] },
    { id: "multiples-four", prompt: "Maskinen gillar 4, 8 och 16. Den gillar inte 6, 10 och 14.", accepted: ["4", "8", "16"], rejected: ["6", "10", "14"], answer: "Delbart med 4", options: ["Delbart med 4", "Udda tal", "Mindre än 10"] },
    { id: "starts-s", prompt: "Maskinen gillar sol, sten och saga. Den gillar inte måne, blomma och karta.", accepted: ["sol", "sten", "saga"], rejected: ["måne", "blomma", "karta"], answer: "Börjar på s", options: ["Börjar på s", "Slutar på a", "Har fyra bokstäver"] },
    { id: "two-attributes", prompt: "Maskinen gillar små blå saker. Den gillar inte stora blå saker eller små röda saker.", accepted: ["liten blå boll", "liten blå bok"], rejected: ["stor blå boll", "liten röd bok"], answer: "Små blå saker", options: ["Små blå saker", "Alla blå saker", "Alla små saker"] },
  ] : [
    { id: "small-red-corners", prompt: "Maskinen gillar små röda former med hörn, men inte stora röda former eller små blå former.", accepted: ["liten röd triangel", "liten röd fyrkant"], rejected: ["stor röd triangel", "liten blå fyrkant"], answer: "Små röda former med hörn", options: ["Små röda former med hörn", "Alla röda former", "Alla små former"] },
    { id: "prime-small", prompt: "Maskinen gillar 2, 3, 5 och 7. Den gillar inte 1, 4, 6 och 8.", accepted: ["2", "3", "5", "7"], rejected: ["1", "4", "6", "8"], answer: "Primtal under 10", options: ["Primtal under 10", "Jämna tal", "Tal större än 5"] },
    { id: "double-letter", prompt: "Maskinen gillar orden glass, boll och kaffe. Den gillar inte sol, karta och bok.", accepted: ["glass", "boll", "kaffe"], rejected: ["sol", "karta", "bok"], answer: "Har dubbel bokstav", options: ["Har dubbel bokstav", "Slutar på a", "Är mat"] },
    { id: "not-red-round", prompt: "Maskinen gillar blå cirklar och gröna cirklar. Den gillar inte röda cirklar eller blå fyrkanter.", accepted: ["blå cirkel", "grön cirkel"], rejected: ["röd cirkel", "blå fyrkant"], answer: "Cirklar som inte är röda", options: ["Cirklar som inte är röda", "Alla blå former", "Alla cirklar"] },
  ];
  return ruleSets.map((picked) => ({
    id: `logic-${level}-rule-${picked.id}`,
    title: "Regeldetektiven",
    prompt: picked.prompt,
    kind: "rule",
    accepted: picked.accepted,
    rejected: picked.rejected,
    answer: picked.answer,
    options: picked.options,
  }));
}

function renderLogicProblem(problem) {
  logicMachine.innerHTML = "";
  logicChoices.innerHTML = "";

  if (problem.kind === "rule") {
    appendRuleColumn("Maskinen gillar", problem.accepted, "logic-good");
    appendRuleColumn("Maskinen säger nej", problem.rejected, "logic-bad");
  } else {
    const track = document.createElement("div");
    track.className = `logic-track logic-track--${problem.kind}`;
    problem.items.forEach((item) => {
      track.appendChild(createLogicTile(item));
    });
    const missing = document.createElement("div");
    missing.className = "logic-tile logic-missing";
    missing.textContent = "?";
    track.appendChild(missing);
    logicMachine.appendChild(track);
  }

  problem.options.forEach((option) => {
    const btn = document.createElement("button");
    btn.className = "choice-btn logic-choice-btn";
    btn.type = "button";
    btn.textContent = option;
    btn.addEventListener("click", () => submitLogicAnswer(option));
    logicChoices.appendChild(btn);
  });
}

function appendRuleColumn(label, items, className) {
  const column = document.createElement("div");
  column.className = `logic-rule-column ${className}`;
  const title = document.createElement("div");
  title.className = "logic-rule-title";
  title.textContent = label;
  column.appendChild(title);
  items.forEach((item) => {
    column.appendChild(createLogicTile(item));
  });
  logicMachine.appendChild(column);
}

function createLogicTile(text) {
  const tile = document.createElement("div");
  tile.className = "logic-tile";
  tile.textContent = text;
  return tile;
}

function renderColumnVisual(problem) {
  if (problem.target) {
    return `<span class="math-inline">${problem.left} ${problem.operator} ${problem.right} = ${problem.target}</span>`;
  }
  return `<span class="math-inline">${problem.left} ${problem.operator} ${problem.right} = ?</span>`;
}

function submitMathAnswer(event) {
  event.preventDefault();

  if (!activeProblem || !pendingCluster || !pendingChallenge) return;

  const answer = Number.parseInt(mathAnswer.value, 10);
  pendingChallenge.attempts += 1;

  if (answer === activeProblem.answer) {
    const firstTry = pendingChallenge.attempts === 1;
    recordChallengeResult(firstTry);
    markAnsweredQuestion("math", activeProblem);
    collectGemCluster(pendingCluster);
    closeMathPanel();
    setGameStatusText(
      firstTry ? "Rätt på första försöket. Bonus!" : "Rätt. Nya kristaller dök upp någon annanstans.",
      { autoClear: true },
    );
    return;
  }

  recordChallengeResult(false);
  setMathFeedback("Nästan. Försök igen.");
  mathAnswer.select();
}

function submitReadingAnswer(chosenIndex) {
  if (!currentReadingProblem || !pendingCluster || !pendingChallenge) return;

  pendingChallenge.attempts += 1;
  if (chosenIndex === currentReadingProblem.answer) {
    const firstTry = pendingChallenge.attempts === 1;
    recordChallengeResult(firstTry);
    markAnsweredQuestion("reading", currentReadingProblem);
    collectGemCluster(pendingCluster);
    closeMathPanel();
    setGameStatusText(firstTry ? "Rätt på första försöket. Bonus!" : "Rätt!", { autoClear: true });
    return;
  }

  recordChallengeResult(false);
  setMathFeedback("Fel. Försök igen.");
}

function submitLogicAnswer(chosenOption) {
  if (!currentLogicProblem || !pendingChallenge) return;

  pendingChallenge.attempts += 1;
  if (chosenOption === currentLogicProblem.answer) {
    const firstTry = pendingChallenge.attempts === 1;
    const firstTryBonus = firstTry ? 1 : 0;
    recordChallengeResult(firstTry);
    markAnsweredQuestion("logic", currentLogicProblem);
    resources.rubies += pendingChallenge.reward + firstTryBonus;
    updateResourceCounters();
    closeMathPanel();
    setGameStatusText(firstTry ? "Pixel: Exakt. Du fick bonusrubin!" : "Pixel: Rätt. Rubinerna glöder.", {
      autoClear: true,
    });
    saveGame();
    return;
  }

  recordChallengeResult(false);
  setMathFeedback("Pixel: Nästan. Leta efter vad som ändras, sorteras eller väljs bort.");
}

function collectGemCluster(cluster) {
  const firstTryBonus = pendingChallenge && pendingChallenge.attempts === 1 ? 1 : 0;
  const value = (pendingChallenge ? pendingChallenge.reward : rewardForChallenge(cluster.userData.kind, 1)) + firstTryBonus;
  if (cluster.userData.kind === "diamond") {
    resources.diamonds += value;
  } else {
    resources.emeralds += value;
  }

  updateResourceCounters();

  const index = g.collectibleClusters.indexOf(cluster);
  if (index >= 0) {
    g.collectibleClusters.splice(index, 1);
  }
  g.scene.remove(cluster);
  spawnCollectibleCluster(cluster.userData.kind);
  saveGame();
}

function rewardText(kind, value, level, firstTryBonus) {
  if (kind === "logic") {
    const bonusText = firstTryBonus ? " (+1 bonus första försöket)" : "";
    return `Nivå ${level}: ${value} ${value === 1 ? "rubin" : "rubiner"}${bonusText}`;
  }
  const noun = kind === "diamond" ? "diamant" : "smaragd";
  const plural = kind === "diamond" ? "diamanter" : "smaragder";
  const levelText = level ? `Nivå ${level}: ` : "";
  const bonusText = firstTryBonus ? " (+1 bonus första försöket)" : "";
  return `${levelText}${value} ${value === 1 ? noun : plural}${bonusText}`;
}

function renderLabBench() {
  labItems.innerHTML = "";
  pixelPetItems.forEach((item) => {
    const owned = ownedPixelPets.has(item.id);
    const canAfford = resources.rubies >= item.rubyCost;

    const card = document.createElement("div");
    card.className = "lab-item";

    const icon = createPixelPetPreview(item.id);

    const info = document.createElement("div");
    info.className = "shop-item-info";

    const name = document.createElement("div");
    name.className = "shop-item-name";
    name.textContent = item.name;

    const desc = document.createElement("div");
    desc.className = "shop-item-desc";
    desc.textContent = item.description;

    info.appendChild(name);
    info.appendChild(desc);

    const price = document.createElement("span");
    price.className = "shop-item-price price-ruby";
    price.textContent = `${item.rubyCost} rubiner`;

    const btn = document.createElement("button");
    btn.className = "buy-btn lab-buy-btn";
    if (owned) {
      btn.textContent = "Byggd";
      btn.disabled = true;
    } else {
      btn.textContent = "Bygg";
      btn.disabled = !canAfford;
      btn.addEventListener("click", () => buyPixelPet(item.id));
    }

    card.appendChild(icon);
    card.appendChild(info);
    card.appendChild(price);
    card.appendChild(btn);
    labItems.appendChild(card);
  });
}

function createPixelPetPreview(itemId, altText = "") {
  const preview = document.createElement("span");
  preview.className = `lab-item-icon pet-preview pet-preview--${itemId}`;

  if (!altText) {
    preview.setAttribute("aria-hidden", "true");
  }

  const image = document.createElement("img");
  image.className = "pet-preview-image";
  image.alt = altText;
  image.src = `assets/pixel-pets/${itemId}.png`;
  preview.appendChild(image);

  return preview;
}

function openLabBench() {
  if (typeof resetMobileInput === "function") resetMobileInput();
  if (gameUI.labOpen) return;
  if (gameUI.pointerLocked && document.exitPointerLock) document.exitPointerLock();
  gameUI.labOpen = true;
  renderLabBench();
  labPanel.hidden = false;
  labPrompt.hidden = true;
}

function buyPixelPet(itemId) {
  const item = pixelPetItems.find((pet) => pet.id === itemId);
  if (!item || ownedPixelPets.has(itemId) || resources.rubies < item.rubyCost) return;
  resources.rubies -= item.rubyCost;
  ownedPixelPets.add(itemId);
  updateResourceCounters();
  renderLabBench();
  saveGame();
}

function equipPixelPet(itemId, shouldSave = true) {
  if (!ownedPixelPets.has(itemId)) return;
  activePixelPet = itemId;
  syncPixelPet();
  renderLabBench();
  if (shouldSave) saveGame();
}

function unequipPixelPet() {
  if (!activePixelPet) return;
  activePixelPet = null;
  syncPixelPet();
  renderInventoryItems();
  saveGame();
}

function renderShop() {
  shopItems.innerHTML = "";
  brainrotShopItems.forEach((item) => {
    const owned = ownedBrainrots.has(item.id);
    const canAfford = resources.emeralds >= item.emeraldCost && resources.diamonds >= item.diamondCost;

    const card = document.createElement("div");
    card.className = `shop-item rarity-${item.rarity || "common"}`;

    const art = createBrainrotCardArt(item);
    art.classList.add("shop-item-art");

    const info = document.createElement("div");
    info.className = "shop-item-info";

    const name = document.createElement("div");
    name.className = "shop-item-name";
    name.textContent = item.name;

    const desc = document.createElement("div");
    desc.className = "shop-item-desc";
    desc.textContent = item.description;

    const rarity = document.createElement("span");
    rarity.className = "brainrot-card-rarity shop-item-rarity";
    rarity.textContent = getBrainrotRarityLabel(item.rarity);

    info.appendChild(name);
    info.appendChild(rarity);
    info.appendChild(desc);

    const actions = document.createElement("div");
    actions.className = "shop-item-actions";

    const price = document.createElement("span");
    price.className = "shop-item-price";
    if (item.emeraldCost > 0) {
      price.appendChild(createPricePart('price-emerald', `${item.emeraldCost}★`));
    }
    if (item.diamondCost > 0) {
      if (price.childNodes.length > 0) price.appendChild(document.createTextNode(' '));
      price.appendChild(createPricePart('price-diamond', `${item.diamondCost}♦`));
    }

    const btn = document.createElement("button");
    btn.className = "buy-btn";
    if (owned) {
      btn.textContent = "Ägd";
      btn.classList.add("owned");
      btn.disabled = true;
    } else {
      btn.textContent = "Köp";
      btn.disabled = !canAfford;
      btn.addEventListener("click", () => buyBrainrot(item.id));
    }

    actions.appendChild(price);
    actions.appendChild(btn);

    card.appendChild(art);
    card.appendChild(info);
    card.appendChild(actions);
    shopItems.appendChild(card);
  });
}

function createPricePart(className, text) {
  const part = document.createElement("span");
  part.className = className;
  part.textContent = text;
  return part;
}

function buyBrainrot(itemId) {
  const item = brainrotShopItems.find((i) => i.id === itemId);
  if (!item || ownedBrainrots.has(itemId)) return;
  if (resources.emeralds < item.emeraldCost || resources.diamonds < item.diamondCost) return;

  resources.emeralds -= item.emeraldCost;
  resources.diamonds -= item.diamondCost;
  ownedBrainrots.add(itemId);
  updateResourceCounters();
  renderShop();
  saveGame();
}

function getBrainrotRarityLabel(rarity) {
  if (rarity === "mythic") return "Mytisk";
  if (rarity === "legendary") return "Legendarisk";
  if (rarity === "epic") return "Episk";
  if (rarity === "rare") return "Sällsynt";
  if (rarity === "uncommon") return "Ovanlig";
  return "Vanlig";
}

function createBrainrotCardArt(item) {
  const art = document.createElement("div");
  art.className = `brainrot-card-art brainrot-card-art-${item.id}`;

  const fallback = document.createElement("span");
  fallback.className = "brainrot-card-fallback";
  fallback.textContent = item.emoji;

  const image = document.createElement("img");
  image.className = "brainrot-card-image";
  image.alt = item.name;
  image.hidden = true;
  image.addEventListener("load", function () {
    image.hidden = false;
    fallback.hidden = true;
  });
  image.addEventListener("error", function () {
    image.remove();
  });
  image.src = `assets/brainrots/${item.id}.png`;

  art.appendChild(image);
  art.appendChild(fallback);
  return art;
}

function createPixelPetCardArt(item) {
  const art = document.createElement("div");
  art.className = `companion-card-art companion-card-art-${item.id}`;

  const preview = createPixelPetPreview(item.id, item.name);
  preview.classList.add("companion-card-preview");
  art.appendChild(preview);
  return art;
}

function createInventorySection(title, modifier) {
  const section = document.createElement("section");
  section.className = `inventory-section inventory-section-${modifier}`;

  const heading = document.createElement("div");
  heading.className = "inventory-section-title";
  heading.textContent = title;

  const grid = document.createElement("div");
  grid.className = "inventory-section-grid";

  section.appendChild(heading);
  section.appendChild(grid);
  inventoryItems.appendChild(section);
  return grid;
}

function renderInventoryItems() {
  inventoryItems.innerHTML = "";
  if (ownedBrainrots.size === 0 && ownedPixelPets.size === 0) {
    const empty = document.createElement("div");
    empty.className = "inventory-empty";
    empty.textContent = "Inga saker ännu. Handla i butiken eller bygg vid Pixelbänken!";
    inventoryItems.appendChild(empty);
    return;
  }

  if (ownedBrainrots.size > 0) {
    const brainrotGrid = createInventorySection("Brainrot-kort", "brainrots");
    brainrotShopItems
      .filter((item) => ownedBrainrots.has(item.id))
      .forEach((item) => {
        const card = document.createElement("div");
        card.className = `inventory-card brainrot-card rarity-${item.rarity || "common"}`;

        const name = document.createElement("div");
        name.className = "brainrot-card-name";
        name.textContent = item.name;

        const rarity = document.createElement("span");
        rarity.className = "brainrot-card-rarity";
        rarity.textContent = getBrainrotRarityLabel(item.rarity);

        const desc = document.createElement("p");
        desc.className = "brainrot-card-desc";
        desc.textContent = item.description;

        card.appendChild(createBrainrotCardArt(item));
        card.appendChild(name);
        card.appendChild(rarity);
        card.appendChild(desc);
        brainrotGrid.appendChild(card);
      });
  }

  if (ownedPixelPets.size > 0) {
    const companionGrid = createInventorySection("Följeslagare", "companions");
    pixelPetItems
      .filter((item) => ownedPixelPets.has(item.id))
      .forEach((item) => {
        const active = activePixelPet === item.id;
        const card = document.createElement("div");
        card.className = active ? "inventory-card companion-card companion-card-active" : "inventory-card companion-card";

        const name = document.createElement("div");
        name.className = "companion-card-name";
        name.textContent = item.name;

        const desc = document.createElement("p");
        desc.className = "companion-card-desc";
        desc.textContent = item.description;

        const button = document.createElement("button");
        button.className = "buy-btn companion-equip-btn";
        button.textContent = active ? "Ta av" : "Aktivera";
        if (active) {
          button.addEventListener("click", unequipPixelPet);
        } else {
          button.addEventListener("click", () => {
            equipPixelPet(item.id);
            renderInventoryItems();
          });
        }

        card.appendChild(createPixelPetCardArt(item));
        card.appendChild(name);
        card.appendChild(desc);
        card.appendChild(button);
        companionGrid.appendChild(card);
      });
  }
}

function openShop() {
  if (typeof resetMobileInput === "function") resetMobileInput();
  if (gameUI.shopOpen) return;
  if (gameUI.pointerLocked && document.exitPointerLock) document.exitPointerLock();
  gameUI.shopOpen = true;
  renderShop();
  shopPanel.hidden = false;
  storePrompt.hidden = true;
}

function openInventory() {
  if (typeof resetMobileInput === "function") resetMobileInput();
  if (gameUI.inventoryOpen) return;
  if (gameUI.pointerLocked && document.exitPointerLock) document.exitPointerLock();
  gameUI.inventoryOpen = true;
  renderInventoryItems();
  inventoryPanel.hidden = false;
}

mathPanel.addEventListener("submit", submitMathAnswer);
mathClose.addEventListener("click", () => closeMathPanel({ restoreCluster: true }));
shopClose.addEventListener("click", closeShop);
labClose.addEventListener("click", closeLabBench);
labStartTest.addEventListener("click", openLogicLab);
inventoryClose.addEventListener("click", closeInventory);
