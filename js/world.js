const mathReward = document.querySelector("#math-reward");
const mathQuestion = document.querySelector("#math-question");
const mathAnswer = document.querySelector("#math-answer");
const mathFeedback = document.querySelector("#math-feedback");
const mathVisual = document.querySelector("#math-visual");
const mathClose = document.querySelector("#math-close");
const mathForm = document.querySelector("#math-form");
const readingForm = document.querySelector("#reading-form");
const readingPassage = document.querySelector("#reading-passage");
const readingQuestion = document.querySelector("#reading-question");
const readingChoices = document.querySelector("#reading-choices");
const logicForm = document.querySelector("#logic-form");
const logicTitle = document.querySelector("#logic-title");
const logicPromptText = document.querySelector("#logic-prompt-text");
const logicMachine = document.querySelector("#logic-machine");
const logicChoices = document.querySelector("#logic-choices");
const shopPanel = document.querySelector("#shop-panel");
const shopClose = document.querySelector("#shop-close");
const shopItems = document.querySelector("#shop-items");
const labPanel = document.querySelector("#lab-panel");
const labClose = document.querySelector("#lab-close");
const labStartTest = document.querySelector("#lab-start-test");
const labItems = document.querySelector("#lab-items");
const inventoryPanel = document.querySelector("#inventory-panel");
const inventoryClose = document.querySelector("#inventory-close");
const inventoryItems = document.querySelector("#inventory-items");
const emeraldCounter = document.querySelector("#emerald-counter");
const diamondCounter = document.querySelector("#diamond-counter");
const rubyCounter = document.querySelector("#ruby-counter");

let g = null;

function setGameRef(gameRef) {
  g = gameRef;
}

let activeProblem = null;
let pendingCluster = null;
let currentReadingProblem = null;
let currentLogicProblem = null;
let pendingChallenge = null;

function closeMathPanel({ restoreCluster = false } = {}) {
  if (restoreCluster && pendingCluster && g) {
    pendingCluster.userData.available = true;
    const away = new THREE.Vector3(
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
  mathFeedback.textContent = "";
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
  if (!gameUI.shopOpen) return;
  gameUI.shopOpen = false;
  shopPanel.hidden = true;
  autoLockPointer();
}

function closeLabBench({ restorePointer = true } = {}) {
  if (!gameUI.labOpen) return;
  gameUI.labOpen = false;
  labPanel.hidden = true;
  if (restorePointer) autoLockPointer();
}

function closeInventory() {
  if (!gameUI.inventoryOpen) return;
  gameUI.inventoryOpen = false;
  inventoryPanel.hidden = true;
  autoLockPointer();
}

function autoLockPointer() {
  if (!g || !g.running) return;
  if (!mathPanel.hidden || gameUI.shopOpen || gameUI.labOpen || gameUI.inventoryOpen || gameUI.pointerLocked) return;
  g.renderer.domElement.requestPointerLock();
}

function updateResourceCounters() {
  emeraldCounter.querySelector(".counter-value").textContent = resources.emeralds;
  diamondCounter.querySelector(".counter-value").textContent = resources.diamonds;
  rubyCounter.querySelector(".counter-value").textContent = resources.rubies;
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

  const side = new THREE.Vector3(-Math.cos(g.avatar.rotation.y), 0, Math.sin(g.avatar.rotation.y));
  const back = new THREE.Vector3(-Math.sin(g.avatar.rotation.y), 0, -Math.cos(g.avatar.rotation.y));
  const target = g.avatar.position.clone().add(side.multiplyScalar(0.8)).add(back.multiplyScalar(0.95));
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
  addFallbackFace(group, skinMat, eyeMat);
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
  var torso = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.35, 0.66, 8), shirtMat);
  torso.position.set(0, 1.08, 0);
  torso.scale.z = 0.72;
  group.add(torso);

  var chest = box(0.44, 0.34, 0.035, shirtMat, 0, 1.16, 0.25);
  chest.rotation.x = -0.08;
  group.add(chest);
  group.add(box(0.72, 0.12, 0.28, shirtMat, 0, 1.38, 0));
  group.add(box(0.56, 0.055, 0.31, trimMat, 0, 1.39, 0.03));
  group.add(box(0.55, 0.07, 0.33, trimMat, 0, 0.76, 0.01));

  var collarLeft = box(0.18, 0.05, 0.035, trimMat, -0.08, 1.4, 0.19);
  var collarRight = box(0.18, 0.05, 0.035, trimMat, 0.08, 1.4, 0.19);
  collarLeft.rotation.z = -0.45;
  collarRight.rotation.z = 0.45;
  group.add(collarLeft);
  group.add(collarRight);

  var shorts = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.28, 0.2, 8), pantsMat);
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

  var sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.09, 0.32, 14), shirtMat);
  sleeve.position.y = -0.16;
  grp.add(sleeve);

  var cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.045, 14), trimMat);
  cuff.position.y = -0.32;
  grp.add(cuff);

  var forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.3, 14), skinMat);
  forearm.position.y = -0.48;
  forearm.rotation.z = side * 0.08;
  grp.add(forearm);

  var hand = ellipsoid(0.09, skinMat, side * 0.015, -0.66, 0.02, 0.9, 0.75, 1.05);
  grp.add(hand);
  return grp;
}

