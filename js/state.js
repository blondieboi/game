var SAVE_KEY = "cw_save";

// Shared DOM references (single source of truth across all scripts)
var titleScreen = document.querySelector("#title-screen");
var creatorScreen = document.querySelector("#creator-screen");
var gameScreen = document.querySelector("#game-screen");
var mathPanel = document.querySelector("#math-panel");
var gameStatus = document.querySelector("#game-status");
var storePrompt = document.querySelector("#store-prompt");
var labPrompt = document.querySelector("#lab-prompt");

var MOUSE_SENSITIVITY = 0.004;

var PLAYER_RADIUS = 0.35;
var PLAYER_HEIGHT = 1.8;
var WORLD_SIZE = 140;
var WORLD_LIMIT = 58;
var WORLD_EDGE_START = 50;

var storePosition = { x: 24, z: -26 };
var storeRadius = 3.9;
var storeHalfWidth = 2.95;
var storeHalfDepth = 2.55;
var labPosition = { x: -30, z: -24 };
var labRadius = 4.2;
var labHalfWidth = 3.5;
var labHalfDepth = 3.0;

var stepLabels = [
  "Steg 1 av 4 — Namn & hår",
  "Steg 2 av 4 — Ansikte",
  "Steg 3 av 4 — Dräkt",
  "Steg 4 av 4 — Bakgrund",
];

var choices = {
  hair: [
    { label: "Kort", className: "hair-short" },
    { label: "Vågig", className: "hair-wavy" },
    { label: "Lockig", className: "hair-curly" },
    { label: "Lång", className: "hair-long" },
  ],
  hairColor: [
    { label: "Röd", className: "hair-red", color: "#e53935" },
    { label: "Orange", className: "hair-orange", color: "#fb8c00" },
    { label: "Gul", className: "hair-yellow", color: "#fdd835" },
    { label: "Grön", className: "hair-green", color: "#43a047" },
    { label: "Blå", className: "hair-blue", color: "#1e88e5" },
    { label: "Indigo", className: "hair-indigo", color: "#3949ab" },
    { label: "Violett", className: "hair-violet", color: "#8e24aa" },
    { label: "Svart", className: "hair-black", color: "#15171d" },
    { label: "Blond", className: "hair-blonde", color: "#eac86a" },
    { label: "Rödhårig", className: "hair-redhead", color: "#a94722" },
    { label: "Brun", className: "hair-brown", color: "#4b2d1c" },
  ],
  skin: [
    { label: "Ljus", className: "skin-light", color: "#f0c7a2" },
    { label: "Mellan", className: "skin-medium", color: "#b97455" },
    { label: "Mörk", className: "skin-deep", color: "#70412f" },
    { label: "Fyllig", className: "skin-rich", color: "#3d251e" },
    { label: "Svart", className: "skin-black", color: "#050505" },
  ],
  eyes: [
    { label: "Röd", className: "eyes-red", color: "#c1121f" },
    { label: "Grön", className: "eyes-green", color: "#2a9d55" },
    { label: "Blå", className: "eyes-blue", color: "#1976d2" },
    { label: "Svart", className: "eyes-black", color: "#17212b" },
  ],
  face: [
    { label: "Glad", className: "face-smile" },
    { label: "Lugn", className: "face-calm" },
    { label: "Bestämd", className: "face-focus" },
    { label: "Mask", className: "face-apoc" },
  ],
  shirtColor: [
    { label: "Röd", className: "shirt-red", color: "#e53935" },
    { label: "Orange", className: "shirt-orange", color: "#fb8c00" },
    { label: "Gul", className: "shirt-yellow", color: "#fdd835" },
    { label: "Grön", className: "shirt-green", color: "#43a047" },
    { label: "Blå", className: "shirt-blue", color: "#1e88e5" },
    { label: "Indigo", className: "shirt-indigo", color: "#3949ab" },
    { label: "Violett", className: "shirt-violet", color: "#8e24aa" },
  ],
  pantsColor: [
    { label: "Röd", className: "pants-red", color: "#e53935" },
    { label: "Orange", className: "pants-orange", color: "#fb8c00" },
    { label: "Gul", className: "pants-yellow", color: "#fdd835" },
    { label: "Grön", className: "pants-green", color: "#43a047" },
    { label: "Blå", className: "pants-blue", color: "#1e88e5" },
    { label: "Indigo", className: "pants-indigo", color: "#3949ab" },
    { label: "Violett", className: "pants-violet", color: "#8e24aa" },
  ],
  badgeColor: [
    { label: "Röd", className: "badge-red", color: "#e53935" },
    { label: "Orange", className: "badge-orange", color: "#fb8c00" },
    { label: "Gul", className: "badge-yellow", color: "#fdd835" },
    { label: "Grön", className: "badge-green", color: "#43a047" },
    { label: "Blå", className: "badge-blue", color: "#1e88e5" },
    { label: "Indigo", className: "badge-indigo", color: "#3949ab" },
    { label: "Violett", className: "badge-violet", color: "#8e24aa" },
  ],
  background: [
    { label: "Soligt", className: "background-sunny" },
    { label: "Natt", className: "background-night" },
  ],
};

