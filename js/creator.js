var character = document.querySelector("#character");
var worldPreview = document.querySelector("#world-preview");
var nameplate = document.querySelector("#character-name");
var nameInput = document.querySelector("#name-input");
var nameValidation = document.querySelector("#name-validation");
var hairOptions = document.querySelector("#hair-options");
var hairColorOptions = document.querySelector("#hair-color-options");
var skinOptions = document.querySelector("#skin-options");
var eyeColorOptions = document.querySelector("#eye-color-options");
var faceOptions = document.querySelector("#face-options");
var shirtColorOptions = document.querySelector("#shirt-color-options");
var pantsColorOptions = document.querySelector("#pants-color-options");
var badgeColorOptions = document.querySelector("#badge-color-options");
var backgroundOptions = document.querySelector("#background-options");
var randomizeButton = document.querySelector("#randomize");
var startGameButton = document.querySelector("#start-game");
var newCharacterBtn = document.querySelector("#new-character-btn");
var prevStepButton = document.querySelector("#prev-step");
var nextStepButton = document.querySelector("#next-step");
var previewRotation = document.querySelector("#preview-rotation");
var avatarPreviewCanvas = document.querySelector("#avatar-preview-canvas");
var stepDots = document.querySelectorAll("#step-dots .step-dot");
var stepLabel = document.querySelector("#step-label");
var stepPanels = document.querySelectorAll(".step-panel");
var currentStep = 0;
var avatarPreviewRenderer = null;
var avatarPreviewScene = null;
var avatarPreviewCamera = null;
var avatarPreviewRoot = null;
var avatarPreviewAngle = 0;

function showTitle() {
  titleScreen.hidden = false;
  creatorScreen.hidden = true;
  gameScreen.hidden = true;
  renderCharacterList(loadGame());
}

function showCreator() {
  titleScreen.hidden = true;
  gameScreen.hidden = true;
  creatorScreen.hidden = false;
  stopGame();
  initAvatarPreview();
  rebuildAvatarPreview();
}

function goToStep(step) {
  stepPanels.forEach((panel) => panel.hidden = panel.dataset.step != step);
  stepDots.forEach((dot) => dot.classList.toggle("active", dot.dataset.step == step));
  stepLabel.textContent = stepLabels[step];
  prevStepButton.hidden = step === 0;
  nextStepButton.hidden = step === stepPanels.length - 1;
  startGameButton.hidden = step !== stepPanels.length - 1;
  currentStep = step;
}

function updatePressedStates(type) {
  document.querySelectorAll(`[data-type="${type}"]`).forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.value === characterState[type]));
  });
}

function normalizeChoice(type, className) {
  const mapped = legacyChoiceMap[type] && legacyChoiceMap[type][className];
  const nextClassName = mapped || className;
  if (!choices[type] || choices[type].some((choice) => choice.className === nextClassName)) {
    return nextClassName;
  }
  return DEFAULT_CHARACTER_STATE[type];
}

function choiceTarget(type) {
  return type === "background" ? worldPreview : character;
}

function applyCharacterChoice(type, className) {
  if (!choices[type]) return false;
  const nextClassName = normalizeChoice(type, className);
  const target = choiceTarget(type);
  choices[type].forEach((choice) => target.classList.remove(choice.className));
  Object.keys(legacyChoiceMap[type] || {}).forEach((legacyClassName) => target.classList.remove(legacyClassName));
  target.classList.add(nextClassName);
  characterState[type] = nextClassName;
  return true;
}

function applyCharacterChoices(state) {
  const source = {
    ...DEFAULT_CHARACTER_STATE,
    ...(state || {}),
  };
  Object.entries(source).forEach(([type, className]) => {
    applyCharacterChoice(type, className);
  });
  return source;
}

function setChoice(type, className) {
  if (!applyCharacterChoice(type, className)) return;
  updatePressedStates(type);
  rebuildAvatarPreview();
  saveGame();
}

function initAvatarPreview() {
  if (avatarPreviewRenderer || !avatarPreviewCanvas || !window.THREE || typeof createAvatar !== "function") return;
  avatarPreviewScene = new THREE.Scene();
  avatarPreviewCamera = new THREE.PerspectiveCamera(28, 1, 0.1, 20);
  avatarPreviewCamera.position.set(0, 1.28, 5);
  avatarPreviewCamera.lookAt(0, 1.05, 0);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.25);
  keyLight.position.set(2.5, 4.5, 4);
  avatarPreviewScene.add(keyLight);
  avatarPreviewScene.add(new THREE.AmbientLight(0xffffff, 0.55));

  avatarPreviewRenderer = new THREE.WebGLRenderer({
    canvas: avatarPreviewCanvas,
    alpha: true,
    antialias: true,
  });
  avatarPreviewCanvas.style.width = "min(14rem, 78vw)";
  avatarPreviewCanvas.style.height = "20rem";
  character.style.opacity = "0";
  character.style.pointerEvents = "none";
  avatarPreviewRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  avatarPreviewRenderer.outputEncoding = THREE.sRGBEncoding;
  worldPreview.classList.add("has-3d-preview");
  window.addEventListener("resize", renderAvatarPreview);
}

