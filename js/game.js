const gameCanvas = document.querySelector("#game-canvas");
const pauseOverlay = document.querySelector("#pause-overlay");
const pauseContinue = document.querySelector("#pause-continue");

let game = null;
const keys = new Set();

function stopGame() {
  if (game) {
    game.running = false;
    if (game.renderer) game.renderer.setAnimationLoop(null);
  }
  keys.clear();
  closeMathPanel({ restoreCluster: true });
  closeShop();
  closeLabBench();
  closeInventory();
  clearGameState();
  gameUI.gamePaused = false;
  gameUI.lockTransition = false;
  pauseOverlay.hidden = true;
  storePrompt.hidden = true;
  labPrompt.hidden = true;
  if (gameUI.pointerLocked && document.exitPointerLock) document.exitPointerLock();
  saveGame();
}

function startGame() {
  titleScreen.hidden = true;
  creatorScreen.hidden = true;
  gameScreen.hidden = false;

  if (!window.THREE) {
    gameStatus.textContent = "3D-motorn kunde inte laddas. Kontrollera internet och ladda om sidan.";
    return;
  }

  gameStatus.textContent = "";

  if (!game) {
    game = createGame();
    setGameRef(game);
  }

  rebuildAvatar();
  syncPixelPet();
  applyWorldMood();
  ensureCollectibleClusters();
  updateResourceCounters();
  resizeGame();
  game.running = true;
  game.clock.start();
  game.renderer.setAnimationLoop(updateGame);
  gameStatus.textContent = "Hitta kristaller. Ställ dig framför dem och svara på frågan.";
  gameCanvas.focus();
  gameCanvas.requestPointerLock();
}

function createGame() {
  const renderer = new THREE.WebGLRenderer({
    canvas: gameCanvas,
    antialias: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 160);
  camera.position.set(0, 5.2, 8.5);

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x36513d, 0.85);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xffffff, 1.1);
  sunLight.position.set(6, 10, 5);
  sunLight.castShadow = true;
  scene.add(sunLight);

  const ground = createTerrainMesh();
  scene.add(ground);

  const trees = [];
  addTrees(scene, trees);
  createStore(scene);
  createProfessorPixelLab(scene);
  createPath(scene);
  createPond(scene);
  createCampfire(scene);
  createRuins(scene);
  createDecorations(scene);
  const collectibleClusters = [];

  return {
    renderer,
    scene,
    camera,
    ground,
    sunLight,
    clock: new THREE.Clock(),
    avatar: null,
    trees,
    collectibleClusters,
    pixelPet: null,
    running: false,
    velocity: new THREE.Vector3(),
  };
}

function rebuildAvatar({ preserveTransform = false } = {}) {
  const avatarPosition =
    preserveTransform && game.avatar ? game.avatar.position.clone() : new THREE.Vector3(0, 0, 0);
  const avatarRotationY = preserveTransform && game.avatar ? game.avatar.rotation.y : 0;
  if (game.avatar) {
    game.scene.remove(game.avatar);
  }
  game.avatar = createAvatar();
  game.avatar.position.copy(avatarPosition);
  game.avatar.position.y = getTerrainHeight(game.avatar.position.x, game.avatar.position.z);
  game.avatar.rotation.y = avatarRotationY;
  game.scene.add(game.avatar);
}

