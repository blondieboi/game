const gameCanvas = document.querySelector("#game-canvas");
const pauseOverlay = document.querySelector("#pause-overlay");
const pauseContinue = document.querySelector("#pause-continue");
const mobileJoystick = document.querySelector("#mobile-joystick");
const mobileJoystickThumb = document.querySelector("#mobile-joystick-thumb");
const mobileAction = document.querySelector("#mobile-action");
const mobileInventory = document.querySelector("#mobile-inventory");
const mobilePause = document.querySelector("#mobile-pause");

let game = null;
const keys = new Set();
const mobileInput = {
  active: false,
  pointerId: null,
  x: 0,
  z: 0,
  force: 0,
  forwardX: 0,
  forwardZ: 1,
  rightX: 1,
  rightZ: 0,
};

function stopGame() {
  if (game) {
    game.running = false;
    if (game.renderer) game.renderer.setAnimationLoop(null);
  }
  keys.clear();
  resetMobileInput();
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
  updateMobileAction();
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
  if (shouldUsePointerLock()) {
    acquirePointerLock();
  } else {
    gameUI.lockTransition = false;
  }
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

  if (mobileInput.active || gameUI.pointerLocked) {
    const forward = new THREE.Vector3();
    game.camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() > 0) forward.normalize();

    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(game.camera.quaternion);
    right.y = 0;
    right.normalize();

    if (mobileInput.active) {
      move.x += mobileInput.forwardX * mobileInput.z + mobileInput.rightX * mobileInput.x;
      move.z += mobileInput.forwardZ * mobileInput.z + mobileInput.rightZ * mobileInput.x;
    } else {
      if (keys.has("KeyW")) move.add(forward);
      if (keys.has("KeyS")) move.sub(forward);
      if (keys.has("KeyA")) move.sub(right);
      if (keys.has("KeyD")) move.add(right);
    }
  } else {
    if (keys.has("KeyW")) move.z -= 1;
    if (keys.has("KeyS")) move.z += 1;
    if (keys.has("KeyA")) move.x -= 1;
    if (keys.has("KeyD")) move.x += 1;
  }

  const inputStrength = clamp(move.length(), 0, 1);
  const hadInput = inputStrength > 0;

  if (hadInput) {
    move.normalize().multiplyScalar(speed * inputStrength * delta);
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
      game.avatar.rotation.y = mobileInput.active
        ? Math.atan2(move.x, move.z)
        : Math.atan2(move.x, -move.z);
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
  updateMobileAction();

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
  resetMobileInput();
  updateMobileAction();
}

function resumeGame() {
  if (!gameUI.gamePaused) return;
  gameUI.gamePaused = false;
  pauseOverlay.hidden = true;
  gameCanvas.focus();
  if (shouldUsePointerLock()) {
    gameUI.lockTransition = true;
    acquirePointerLock();
  } else {
    gameUI.lockTransition = false;
  }
  updateMobileAction();
}