function rebuildAvatarPreview() {
  if (!avatarPreviewRenderer) return;
  if (avatarPreviewRoot) {
    avatarPreviewScene.remove(avatarPreviewRoot);
  }
  avatarPreviewRoot = createAvatar();
  avatarPreviewRoot.rotation.y = avatarPreviewAngle;
  avatarPreviewRoot.position.y = -0.04;
  avatarPreviewScene.add(avatarPreviewRoot);
  renderAvatarPreview();
}

function renderAvatarPreview() {
  if (!avatarPreviewRenderer || !avatarPreviewCanvas || !avatarPreviewRoot) return;
  const rect = avatarPreviewCanvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  avatarPreviewCamera.aspect = width / height;
  avatarPreviewCamera.updateProjectionMatrix();
  avatarPreviewRenderer.setSize(width, height, false);
  avatarPreviewRenderer.render(avatarPreviewScene, avatarPreviewCamera);
}

function setPreviewRotation(value) {
  avatarPreviewAngle = Number(value) * Math.PI / 180;
  character.style.setProperty("--preview-rotation", `${value}deg`);
  if (previewRotation) {
    previewRotation.style.setProperty("--rotation-progress", `${Number(value) / 3.6}%`);
  }
  if (avatarPreviewRoot) {
    avatarPreviewRoot.rotation.y = avatarPreviewAngle;
    renderAvatarPreview();
  }
}

function safeSetLearningProgress(progress) {
  if (typeof setLearningProgress === "function") {
    setLearningProgress(progress);
    return;
  }
  const source = progress || DEFAULT_LEARNING_PROGRESS;
  ["math", "reading", "logic"].forEach((topic) => {
    learningProgress[topic].level = Math.max(1, Math.min(4, Number(source[topic] && source[topic].level) || 1));
    learningProgress[topic].recent =
      Array.isArray(source[topic] && source[topic].recent) ? source[topic].recent.slice(-5).map(Boolean) : [];
    learningProgress[topic].answered =
      Array.isArray(source[topic] && source[topic].answered) ? source[topic].answered.map(String) : [];
  });
}

function randomChoice(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomizeCharacter() {
  setChoice("hair", randomChoice(choices.hair).className);
  setChoice("hairColor", randomChoice(choices.hairColor).className);
  setChoice("skin", randomChoice(choices.skin).className);
  setChoice("eyes", randomChoice(choices.eyes).className);
  setChoice("face", randomChoice(choices.face).className);
  setChoice("shirtColor", randomChoice(choices.shirtColor).className);
  setChoice("pantsColor", randomChoice(choices.pantsColor).className);
  setChoice("badgeColor", randomChoice(choices.badgeColor).className);
  setChoice("background", randomChoice(choices.background).className);
}

function resetToDefaults() {
  applyCharacterChoices(DEFAULT_CHARACTER_STATE);
  nameInput.value = "";
  nameValidation.textContent = "";
  syncName();
  Object.keys(DEFAULT_CHARACTER_STATE).forEach((type) => {
    if (choices[type]) updatePressedStates(type);
  });
  rebuildAvatarPreview();
}

function syncName() {
  const trimmed = nameInput.value.trim();
  nameplate.textContent = trimmed || "Hjälte";
  if (trimmed && nameValidation.textContent) {
    validateCharacterName(false);
  }
  saveGame();
}

function characterNameExists(name, data) {
  const normalized = name.toLocaleLowerCase("sv-SE");
  return Object.keys(data.characters).some((savedName) => {
    if (savedName === currentCharacter) return false;
    return savedName.toLocaleLowerCase("sv-SE") === normalized;
  });
}

function validateCharacterName(shouldFocus) {
  const name = nameInput.value.trim();
  if (!name) {
    nameValidation.textContent = "Du måste ange ett namn!";
    if (shouldFocus) nameInput.focus();
    return false;
  }
  const data = getSaveData();
  if (characterNameExists(name, data)) {
    nameValidation.textContent = "Det namnet är redan taget!";
    if (shouldFocus) nameInput.focus();
    return false;
  }
  nameValidation.textContent = "";
  return true;
}

function renderCharacterList(data) {
  const list = document.querySelector("#character-list");
  list.textContent = "";
  const names = Object.keys(data.characters);
  if (names.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-list";
    empty.textContent = "Inga karaktärer ännu. Skapa en ny!";
    list.appendChild(empty);
    return;
  }
  names.forEach((name) => {
    const charData = data.characters[name];
    const s = charData.state;
    const card = document.createElement("div");
    card.className = "character-card";
    const body = document.createElement("button");
    body.className = "character-card-body";
    body.type = "button";
    const cardName = document.createElement("span");
    cardName.className = "card-name";
    cardName.textContent = name;
    const swatches = document.createElement("div");
    swatches.className = "card-swatches";
    [
      ["hairColor", "#4b2d1c"],
      ["skin", "#b97455"],
      ["shirtColor", "#1e88e5"],
      ["pantsColor", "#43a047"],
    ].forEach(([type, fallback]) => {
      const swatch = document.createElement("span");
      swatch.className = "card-swatch";
      swatch.style.background = colorLookup[s[type]] || fallback;
      swatches.appendChild(swatch);
    });
    body.appendChild(cardName);
    body.appendChild(swatches);
    body.addEventListener("click", () => {
      loadCharacter(name, charData);
      startGame();
    });
    card.appendChild(body);
    const del = document.createElement("button");
    del.className = "card-delete";
    del.type = "button";
    del.setAttribute("aria-label", `Ta bort ${name}`);
    del.textContent = "×";
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteCharacter(name);
    });
    card.appendChild(del);
    list.appendChild(card);
  });
}