function updateGame() {
  if (!game.running) return;

  if (gameUI.gamePaused) {
    game.renderer.render(game.scene, game.camera);
    return;
  }

  const delta = Math.min(game.clock.getDelta(), 0.05);
  const move = game.velocity.set(0, 0, 0);
  const speed = 5.2;

  if (gameUI.pointerLocked) {
    const forward = new THREE.Vector3();
    game.camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() > 0) forward.normalize();

    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(game.camera.quaternion);
    right.y = 0;
    right.normalize();

    if (keys.has("KeyW")) move.add(forward);
    if (keys.has("KeyS")) move.sub(forward);
    if (keys.has("KeyA")) move.sub(right);
    if (keys.has("KeyD")) move.add(right);
  } else {
    if (keys.has("KeyW")) move.z -= 1;
    if (keys.has("KeyS")) move.z += 1;
    if (keys.has("KeyA")) move.x -= 1;
    if (keys.has("KeyD")) move.x += 1;
  }

  const hadInput = move.lengthSq() > 0;

  if (hadInput) {
    move.normalize().multiplyScalar(speed * delta);
    const newPos = new THREE.Vector3(
      game.avatar.position.x + move.x,
      game.avatar.position.y,
      game.avatar.position.z + move.z,
    );

    const blockedByTree = collidesWithTrees(newPos, game.trees);
    const blockedByStore = collidesWithStore(newPos);
    const blockedByLab = collidesWithLab(newPos);

    if (!blockedByTree && !blockedByStore && !blockedByLab) {
      game.avatar.position.copy(newPos);
    } else {
      const xOnly = new THREE.Vector3(newPos.x, game.avatar.position.y, game.avatar.position.z);
      const zOnly = new THREE.Vector3(game.avatar.position.x, game.avatar.position.y, newPos.z);
      if (!collidesWithTrees(xOnly, game.trees) && !collidesWithStore(xOnly) && !collidesWithLab(xOnly)) {
        game.avatar.position.x = newPos.x;
      }
      if (!collidesWithTrees(zOnly, game.trees) && !collidesWithStore(zOnly) && !collidesWithLab(zOnly)) {
        game.avatar.position.z = newPos.z;
      }
    }

    game.avatar.position.x = clamp(game.avatar.position.x, -WORLD_LIMIT, WORLD_LIMIT);
    game.avatar.position.z = clamp(game.avatar.position.z, -WORLD_LIMIT, WORLD_LIMIT);
    game.avatar.position.y = getTerrainHeight(game.avatar.position.x, game.avatar.position.z);
    if (!gameUI.pointerLocked) {
      game.avatar.rotation.y = Math.atan2(move.x, -move.z);
    }
  }

  if (!hadInput && game.avatar) {
    game.avatar.position.y = getTerrainHeight(game.avatar.position.x, game.avatar.position.z);
  }

  animateAvatar(hadInput, delta);

  updateCollectibleClusters(delta);
  checkForCollectibleChallenge();

  const distToStore = distance2D(game.avatar.position, storePosition);
  gameUI.nearStore = distToStore < storeRadius;
  const distToLab = distance2D(game.avatar.position, labPosition);
  gameUI.nearLab = distToLab < labRadius;
  updatePixelPet(delta);

  storePrompt.hidden = !gameUI.nearStore || gameUI.shopOpen || gameUI.labOpen || !mathPanel.hidden || gameUI.inventoryOpen || gameUI.nearLab;
  labPrompt.hidden = !gameUI.nearLab || gameUI.shopOpen || gameUI.labOpen || !mathPanel.hidden || gameUI.inventoryOpen;

  const cameraTarget = new THREE.Vector3(
    game.avatar.position.x,
    game.avatar.position.y + PLAYER_HEIGHT + 0.35,
    game.avatar.position.z,
  );
  const angle = game.avatar.rotation.y;
  const cameraOffset = new THREE.Vector3(
    -7.2 * Math.sin(angle),
    4.2,
    -7.2 * Math.cos(angle),
  );
  game.camera.position.lerp(cameraTarget.clone().add(cameraOffset), 0.08);
  game.camera.lookAt(cameraTarget);
  game.renderer.render(game.scene, game.camera);
}

function resizeGame() {
  if (!game) return;
  const width = gameScreen.clientWidth;
  const height = gameScreen.clientHeight;
  game.renderer.setSize(width, height, false);
  game.camera.aspect = width / height;
  game.camera.updateProjectionMatrix();
}

function pauseGame() {
  if (gameUI.gamePaused) return;
  gameUI.gamePaused = true;
  if (gameUI.pointerLocked && document.exitPointerLock) document.exitPointerLock();
  pauseOverlay.hidden = false;
  keys.clear();
}