var legacyChoiceMap = {
  face: {
    "face-goal": "face-focus",
  },
  background: {
    "background-rainy": "background-sunny",
    "background-thunder": "background-night",
  },
};

var DEFAULT_CHARACTER_STATE = {
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

var colorLookup = Object.fromEntries(
  ["hairColor", "skin", "eyes", "badgeColor", "shirtColor", "pantsColor"].flatMap((type) =>
    choices[type].map((choice) => [choice.className, choice.color]),
  ),
);

var backgroundLookup = {
  "background-sunny": {
    sky: 0x8bd3ff,
    ground: 0x4f9f66,
    fog: 0xbde9ff,
  },
  "background-night": {
    sky: 0x17243b,
    ground: 0x274c48,
    fog: 0x202b44,
  },
};

var brainrotShopItems = [
  { id: "skibidi", name: "Skibidi Toilet", emoji: "🚽", rarity: "rare", description: "En legend som lever vidare i evighet", emeraldCost: 3, diamondCost: 1 },
  { id: "sigma", name: "Sigma", emoji: "💪", rarity: "rare", description: "Du är din egen boss. Grindset.", emeraldCost: 2, diamondCost: 2 },
  { id: "rizzler", name: "Rizzler", emoji: "💎", rarity: "epic", description: "Karisman är obegränsad", emeraldCost: 5, diamondCost: 0 },
  { id: "ohio", name: "Ohio", emoji: "🌽", rarity: "uncommon", description: "Bara i Ohio...", emeraldCost: 0, diamondCost: 2 },
  { id: "fanum", name: "Fanum Tax", emoji: "💰", rarity: "rare", description: "Skatt som måste betalas. Fanum style.", emeraldCost: 4, diamondCost: 1 },
  { id: "gyatt", name: "Gyatt", emoji: "🦷", rarity: "epic", description: "När något är så imponerande... gyatt!", emeraldCost: 2, diamondCost: 3 },
  { id: "npc", name: "NPC", emoji: "🤖", rarity: "common", description: "Du följer strömmen. Som alla andra.", emeraldCost: 3, diamondCost: 0 },
  { id: "hawk-tuah", name: "Hawk Tuah", emoji: "🌮", rarity: "epic", description: "Legendary. Iconic. Hawk Tuah.", emeraldCost: 3, diamondCost: 3 },
  { id: "67", name: "67", emoji: "6️⃣7️⃣", rarity: "legendary", description: "Du vet vad det är. 67. Always.", emeraldCost: 5, diamondCost: 1 },
  { id: "tralalero", name: "Tralalero Tralala", emoji: "🎶", rarity: "legendary", description: "S-tier maskot. Bizar. Ikonisk. Tralalero tralala.", emeraldCost: 3, diamondCost: 4 },
  { id: "tung-tung", name: "Tung Tung Tung", emoji: "🔨", rarity: "rare", description: "Tung tung tung sahur. Det fastnar i huvudet.", emeraldCost: 4, diamondCost: 1 },
  { id: "cappuccino", name: "Cappuccino Assassino", emoji: "☕", rarity: "legendary", description: "En mördare med cappuccinohuvud. Dödlig.", emeraldCost: 2, diamondCost: 4 },
  { id: "bombardiro", name: "Bombardiro Crocodilo", emoji: "🐊", rarity: "legendary", description: "Tungt bepansrad krokodil. Explosiv.", emeraldCost: 6, diamondCost: 1 },
  { id: "boneca", name: "Boneca Ambalabu", emoji: "🪆", rarity: "uncommon", description: "Surrealistisk. Chanten som alla sjunger.", emeraldCost: 1, diamondCost: 2 },
  { id: "lirili", name: "Lirilí Larilà", emoji: "🐘", rarity: "rare", description: "En elefant med kaktuskropp. Varför? Varför inte.", emeraldCost: 4, diamondCost: 0 },
  { id: "chimpanzini", name: "Chimpanzini Bananini", emoji: "🐵", rarity: "epic", description: "En galen bananchimpans. Monke.", emeraldCost: 2, diamondCost: 3 },
  { id: "ballerina", name: "Ballerina Cappucina", emoji: "🩰", rarity: "rare", description: "Cappuccinoballerinan. Dansar sig igenom din hjärna.", emeraldCost: 4, diamondCost: 1 },
  { id: "vaca-saturno", name: "La Vaca Saturno Saturnita", emoji: "🪐", rarity: "mythic", description: "En kosmisk ko från Saturnus. Trippy.", emeraldCost: 4, diamondCost: 5 },
];

var readingQuestions = [
  {
    passage: "Solen är en enorm stjärna som består av heta gaser. Den lyser med ett starkt sken och håller vårt solsystem samman med sin gravitation. Utan solens ljus och värme skulle jorden vara en kall och mörk plats utan liv.",
    question: "Vad är solen?",
    options: ["En planet", "En stjärna", "En måne"],
    answer: 1,
  },
  {
    passage: "Blåvalen är det största djuret som någonsin har funnits på jorden. Den kan bli över 30 meter lång och väga upp till 200 ton. Trots sin enorma storlek lever blåvalen mestadels på små räkor som kallas krill.",
    question: "Vad äter blåvalen?",
    options: ["Stora fiskar", "Krill", "Sjögräs"],
    answer: 1,
  },
  {
    passage: "Sverige är ett land i norra Europa. Huvudstaden heter Stockholm och språket är svenska. Sverige är känt för sin vackra natur med många skogar, sjöar och öar. Landet har en kung som heter Carl Gustaf.",
    question: "Vad heter Sveriges huvudstad?",
    options: ["Göteborg", "Stockholm", "Malmö"],
    answer: 1,
  },
  {
    passage: "Vattnets kretslopp börjar när solen värmer upp vatten från hav och sjöar så att det avdunstar och blir vattenånga. Vattenångan stiger uppåt, kyls ner och bildar moln. När molnen blir för tunga faller vattnet ner som regn eller snö.",
    question: "Vad bildas när vattenånga kyls ner?",
    options: ["Regn", "Moln", "Is"],
    answer: 1,
  },
  {
    passage: "Vikingarna levde i Skandinavien för ungefär tusen år sedan. De var skickliga sjöfarare och byggde starka skepp som kallades långskepp. Vikingarna reste till många länder i Europa och handlade med varor som pälsar och vapen.",
    question: "Vad kallades vikingarnas skepp?",
    options: ["Långskepp", "Krigsskepp", "Segelbåtar"],
    answer: 0,
  },
  {
    passage: "Människan har fem sinnen: syn, hörsel, lukt, smak och känsel. Ögonen används för att se och öronen för att höra. Näsan hjälper oss att lukta och tungan att smaka. Huden över hela kroppen ger oss känsel.",
    question: "Hur många sinnen har människan?",
    options: ["Tre", "Fyra", "Fem"],
    answer: 2,
  },
  {
    passage: "Träd är växter som kan bli mycket gamla och stora. De har en stam av trä, grenar, löv och rötter som förankrar dem i marken. Träd producerar syre som vi människor behöver för att andas och de ger oss skugga under varma dagar.",
    question: "Vad producerar träd som vi behöver?",
    options: ["Koldioxid", "Syre", "Kväve"],
    answer: 1,
  },
  {
    passage: "Månen är jordens enda naturliga satellit. Den kretsar runt jorden och det tar ungefär 27 dagar för ett varv. Månens yta är täckt av kratrar och saknar atmosfär, vilket betyder att det inte finns någon luft eller något vatten där.",
    question: "Hur lång tid tar det för månen att kretsa runt jorden?",
    options: ["27 dagar", "365 dagar", "7 dagar"],
    answer: 0,
  },
  {
    passage: "Planeten Mars kallas för den röda planeten på grund av sitt rödaktiga utseende. Mars har två små månar som heter Phobos och Deimos. Forskare har skickat flera rymdsonder till Mars för att undersöka om det någonsin har funnits liv där.",
    question: "Varför kallas Mars för den röda planeten?",
    options: ["För att den är täckt av eld", "För att den har ett rödaktigt utseende", "För att den är gjord av sten"],
    answer: 1,
  },
  {
    passage: "Dinosaurier levde på jorden för miljoner år sedan. Den största dinosaurien var Argentinosaurus som kunde bli över 30 meter lång. Dinosaurierna dog ut för cirka 65 miljoner år sedan, troligen på grund av att en stor meteorit träffade jorden.",
    question: "Vad var Argentinosaurus?",
    options: ["En flygande ödla", "Den största dinosaurien", "En dinosaurie som levde i vatten"],
    answer: 1,
  },
  {
    passage: "Bin är mycket viktiga för naturen. När bin flyger från blomma till blomma samlar de nektar och pollen. På vägen pollinerar de blommorna, vilket gör att växter kan bilda frukter och frön. Utan bin skulle vi inte ha så mycket mat.",
    question: "Varför är bin viktiga?",
    options: ["För att de gör honung", "För att de pollinerar blommor", "För att de äter bladlöss"],
    answer: 1,
  },
  {
    passage: "Pingviner är fåglar som inte kan flyga. De lever på sydpolen och i kalla havområden. Pingviner har en tjock fjäderdräkt och ett lager av fett som håller dem varma i det iskalla vattnet. De är utmärkta simmare och jagar fisk och bläckfisk.",
    question: "Var lever pingviner främst?",
    options: ["På nordpolen", "På sydpolen", "I regnskogen"],
    answer: 1,
  },
  {
    passage: "Skelettet är det som håller kroppen upprätt. En vuxen människa har 206 ben i kroppen. Skelettet skyddar också viktiga organ som hjärnan och hjärtat. Utan skelettet skulle vi bara vara en stor klump med muskler och hud.",
    question: "Hur många ben har en vuxen människa?",
    options: ["106", "206", "306"],
    answer: 1,
  },
  {
    passage: "Regnskogen är en av de viktigaste platserna på jorden. Den täcker bara 6 procent av jordens yta men här bor mer än hälften av alla djur- och växtarter. Regnskogen kallas ofta för jordens lungor eftersom den producerar mycket syre.",
    question: "Varför kallas regnskogen för jordens lungor?",
    options: ["För att den är stor", "För att den producerar syre", "För att den andas"],
    answer: 1,
  },
  {
    passage: "Jordens inre består av flera lager. Det innersta lagret kallas för den inre kärnan och den består av fast järn och nickel. Temperaturen i den inre kärnan är ungefär lika varm som solens yta, cirka 5500 grader.",
    question: "Vad består jordens inre kärna av?",
    options: ["Gas och vätska", "Fast järn och nickel", "Sand och sten"],
    answer: 1,
  },
  {
    passage: "Pyramiderna i Egypten är enorma gravmonument som byggdes för flera tusen år sedan. Den största pyramiden kallas Cheopspyramiden och den är byggd av över 2 miljoner stenblock. Pyramiderna byggdes som gravar åt faraonerna, som var Egyptens kungar.",
    question: "Varför byggdes pyramiderna?",
    options: ["Som tempel", "Som gravar åt faraonerna", "Som observatorier"],
    answer: 1,
  },
  {
    passage: "Kameleonter är ödlor som har en otrolig förmåga att ändra färg. De gör detta för att signalera till andra kameleonter och för att kamouflera sig. Kameleonternas ögon kan röra sig oberoende av varandra, så de kan titta åt två håll samtidigt.",
    question: "Varför ändrar kameleonter färg?",
    options: ["För att signalera och kamouflera sig", "Bara för att de blir glada", "För att locka till sig mat"],
    answer: 0,
  },
  {
    passage: "Åska uppstår när varm och kall luft möts. I molnet bildas elektriska laddningar som till slut urladdas som en blixt. Åskan hörs eftersom luften runt blixten värms upp snabbt och expanderar med en kraftig smäll. Man kan räkna sekunderna mellan blixt och åska för att veta hur långt bort ovädret är.",
    question: "Varför hörs åska efter en blixt?",
    options: ["För att regnet kommer", "För att luften expanderar snabbt", "För att molnen krockar"],
    answer: 1,
  },
  {
    passage: "Katter har mycket bra balans och kan nästan alltid landa på fötterna när de faller. Det beror på att katter har en extremt flexibel ryggrad och ett speciellt balansorgan i innerörat. De kan vrida kroppen i luften på ett sätt som få andra djur kan.",
    question: "Varför kan katter nästan alltid landa på fötterna?",
    options: ["För att de har mjuka tassar", "För att de har flexibel ryggrad och bra balans", "För att de är lätta"],
    answer: 1,
  },
];

var characterState = { ...DEFAULT_CHARACTER_STATE };
var currentCharacter = null;
function setCurrentCharacter(name) { currentCharacter = name; }

var resources = { emeralds: 0, diamonds: 0, rubies: 0 };
var ownedBrainrots = new Set();
var ownedPixelPets = new Set();
var activePixelPet = null;
var pixelPetItems = [
  { id: "kodkub", name: "Kodkub", symbol: "{}", description: "Studsar bredvid dig och firar smarta svar.", rubyCost: 6 },
  { id: "minirobot", name: "Minirobot", symbol: "01", description: "En liten labbhjälpare som följer varje steg.", rubyCost: 8 },
  { id: "gnistdronare", name: "Gnistdrönare", symbol: "*", description: "Svävar efter dig med ett mjukt rubinsken.", rubyCost: 12 },
];
var DEFAULT_LEARNING_PROGRESS = {
  math: { level: 1, recent: [], answered: [] },
  reading: { level: 1, recent: [], answered: [] },
  logic: { level: 1, recent: [], answered: [] },
};
var learningProgress = {
  math: { level: 1, recent: [], answered: [] },
  reading: { level: 1, recent: [], answered: [] },
  logic: { level: 1, recent: [], answered: [] },
};

var gameUI = {
  nearStore: false,
  nearLab: false,
  shopOpen: false,
  labOpen: false,
  inventoryOpen: false,
  gamePaused: false,
  lockTransition: false,
  pointerLocked: false,
};