function deleteCharacter(name) {
  if (!confirm(`Ta bort "${name}"? Det går inte att ångra.`)) return;
  const data = getSaveData();
  delete data.characters[name];
  writeSaveData(data);
  renderCharacterList(data);
}

function loadCharacter(name, charData) {
  setCurrentCharacter(name);
  const s = applyCharacterChoices(charData.state);
  nameInput.value = name;
  syncName();
  resources.emeralds = charData.emeralds || 0;
  resources.diamonds = charData.diamonds || 0;
  resources.rubies = charData.rubies || 0;
  ownedBrainrots.clear();
  (charData.ownedBrainrots || []).forEach((id) => ownedBrainrots.add(id));
  ownedPixelPets.clear();
  (charData.ownedPixelPets || []).forEach((id) => ownedPixelPets.add(id));
  activePixelPet = ownedPixelPets.has(charData.activePixelPet) ? charData.activePixelPet : null;
  safeSetLearningProgress(charData.learningProgress);
  Object.keys(s).forEach((type) => {
    if (choices[type]) updatePressedStates(type);
  });
  const data = getSaveData();
  data.lastPlayed = name;
  writeSaveData(data);
  rebuildAvatarPreview();
}

function makeOptionButton(type, choice) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "option-button";
  button.dataset.type = type;
  button.dataset.value = choice.className;
  button.setAttribute("aria-pressed", String(characterState[type] === choice.className));
  button.textContent = choice.label;
  button.addEventListener("click", () => setChoice(type, choice.className));
  return button;
}

function makeSwatch(type, choice) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "swatch-button";
  button.dataset.type = type;
  button.dataset.value = choice.className;
  button.style.setProperty("--swatch", choice.color);
  button.setAttribute("aria-label", choice.label);
  button.setAttribute("aria-pressed", String(characterState[type] === choice.className));
  button.addEventListener("click", () => setChoice(type, choice.className));
  return button;
}

choices.hair.forEach((choice) => hairOptions.append(makeOptionButton("hair", choice)));
choices.hairColor.forEach((choice) => hairColorOptions.append(makeSwatch("hairColor", choice)));
choices.skin.forEach((choice) => skinOptions.append(makeSwatch("skin", choice)));
choices.eyes.forEach((choice) => eyeColorOptions.append(makeSwatch("eyes", choice)));
choices.face.forEach((choice) => faceOptions.append(makeOptionButton("face", choice)));
choices.shirtColor.forEach((choice) => shirtColorOptions.append(makeSwatch("shirtColor", choice)));
choices.pantsColor.forEach((choice) => pantsColorOptions.append(makeSwatch("pantsColor", choice)));
choices.badgeColor.forEach((choice) => badgeColorOptions.append(makeSwatch("badgeColor", choice)));
choices.background.forEach((choice) =>
  backgroundOptions.append(makeOptionButton("background", choice)),
);

nameInput.addEventListener("input", syncName);
randomizeButton.addEventListener("click", randomizeCharacter);
if (previewRotation) {
  setPreviewRotation(previewRotation.value);
  previewRotation.addEventListener("input", () => setPreviewRotation(previewRotation.value));
}

startGameButton.addEventListener("click", () => {
  const name = nameInput.value.trim();
  if (!validateCharacterName(true)) return;
  const data = getSaveData();
  if (currentCharacter && currentCharacter !== name) {
    delete data.characters[currentCharacter];
  }
  if (!currentCharacter) {
    data.characters[name] = {
      state: { ...characterState },
      emeralds: 0,
      diamonds: 0,
      rubies: 0,
      ownedBrainrots: [],
      ownedPixelPets: [],
      activePixelPet: null,
      learningProgress: cloneLearningProgress(DEFAULT_LEARNING_PROGRESS),
    };
  }
  setCurrentCharacter(name);
  writeSaveData(data);
  saveGame();
  startGame();
});

newCharacterBtn.addEventListener("click", () => {
  resetToDefaults();
  safeSetLearningProgress(DEFAULT_LEARNING_PROGRESS);
  resources.emeralds = 0;
  resources.diamonds = 0;
  resources.rubies = 0;
  ownedBrainrots.clear();
  ownedPixelPets.clear();
  activePixelPet = null;
  setCurrentCharacter(null);
  showCreator();
});

prevStepButton.addEventListener("click", () => goToStep(currentStep - 1));
nextStepButton.addEventListener("click", () => {
  if (currentStep === 0 && !validateCharacterName(true)) return;
  goToStep(currentStep + 1);
});