function acquirePointerLock() {
  if (!shouldUsePointerLock()) {
    gameUI.lockTransition = false;
    return;
  }
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

function shouldUsePointerLock() {
  return Boolean(
    gameCanvas.requestPointerLock &&
    !canUseTouchControls()
  );
}

function canUseTouchControls() {
  if (window.matchMedia) {
    return (
      window.matchMedia("(pointer: coarse)").matches ||
      window.matchMedia("(any-pointer: coarse)").matches ||
      window.matchMedia("(max-width: 52rem)").matches
    );
  }
  return window.innerWidth <= 832;
}

function canUseMobileMovement() {
  return (
    !gameScreen.hidden &&
    !gameUI.gamePaused &&
    mathPanel.hidden &&
    !gameUI.shopOpen &&
    !gameUI.labOpen &&
    !gameUI.inventoryOpen
  );
}

function resetMobileInput() {
  mobileInput.active = false;
  mobileInput.pointerId = null;
  mobileInput.x = 0;
  mobileInput.z = 0;
  mobileInput.force = 0;
  mobileInput.forwardX = 0;
  mobileInput.forwardZ = 1;
  mobileInput.rightX = 1;
  mobileInput.rightZ = 0;
  if (mobileJoystickThumb) {
    mobileJoystickThumb.style.transform = "translate(-50%, -50%)";
  }
}

function captureMobileMoveBasis() {
  if (!game || !game.camera) return;

  const forward = new THREE.Vector3();
  game.camera.getWorldDirection(forward);
  forward.y = 0;
  if (forward.lengthSq() > 0) forward.normalize();

  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(game.camera.quaternion);
  right.y = 0;
  if (right.lengthSq() > 0) right.normalize();

  mobileInput.forwardX = forward.x;
  mobileInput.forwardZ = forward.z;
  mobileInput.rightX = right.x;
  mobileInput.rightZ = right.z;
}

function updateMobileJoystick(pointerEvent) {
  if (!mobileJoystick || !canUseMobileMovement()) {
    resetMobileInput();
    return;
  }

  const rect = mobileJoystick.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const maxRadius = Math.max(1, Math.min(rect.width, rect.height) * 0.36);
  const rawX = pointerEvent.clientX - centerX;
  const rawY = pointerEvent.clientY - centerY;
  const distance = Math.min(Math.sqrt(rawX * rawX + rawY * rawY), maxRadius);
  const angle = Math.atan2(rawY, rawX);
  const thumbX = Math.cos(angle) * distance;
  const thumbY = Math.sin(angle) * distance;
  const deadZone = maxRadius * 0.16;

  if (distance < deadZone) {
    mobileInput.x = 0;
    mobileInput.z = 0;
    mobileInput.force = 0;
  } else {
    mobileInput.x = thumbX / maxRadius;
    mobileInput.z = -thumbY / maxRadius;
    mobileInput.force = distance / maxRadius;
  }

  mobileInput.active = mobileInput.force > 0;
  if (mobileJoystickThumb) {
    mobileJoystickThumb.style.transform = `translate(calc(-50% + ${thumbX}px), calc(-50% + ${thumbY}px))`;
  }
}

function updateMobileAction() {
  if (!mobileAction) return;

  const blocked = gameScreen.hidden || gameUI.gamePaused || !mathPanel.hidden || gameUI.inventoryOpen;
  const canOpenLab = !blocked && gameUI.nearLab && !gameUI.shopOpen;
  const canOpenShop = !blocked && gameUI.nearStore && !gameUI.labOpen && !gameUI.nearLab;

  if (canOpenLab) {
    mobileAction.hidden = false;
    mobileAction.textContent = "Pixelbänk";
    labPrompt.textContent = "Tryck på Pixelbänk";
  } else if (canOpenShop) {
    mobileAction.hidden = false;
    mobileAction.textContent = "Handla";
    storePrompt.textContent = "Tryck på Handla";
  } else {
    mobileAction.hidden = true;
  }

  if (!canUseTouchControls()) {
    storePrompt.textContent = "Tryck E för att handla";
    labPrompt.textContent = "Tryck E för Pixelbänken";
  }
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
  if (shouldUsePointerLock() && !gameUI.pointerLocked && mathPanel.hidden && !gameUI.shopOpen && !gameUI.labOpen && !gameUI.inventoryOpen) {
    gameCanvas.requestPointerLock();
  }
});

document.addEventListener("pointerlockchange", () => {
  gameUI.pointerLocked = document.pointerLockElement === gameCanvas;
  if (!game || !game.running) return;
  if (!gameUI.pointerLocked) {
    if (!shouldUsePointerLock()) {
      gameUI.lockTransition = false;
      return;
    }
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

if (mobileJoystick) {
  mobileJoystick.addEventListener("pointerdown", (event) => {
    if (!canUseMobileMovement()) return;
    mobileInput.pointerId = event.pointerId;
    captureMobileMoveBasis();
    mobileJoystick.setPointerCapture(event.pointerId);
    updateMobileJoystick(event);
    event.preventDefault();
  });

  mobileJoystick.addEventListener("pointermove", (event) => {
    if (mobileInput.pointerId !== event.pointerId) return;
    updateMobileJoystick(event);
    event.preventDefault();
  });

  mobileJoystick.addEventListener("pointerup", (event) => {
    if (mobileInput.pointerId !== event.pointerId) return;
    resetMobileInput();
    event.preventDefault();
  });

  mobileJoystick.addEventListener("pointercancel", (event) => {
    if (mobileInput.pointerId !== event.pointerId) return;
    resetMobileInput();
    event.preventDefault();
  });

  mobileJoystick.addEventListener("lostpointercapture", () => {
    resetMobileInput();
  });
}

if (mobileAction) {
  mobileAction.addEventListener("click", () => {
    if (gameScreen.hidden || gameUI.gamePaused || !mathPanel.hidden || gameUI.inventoryOpen) return;
    if (gameUI.nearLab && !gameUI.shopOpen) {
      openLabBench();
    } else if (gameUI.nearStore && !gameUI.labOpen) {
      openShop();
    }
    resetMobileInput();
    updateMobileAction();
  });
}

if (mobileInventory) {
  mobileInventory.addEventListener("click", () => {
    if (gameScreen.hidden || gameUI.gamePaused || !mathPanel.hidden || gameUI.shopOpen || gameUI.labOpen) return;
    if (gameUI.inventoryOpen) {
      closeInventory();
    } else {
      openInventory();
    }
    resetMobileInput();
    updateMobileAction();
  });
}

if (mobilePause) {
  mobilePause.addEventListener("click", () => {
    if (gameScreen.hidden || gameUI.gamePaused) return;
    pauseGame();
  });
}

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