function createStylizedLeg(pantsMat, shoeMat, x, y, z) {
  var grp = new THREE.Group();
  grp.position.set(x, y, z);

  var thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.115, 0.36, 14), pantsMat);
  thigh.position.y = -0.18;
  grp.add(thigh);

  var knee = ellipsoid(0.08, pantsMat, 0, -0.38, 0.02, 0.95, 0.58, 0.9);
  grp.add(knee);

  var shin = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.095, 0.34, 14), pantsMat);
  shin.position.y = -0.55;
  grp.add(shin);

  var shoe = box(0.28, 0.13, 0.48, shoeMat, 0, -0.78, 0.1);
  shoe.rotation.x = -0.04;
  grp.add(shoe);
  return grp;
}

function addFallbackHair(group, hairMat) {
  group.add(ellipsoid(0.3, hairMat, 0, 1.81, -0.03, 0.95, 0.72, 0.88));
  group.add(ellipsoid(0.18, hairMat, 0, 1.84, 0.13, 1.45, 0.42, 0.5));

  if (characterState.hair === 'hair-short') {
    group.add(box(0.42, 0.1, 0.24, hairMat, 0, 1.86, 0.1));
    group.add(ellipsoid(0.08, hairMat, -0.18, 1.77, 0.12, 0.65, 1.2, 0.6));
    group.add(ellipsoid(0.08, hairMat, 0.18, 1.77, 0.12, 0.65, 1.2, 0.6));
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
    return;
  }

  var wave = box(0.38, 0.095, 0.18, hairMat, -0.06, 1.9, 0.12);
  wave.rotation.z = -0.12;
  group.add(wave);
  group.add(ellipsoid(0.11, hairMat, 0.19, 1.79, 0.09, 0.85, 1.2, 0.7));
}

function addFallbackFace(group, skinMat, eyeMat) {
  group.add(ellipsoid(0.032, skinMat, 0, 1.66, 0.28, 0.75, 0.9, 1.15));

  if (characterState.face === 'face-apoc') {
    group.add(ellipsoid(0.035, eyeMat, -0.1, 1.71, 0.25, 0.8, 1.05, 0.55));
    group.add(ellipsoid(0.035, eyeMat, 0.1, 1.71, 0.25, 0.8, 1.05, 0.55));
    group.add(box(0.32, 0.12, 0.035, eyeMat, 0, 1.64, 0.3));
    group.add(box(0.09, 0.035, 0.04, skinMat, -0.08, 1.65, 0.32));
    group.add(box(0.09, 0.035, 0.04, skinMat, 0.08, 1.65, 0.32));
    return;
  }

  if (characterState.face === 'face-calm') {
    group.add(box(0.2, 0.025, 0.025, eyeMat, -0.1, 1.71, 0.27));
    group.add(box(0.2, 0.025, 0.025, eyeMat, 0.1, 1.71, 0.27));
    group.add(box(0.16, 0.022, 0.025, eyeMat, 0, 1.59, 0.28));
    return;
  }

  group.add(ellipsoid(0.035, eyeMat, -0.1, 1.71, 0.25, 0.8, 1.05, 0.55));
  group.add(ellipsoid(0.035, eyeMat, 0.1, 1.71, 0.25, 0.8, 1.05, 0.55));

  if (characterState.face === 'face-focus') {
    group.add(box(0.22, 0.025, 0.025, eyeMat, 0, 1.59, 0.28));
    group.add(ellipsoid(0.035, eyeMat, -0.15, 1.76, 0.24, 1.1, 0.45, 0.35));
    group.add(ellipsoid(0.035, eyeMat, 0.15, 1.76, 0.24, 1.1, 0.45, 0.35));
    return;
  }

  var mouth = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.012, 6, 18, Math.PI), eyeMat);
  mouth.position.set(0, 1.59, 0.27);
  mouth.rotation.set(0, 0, Math.PI);
  group.add(mouth);
}

