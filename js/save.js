function getSaveData() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || { characters: {} }; }
  catch { return { characters: {} }; }
}

function writeSaveData(data) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

function cloneLearningProgress(progress) {
  const source = progress || DEFAULT_LEARNING_PROGRESS;
  return {
    math: {
      level: Math.max(1, Math.min(4, Number(source.math && source.math.level) || 1)),
      recent: Array.isArray(source.math && source.math.recent) ? source.math.recent.slice(-5).map(Boolean) : [],
      answered: Array.isArray(source.math && source.math.answered) ? source.math.answered.map(String) : [],
    },
    reading: {
      level: Math.max(1, Math.min(4, Number(source.reading && source.reading.level) || 1)),
      recent: Array.isArray(source.reading && source.reading.recent) ? source.reading.recent.slice(-5).map(Boolean) : [],
      answered: Array.isArray(source.reading && source.reading.answered) ? source.reading.answered.map(String) : [],
    },
    logic: {
      level: Math.max(1, Math.min(4, Number(source.logic && source.logic.level) || 1)),
      recent: Array.isArray(source.logic && source.logic.recent) ? source.logic.recent.slice(-5).map(Boolean) : [],
      answered: Array.isArray(source.logic && source.logic.answered) ? source.logic.answered.map(String) : [],
    },
  };
}

function setLearningProgress(progress) {
  const normalized = cloneLearningProgress(progress);
  learningProgress.math.level = normalized.math.level;
  learningProgress.math.recent = normalized.math.recent;
  learningProgress.math.answered = normalized.math.answered;
  learningProgress.reading.level = normalized.reading.level;
  learningProgress.reading.recent = normalized.reading.recent;
  learningProgress.reading.answered = normalized.reading.answered;
  learningProgress.logic.level = normalized.logic.level;
  learningProgress.logic.recent = normalized.logic.recent;
  learningProgress.logic.answered = normalized.logic.answered;
}

function saveGame() {
  if (!currentCharacter) return;
  try {
    const data = getSaveData();
    data.characters[currentCharacter] = {
      state: { ...characterState },
      emeralds: resources.emeralds,
      diamonds: resources.diamonds,
      rubies: resources.rubies,
      ownedBrainrots: [...ownedBrainrots],
      ownedPixelPets: [...ownedPixelPets],
      activePixelPet,
      learningProgress: cloneLearningProgress(learningProgress),
    };
    writeSaveData(data);
  } catch (e) {}
}

function loadGame() {
  const data = getSaveData();
  resources.emeralds = 0;
  resources.diamonds = 0;
  resources.rubies = 0;
  ownedBrainrots.clear();
  ownedPixelPets.clear();
  activePixelPet = null;
  setLearningProgress(DEFAULT_LEARNING_PROGRESS);
  return data;
}
