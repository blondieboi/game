const character = document.querySelector("#character");
const worldPreview = document.querySelector("#world-preview");
const nameplate = document.querySelector("#character-name");
const nameInput = document.querySelector("#name-input");
const nameValidation = document.querySelector("#name-validation");
const hairOptions = document.querySelector("#hair-options");
const hairColorOptions = document.querySelector("#hair-color-options");
const skinOptions = document.querySelector("#skin-options");
const eyeColorOptions = document.querySelector("#eye-color-options");
const faceOptions = document.querySelector("#face-options");
const shirtColorOptions = document.querySelector("#shirt-color-options");
const pantsColorOptions = document.querySelector("#pants-color-options");
const badgeColorOptions = document.querySelector("#badge-color-options");
const backgroundOptions = document.querySelector("#background-options");
const randomizeButton = document.querySelector("#randomize");
const startGameButton = document.querySelector("#start-game");
const newCharacterBtn = document.querySelector("#new-character-btn");
const prevStepButton = document.querySelector("#prev-step");
const nextStepButton = document.querySelector("#next-step");
const stepDots = document.querySelectorAll("#step-dots .step-dot");
const stepLabel = document.querySelector("#step-label");
const stepPanels = document.querySelectorAll(".step-panel");
let currentStep = 0;

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

function setChoice(type, className) {
  const target = type === "background" ? worldPreview : character;
  choices[type].forEach((choice) => target.classList.remove(choice.className));
  target.classList.add(className);
  characterState[type] = className;
  updatePressedStates(type);
  saveGame();
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
  const defaults = {
    hair: "hair-wavy",
    hairColor: "hair-brown",
    skin: "skin-medium",
    eyes: "eyes-black",
    face: "face-smile",
    shirtColor: "shirt-blue",
    pantsColor: "pants-green",
    badgeColor: "badge-orange",
    background: "background-sunny",
  };
  Object.entries(defaults).forEach(([type, className]) => {
    if (!choices[type]) return;
    const target = type === "background" ? worldPreview : character;
    choices[type].forEach((c) => target.classList.remove(c.className));
    target.classList.add(className);
    characterState[type] = className;
  });
  nameInput.value = "";
  nameValidation.textContent = "";
  syncName();
  Object.keys(defaults).forEach((type) => {
    if (choices[type]) updatePressedStates(type);
  });
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
  const s = charData.state;
  Object.entries(s).forEach(([type, className]) => {
    if (!choices[type]) return;
    const target = type === "background" ? worldPreview : character;
    choices[type].forEach((c) => target.classList.remove(c.className));
    target.classList.add(className);
    characterState[type] = className;
  });
  nameInput.value = name;
  syncName();
  resources.emeralds = charData.emeralds || 0;
  resources.diamonds = charData.diamonds || 0;
  resources.rubies = charData.rubies || 0;
  ownedBrainrots.clear();
  (charData.ownedBrainrots || []).forEach((id) => ownedBrainrots.add(id));
  ownedPixelPets.clear();
  (charData.ownedPixelPets || []).forEach((id) => ownedPixelPets.add(id));
  activePixelPet = ownedPixelPets.has(charData.activePixelPet) ? charData.activePixelPet : (ownedPixelPets.size > 0 ? [...ownedPixelPets][0] : null);
  setLearningProgress(charData.learningProgress);
  Object.keys(s).forEach((type) => {
    if (choices[type]) updatePressedStates(type);
  });
  const data = getSaveData();
  data.lastPlayed = name;
  writeSaveData(data);
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
  setLearningProgress(DEFAULT_LEARNING_PROGRESS);
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