function resumeGame() {
  if (!gameUI.gamePaused) return;
  gameUI.gamePaused = false;
  pauseOverlay.hidden = true;
  gameUI.lockTransition = true;
  gameCanvas.focus();
  acquirePointerLock();
}

function acquirePointerLock() {
  gameCanvas.requestPointerLock();
  let tries = 0;
  const interval = setInterval(() => {
    tries++;
    if (gameUI.pointerLocked || tries > 8) {
      clearInterval(interval);
      gameUI.lockTransition = false;
      return;
    }
    gameCanvas.requestPointerLock();
  }, 60);
}

window.addEventListener("keydown", (event) => {
  if (
    !gameScreen.hidden &&
    !gameUI.gamePaused &&
    mathPanel.hidden &&
    !gameUI.shopOpen &&
    !gameUI.labOpen &&
    !gameUI.inventoryOpen &&
    ["KeyW", "KeyA", "KeyS", "KeyD"].includes(event.code)
  ) {
    keys.add(event.code);
    event.preventDefault();
  }

  if (event.code === "KeyE" && !gameScreen.hidden && !gameUI.gamePaused && mathPanel.hidden && !gameUI.inventoryOpen) {
    if (gameUI.shopOpen) {
      closeShop();
    } else if (gameUI.labOpen) {
      closeLabBench();
    } else if (gameUI.nearLab) {
      openLabBench();
    } else if (gameUI.nearStore) {
      openShop();
    }
    event.preventDefault();
  }

  if (event.code === "KeyI" && !gameScreen.hidden && !gameUI.gamePaused && mathPanel.hidden && !gameUI.shopOpen && !gameUI.labOpen) {
    if (gameUI.inventoryOpen) {
      closeInventory();
    } else {
      openInventory();
    }
    event.preventDefault();
  }

  if (event.code === "Escape" && !gameScreen.hidden) {
    if (gameUI.shopOpen) {
      closeShop();
      event.preventDefault();
    } else if (gameUI.labOpen) {
      closeLabBench();
      event.preventDefault();
    } else if (gameUI.inventoryOpen) {
      closeInventory();
      event.preventDefault();
    } else if (!mathPanel.hidden) {
      closeMathPanel({ restoreCluster: true });
      event.preventDefault();
    } else if (gameUI.gamePaused) {
      resumeGame();
      event.preventDefault();
    }
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

window.addEventListener("resize", resizeGame);

gameCanvas.addEventListener("click", () => {
  if (!gameUI.pointerLocked && mathPanel.hidden && !gameUI.shopOpen && !gameUI.labOpen && !gameUI.inventoryOpen) {
    gameCanvas.requestPointerLock();
  }
});

document.addEventListener("pointerlockchange", () => {
  gameUI.pointerLocked = document.pointerLockElement === gameCanvas;
  if (!game || !game.running) return;
  if (!gameUI.pointerLocked) {
    if (!gameUI.gamePaused && mathPanel.hidden && !gameUI.shopOpen && !gameUI.labOpen && !gameUI.inventoryOpen && !gameUI.lockTransition) {
      pauseGame();
    }
    return;
  }
  gameUI.lockTransition = false;
});

document.addEventListener("mousemove", (event) => {
  if (!gameUI.pointerLocked || !game || !game.running) return;
  if (mathPanel.hidden && !gameUI.shopOpen && !gameUI.labOpen && !gameUI.inventoryOpen) {
    game.avatar.rotation.y -= event.movementX * MOUSE_SENSITIVITY;
  }
});

const pauseBackpack = document.querySelector("#pause-backpack");
const pauseCustomize = document.querySelector("#pause-customize");
const pauseQuit = document.querySelector("#pause-quit");

pauseContinue.addEventListener("click", resumeGame);

pauseBackpack.addEventListener("click", () => {
  if (!gameUI.gamePaused) return;
  gameUI.gamePaused = false;
  pauseOverlay.hidden = true;
  openInventory();
});

pauseCustomize.addEventListener("click", () => {
  stopGame();
  showCreator();
});

pauseQuit.addEventListener("click", () => {
  stopGame();
  showTitle();
});