function addFallbackBadge(group, badgeMat, trimMat) {
  var badge = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.018, 6), badgeMat);
  badge.position.set(0.17, 1.16, 0.25);
  badge.rotation.x = Math.PI / 2;
  group.add(badge);

  var shine = box(0.055, 0.015, 0.016, trimMat, 0.15, 1.19, 0.27);
  shine.rotation.z = -0.55;
  group.add(shine);
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
  const forward = new THREE.Vector3(Math.sin(avatar.rotation.y), 0, Math.cos(avatar.rotation.y));

  return (
    g.collectibleClusters.find((cluster) => {
      if (!cluster.userData.available) return false;

      const toCluster = new THREE.Vector3(
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
  mathFeedback.textContent = "";
  mathPanel.hidden = false;
  gameStatus.textContent = "";

  if (cluster.userData.kind === "diamond") {
    mathForm.hidden = true;
    readingForm.hidden = false;
    logicForm.hidden = true;
    currentReadingProblem = makeReadingProblem(pendingChallenge.level);
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

function makeMathProblem(level) {
  if (level === 1) {
    const useAddition = Math.random() > 0.35;
    if (useAddition) {
      const left = 1 + Math.floor(Math.random() * 5);
      const right = 1 + Math.floor(Math.random() * (10 - left));
      return { left, right, operator: "+", answer: left + right, level };
    }
    const left = 3 + Math.floor(Math.random() * 8);
    const right = Math.floor(Math.random() * left);
    return { left, right, operator: "-", answer: left - right, level };
  }

  if (level === 2) {
    const useAddition = Math.random() > 0.45;
    if (useAddition) {
      const left = 4 + Math.floor(Math.random() * 10);
      const right = 2 + Math.floor(Math.random() * (20 - left));
      return { left, right, operator: "+", answer: left + right, level };
    }
    const left = 10 + Math.floor(Math.random() * 11);
    const right = 1 + Math.floor(Math.random() * Math.min(left, 12));
    return { left, right, operator: "-", answer: left - right, level };
  }

  if (level === 3) {
    const target = 10 + Math.floor(Math.random() * 11);
    const missing = 2 + Math.floor(Math.random() * (target - 3));
    const shown = target - missing;
    if (Math.random() > 0.5) {
      return { left: shown, right: "?", operator: "+", answer: missing, target, level };
    }
    return { left: "?", right: shown, operator: "+", answer: missing, target, level };
  }

  const groupSize = [2, 5, 10][Math.floor(Math.random() * 3)];
  const groups = 2 + Math.floor(Math.random() * 4);
  return {
    left: groups,
    right: groupSize,
    operator: "×",
    answer: groups * groupSize,
    level,
    prompt: "Räkna grupperna:",
  };
}

function makeReadingProblem(level) {
  if (level === 1) {
    const simpleQuestions = [
      {
        passage: "Mira har en gul hatt. Hon går till parken.",
        question: "Vad har Mira?",
        options: ["En gul hatt", "En blå bil", "En röd bok"],
        answer: 0,
      },
      {
        passage: "Leo ser tre fiskar i dammen. Fiskarna simmar snabbt.",
        question: "Hur många fiskar ser Leo?",
        options: ["Två", "Tre", "Fem"],
        answer: 1,
      },
      {
        passage: "Nora packar en macka och ett äpple i sin väska.",
        question: "Vad packar Nora?",
        options: ["En macka och ett äpple", "En boll och en sko", "En sten och en pinne"],
        answer: 0,
      },
    ];
    return { ...simpleQuestions[Math.floor(Math.random() * simpleQuestions.length)] };
  }

  if (level === 3) {
    const sequenceQuestions = [
      {
        passage: "Först hittade Sam en karta vid trädet. Sedan följde han stigen till sjön. Till slut såg han en blå kristall bakom en sten.",
        question: "Vad gjorde Sam efter att han hittade kartan?",
        options: ["Han följde stigen till sjön", "Han köpte en hatt", "Han gick hem direkt"],
        answer: 0,
      },
      {
        passage: "Elin hörde åskan mullra. Därför tog hon på sig regnjackan innan hon gick ut. När regnet kom var hon torr.",
        question: "Varför tog Elin på sig regnjackan?",
        options: ["För att hon hörde åskan", "För att hon skulle sova", "För att hon tappade nyckeln"],
        answer: 0,
      },
      {
        passage: "Vid ruinen låg tre stenar i rad. Den första var liten, den andra var större och den tredje var störst. Amir lade en kristall på den största stenen.",
        question: "Var lade Amir kristallen?",
        options: ["På den största stenen", "I ryggsäcken", "Under bron"],
        answer: 0,
      },
    ];
    return { ...sequenceQuestions[Math.floor(Math.random() * sequenceQuestions.length)] };
  }

  if (level === 4) {
    const inferenceQuestions = [
      {
        passage: "Lina såg mörka moln över skogen. Hon lade ner sin bok i väskan och sprang mot vindskyddet. Strax efter började droppar slå mot taket.",
        question: "Vad förstod Lina troligen?",
        options: ["Att det skulle börja regna", "Att solen skulle bli starkare", "Att väskan var tom"],
        answer: 0,
      },
      {
        passage: "Omar hittade en skylt där det stod: 'Här växer inga blommor utan vatten.' Marken var torr och blommorna hängde. Omar fyllde sin kanna vid dammen.",
        question: "Vad tänkte Omar göra?",
        options: ["Vattna blommorna", "Måla skylten", "Räkna stenar"],
        answer: 0,
      },
      {
        passage: "En liten nyckel låg bredvid den låsta kistan. På kistan fanns samma stjärna som på nyckeln. Sara log och plockade upp nyckeln.",
        question: "Varför log Sara?",
        options: ["Hon trodde att nyckeln passade", "Hon ville kasta nyckeln", "Hon hittade sin mössa"],
        answer: 0,
      },
    ];
    return { ...inferenceQuestions[Math.floor(Math.random() * inferenceQuestions.length)] };
  }

  const pool = readingQuestions.filter((problem) => (problem.level || 2) === level);
  const source = pool.length > 0 ? pool : readingQuestions;
  return { ...source[Math.floor(Math.random() * source.length)] };
}

function openLogicLab() {
  closeLabBench({ restorePointer: false });
  if (gameUI.pointerLocked && document.exitPointerLock) document.exitPointerLock();
  pendingCluster = null;
  pendingChallenge = createChallenge("logic");
  currentLogicProblem = makeLogicProblem(pendingChallenge.level);
  activeProblem = null;
  currentReadingProblem = null;
  mathReward.textContent = rewardText("logic", pendingChallenge.reward, pendingChallenge.level, true);
  mathReward.className = "math-reward math-reward--logic";
  mathFeedback.textContent = "";
  mathForm.hidden = true;
  readingForm.hidden = true;
  logicForm.hidden = false;
  logicTitle.textContent = currentLogicProblem.title;
  logicPromptText.textContent = currentLogicProblem.prompt;
  renderLogicProblem(currentLogicProblem);
  mathPanel.hidden = false;
  labPrompt.hidden = true;
  gameStatus.textContent = "";
}

function makeLogicProblem(level) {
  const makers = [makePatternProblem, makeSortingProblem, makeRuleProblem];
  return makers[Math.floor(Math.random() * makers.length)](level);
}

function makePatternProblem(level) {
  if (level === 1) {
    const sets = [
      { sequence: ["blå cirkel", "röd triangel", "blå cirkel", "röd triangel"], answer: "blå cirkel", options: ["blå cirkel", "röd triangel", "gul stjärna"] },
      { sequence: ["gul stjärna", "gul stjärna", "grön fyrkant", "gul stjärna", "gul stjärna"], answer: "grön fyrkant", options: ["grön fyrkant", "gul stjärna", "blå cirkel"] },
    ];
    const picked = sets[Math.floor(Math.random() * sets.length)];
    return {
      title: "Mönstermaskinen",
      prompt: "Maskinen har tappat nästa symbol. Vad kommer sedan?",
      kind: "pattern",
      items: picked.sequence,
      answer: picked.answer,
      options: picked.options,
    };
  }

  if (level === 2) {
    const sets = [
      { sequence: ["1", "3", "5", "7"], answer: "9", options: ["8", "9", "10"] },
      { sequence: ["A", "B", "B", "A", "B", "B"], answer: "A", options: ["A", "B", "C"] },
    ];
    const picked = sets[Math.floor(Math.random() * sets.length)];
    return {
      title: "Mönstermaskinen",
      prompt: "Hitta regeln och välj nästa ruta.",
      kind: "pattern",
      items: picked.sequence,
      answer: picked.answer,
      options: picked.options,
    };
  }

  const sets = [
    { sequence: ["röd cirkel", "blå triangel", "gul fyrkant", "röd cirkel", "blå triangel"], answer: "gul fyrkant", options: ["gul fyrkant", "röd triangel", "blå cirkel"] },
    { sequence: ["2", "4", "8", "16"], answer: "32", options: ["20", "24", "32"] },
  ];
  const picked = sets[Math.floor(Math.random() * sets.length)];
  return {
    title: "Mönstermaskinen",
    prompt: "Regeln är lite lurigare nu. Vilken ruta fortsätter mönstret?",
    kind: "pattern",
    items: picked.sequence,
    answer: picked.answer,
    options: picked.options,
  };
}

function makeSortingProblem(level) {
  if (level === 1) {
    const numbers = [2, 4, 7, 6, 9];
    return {
      title: "Sorteringsröret",
      prompt: "Maskinen sorterar från minst till störst. Vilket tal ligger fel?",
      kind: "sort",
      items: numbers.map(String),
      answer: "6",
      options: ["4", "6", "9"],
    };
  }

  if (level === 2) {
    const words = ["apa", "bil", "dator", "citron", "eka"];
    return {
      title: "Sorteringsröret",
      prompt: "Orden ska ligga i alfabetisk ordning. Vilket ord ligger fel?",
      kind: "sort",
      items: words,
      answer: "citron",
      options: ["bil", "dator", "citron"],
    };
  }

  const items = level === 3 ? ["3", "6", "12", "9", "15"] : ["röd liten", "röd stor", "blå liten", "blå stor", "grön liten"];
  return {
    title: "Sorteringsröret",
    prompt: level === 3 ? "Talen ska öka med 3 varje steg. Vilket tal stör regeln?" : "Maskinen sorterar först färg, sedan storlek. Vilken ruta bryter ordningen?",
    kind: "sort",
    items,
    answer: level === 3 ? "12" : "grön liten",
    options: level === 3 ? ["6", "12", "9"] : ["röd stor", "blå stor", "grön liten"],
  };
}

function makeRuleProblem(level) {
  if (level === 1) {
    return {
      title: "Regeldetektiven",
      prompt: "Maskinen gillar 2, 4 och 8. Den gillar inte 3, 5 och 7. Vilken regel använder den?",
      kind: "rule",
      accepted: ["2", "4", "8"],
      rejected: ["3", "5", "7"],
      answer: "Jämna tal",
      options: ["Jämna tal", "Tal större än 5", "Tal med två siffror"],
    };
  }

  if (level === 2) {
    return {
      title: "Regeldetektiven",
      prompt: "Maskinen gillar orden sol, ros och vas. Den gillar inte sten, blomma och karta.",
      kind: "rule",
      accepted: ["sol", "ros", "vas"],
      rejected: ["sten", "blomma", "karta"],
      answer: "Tre bokstäver",
      options: ["Tre bokstäver", "Börjar på s", "Saker i rymden"],
    };
  }

  return {
    title: "Regeldetektiven",
    prompt: level === 3 ? "Maskinen gillar blå cirklar och blå fyrkanter, men inte röda cirklar." : "Maskinen gillar små röda former med hörn, men inte stora röda former eller små blå former.",
    kind: "rule",
    accepted: level === 3 ? ["blå cirkel", "blå fyrkant"] : ["liten röd triangel", "liten röd fyrkant"],
    rejected: level === 3 ? ["röd cirkel", "gul fyrkant"] : ["stor röd triangel", "liten blå fyrkant"],
    answer: level === 3 ? "Blå former" : "Små röda former med hörn",
    options: level === 3 ? ["Blå former", "Bara cirklar", "Gula former"] : ["Små röda former med hörn", "Alla röda former", "Alla små former"],
  };
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
    collectGemCluster(pendingCluster);
    closeMathPanel();
    gameStatus.textContent =
      firstTry ? "Rätt på första försöket. Bonus!" : "Rätt. Nya kristaller dök upp någon annanstans.";
    return;
  }

  recordChallengeResult(false);
  mathFeedback.textContent = "Nästan. Försök igen.";
  mathAnswer.select();
}

function submitReadingAnswer(chosenIndex) {
  if (!currentReadingProblem || !pendingCluster || !pendingChallenge) return;

  pendingChallenge.attempts += 1;
  if (chosenIndex === currentReadingProblem.answer) {
    const firstTry = pendingChallenge.attempts === 1;
    recordChallengeResult(firstTry);
    collectGemCluster(pendingCluster);
    closeMathPanel();
    gameStatus.textContent = firstTry ? "Rätt på första försöket. Bonus!" : "Rätt!";
    return;
  }

  recordChallengeResult(false);
  mathFeedback.textContent = "Fel. Försök igen.";
}

function submitLogicAnswer(chosenOption) {
  if (!currentLogicProblem || !pendingChallenge) return;

  pendingChallenge.attempts += 1;
  if (chosenOption === currentLogicProblem.answer) {
    const firstTry = pendingChallenge.attempts === 1;
    const firstTryBonus = firstTry ? 1 : 0;
    recordChallengeResult(firstTry);
    resources.rubies += pendingChallenge.reward + firstTryBonus;
    updateResourceCounters();
    closeMathPanel();
    gameStatus.textContent = firstTry ? "Pixel: Exakt. Du fick bonusrubin!" : "Pixel: Rätt. Rubinerna glöder.";
    saveGame();
    return;
  }

  recordChallengeResult(false);
  mathFeedback.textContent = "Pixel: Nästan. Leta efter vad som ändras, sorteras eller väljs bort.";
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
      btn.textContent = activePixelPet === item.id ? "Aktiv" : "Välj";
      btn.disabled = activePixelPet === item.id;
      btn.addEventListener("click", () => equipPixelPet(item.id));
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

function createPixelPetPreview(itemId) {
  const preview = document.createElement("span");
  preview.className = `lab-item-icon pet-preview pet-preview--${itemId}`;
  preview.setAttribute("aria-hidden", "true");

  if (itemId === "minirobot") {
    appendPreviewPart(preview, "pet-antenna");
    appendPreviewPart(preview, "pet-body");
    appendPreviewPart(preview, "pet-screen");
    appendPreviewPart(preview, "pet-eye pet-eye-left");
    appendPreviewPart(preview, "pet-eye pet-eye-right");
    appendPreviewPart(preview, "pet-leg pet-leg-left");
    appendPreviewPart(preview, "pet-leg pet-leg-right");
  } else if (itemId === "gnistdronare") {
    appendPreviewPart(preview, "pet-ring");
    appendPreviewPart(preview, "pet-core");
    appendPreviewPart(preview, "pet-spark");
    appendPreviewPart(preview, "pet-dot pet-dot-left");
    appendPreviewPart(preview, "pet-dot pet-dot-right");
  } else {
    appendPreviewPart(preview, "pet-cube");
    appendPreviewPart(preview, "pet-cube-shine");
    appendPreviewPart(preview, "pet-eye pet-eye-left");
    appendPreviewPart(preview, "pet-eye pet-eye-right");
    appendPreviewPart(preview, "pet-mouth");
  }

  return preview;
}

function appendPreviewPart(parent, className) {
  const part = document.createElement("span");
  part.className = className;
  parent.appendChild(part);
}

function openLabBench() {
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
  equipPixelPet(itemId, false);
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

function renderShop() {
  shopItems.innerHTML = "";
  brainrotShopItems.forEach((item) => {
    const owned = ownedBrainrots.has(item.id);
    const canAfford = resources.emeralds >= item.emeraldCost && resources.diamonds >= item.diamondCost;

    const card = document.createElement("div");
    card.className = "shop-item";

    const emoji = document.createElement("span");
    emoji.className = "shop-item-emoji";
    emoji.textContent = item.emoji;

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
    price.className = "shop-item-price";
    const parts = [];
    if (item.emeraldCost > 0) parts.push(`<span class="price-emerald">${item.emeraldCost}★</span>`);
    if (item.diamondCost > 0) parts.push(`<span class="price-diamond">${item.diamondCost}♦</span>`);
    price.innerHTML = parts.join(" ");

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

    card.appendChild(emoji);
    card.appendChild(info);
    card.appendChild(price);
    card.appendChild(btn);
    shopItems.appendChild(card);
  });
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

function openShop() {
  if (gameUI.shopOpen) return;
  if (gameUI.pointerLocked && document.exitPointerLock) document.exitPointerLock();
  gameUI.shopOpen = true;
  renderShop();
  shopPanel.hidden = false;
  storePrompt.hidden = true;
}

function openInventory() {
  if (gameUI.inventoryOpen) return;
  if (gameUI.pointerLocked && document.exitPointerLock) document.exitPointerLock();
  gameUI.inventoryOpen = true;
  inventoryItems.innerHTML = "";
  if (ownedBrainrots.size === 0 && ownedPixelPets.size === 0) {
    const empty = document.createElement("div");
    empty.className = "inventory-empty";
    empty.textContent = "Inga saker ännu. Handla i butiken eller bygg vid Pixelbänken!";
    inventoryItems.appendChild(empty);
  } else {
    brainrotShopItems
      .filter((item) => ownedBrainrots.has(item.id))
      .forEach((item) => {
        const card = document.createElement("div");
        card.className = "inventory-item";

        const emoji = document.createElement("span");
        emoji.className = "inventory-item-emoji";
        emoji.textContent = item.emoji;

        const name = document.createElement("span");
        name.className = "inventory-item-name";
        name.textContent = item.name;

        card.appendChild(emoji);
        card.appendChild(name);
        inventoryItems.appendChild(card);
      });
    pixelPetItems
      .filter((item) => ownedPixelPets.has(item.id))
      .forEach((item) => {
        const card = document.createElement("div");
        card.className = "inventory-item";

        const icon = document.createElement("span");
        icon.className = "inventory-item-emoji inventory-item-symbol";
        icon.textContent = item.symbol;

        const name = document.createElement("span");
        name.className = "inventory-item-name";
        name.textContent = activePixelPet === item.id ? `${item.name} (aktiv)` : item.name;

        card.appendChild(icon);
        card.appendChild(name);
        inventoryItems.appendChild(card);
      });
  }
  inventoryPanel.hidden = false;
}

mathPanel.addEventListener("submit", submitMathAnswer);
mathClose.addEventListener("click", () => closeMathPanel({ restoreCluster: true }));
shopClose.addEventListener("click", closeShop);
labClose.addEventListener("click", closeLabBench);
labStartTest.addEventListener("click", openLogicLab);
inventoryClose.addEventListener("click", closeInventory);
