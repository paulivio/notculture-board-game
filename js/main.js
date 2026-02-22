console.log("🔥🔥🔥 MAIN JS VERSION 2 LOADED 🔥🔥🔥");
console.log("TOP OF FILE")


import { db, ref, set, update, get, onValue } from "./firebase.js";
import { state, categories, categoryLabels } from "./state.js";
import { 
  setupBoard, 
  movePlayer, 
  getCurrentCell, 
  getCellByPosition,
  getMaxPosition,
  positionPlayer
} from "./board.js";
import { playSound } from "./sound.js";

state.activePlayerKey = null;
let lastProcessedRollId = null;
let unsubscribeRoomListener = null;
/* =========================
   FIREBASE TEST
========================= */
window.testFirebase = async () => {
  console.log("🔥 NEW VERSION RUNNING 🔥");

  try {
    await set(ref(db, "testConnection"), {
      message: "NEW VERSION",
      timestamp: Date.now()
    });

    console.log("Firebase write SUCCESS ✅");
  } catch (err) {
    console.error("Firebase write FAILED ❌", err);
  }
};

window.leaveRoom = async () => {

  if (!window.currentRoomCode || !window.myPlayerId) {
    localStorage.clear();
    location.reload();
    return;
  }

  const roomRef = ref(db, `rooms/${window.currentRoomCode}`);

  const snapshot = await get(roomRef);

  if (snapshot.exists()) {

    const roomData = snapshot.val();
    const players = roomData.players || {};
    const playerOrder = roomData.playerOrder || [];

    // Remove player from Firebase
    delete players[window.myPlayerId];

    const newOrder = playerOrder.filter(
      id => id !== window.myPlayerId
    );

    await update(roomRef, {
      players: players,
      playerOrder: newOrder
    });
  }

  // Stop listening to room updates
  if (unsubscribeRoomListener) {
    unsubscribeRoomListener();
    unsubscribeRoomListener = null;
  }

  // Clear local identity
  localStorage.removeItem("notculture_roomCode");
  localStorage.removeItem("notculture_playerId");
  localStorage.removeItem("notculture_playerName");

  location.reload();
};

window.updatePlayerPosition = async (roomCode, playerIndex, steps) => {
  const roomRef = ref(db, `rooms/${roomCode}`);
  const snapshot = await get(roomRef);

  if (!snapshot.exists()) return;

  const roomData = snapshot.val();
  const players = roomData.players || {};

  const playerKeys = Object.keys(players);
  const targetKey = playerKeys[playerIndex];

  if (!targetKey) return;

  const currentPosition = players[targetKey].position || 0;
  const newPosition = currentPosition + steps;

  await update(ref(db, `rooms/${roomCode}/players/${targetKey}`), {
    position: newPosition
  });
};

window.updateTurn = async (roomCode) => {

  const roomRef = ref(db, `rooms/${roomCode}`);
  const snapshot = await get(roomRef);

  if (!snapshot.exists()) return;

  const roomData = snapshot.val();

  const playerOrder = roomData.playerOrder || [];
  const currentIndex = roomData.currentPlayerIndex || 0;

  if (playerOrder.length === 0) return;

  const nextIndex = (currentIndex + 1) % playerOrder.length;

  await update(roomRef, {
    currentPlayerIndex: nextIndex
  });
};


window.rollDiceMultiplayer = async (roomCode) => {
  const roomRef = ref(db, `rooms/${roomCode}`);
  const snapshot = await get(roomRef);

  if (!snapshot.exists()) return;

  const roomData = snapshot.val();
  const players = Object.keys(roomData.players || {});
  const activeIndex = roomData.currentPlayerIndex || 0;
  const activePlayerKey = players[activeIndex];

  // 🚫 If I am not the active player → do nothing
  if (window.myPlayerId !== activePlayerKey) {
    console.log("Not your turn.");
    return;
  }

  const roll = Math.floor(Math.random() * 6) + 1;

  await update(roomRef, {
    currentRoll: {
      value: roll,
      id: Date.now()
    }
  });
};
/*============================
Create Room function
========================*/
  
window.resetRoom = async (roomCode) => {
  const roomRef = ref(db, `rooms/${roomCode}`);

  await set(roomRef, {
    players: null,
    currentPlayerIndex: 0,
    currentRoll: null,
    gameState: "waiting"
  });

  console.log("Room reset:", roomCode);
};


function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

window.createRoom = async () => {
  const roomCode = generateRoomCode();

  await set(ref(db, `rooms/${roomCode}`), {
    players: null,
    currentPlayerIndex: 0,
    gameState: "waiting"
  });

  console.log("Room created:", roomCode);
};

/*============================
Join room function
========================*/


window.joinRoom = async (roomCode, playerName) => {

  const roomRef = ref(db, `rooms/${roomCode}`);
  const snapshot = await get(roomRef);

  if (!snapshot.exists()) {
    console.log("Room does not exist.");
    return;
  }

  const roomData = snapshot.val();

let playerId = localStorage.getItem("notculture_playerId");

if (!playerId) {
  playerId = Date.now().toString();
  localStorage.setItem("notculture_playerId", playerId);
}

  // Store locally who I am
  window.myPlayerId = playerId;
  window.myPlayerName = playerName;
  window.currentRoomCode = roomCode;

const existingPlayers = roomData.players || {};
const existingOrder = roomData.playerOrder || [];

// If player already exists → just reconnect
if (existingPlayers[playerId]) {

  console.log("Reconnected as existing player:", playerId);

} else {

  await update(roomRef, {
    [`players/${playerId}`]: {
      id: playerId,
      name: playerName,
      position: 0
    },
    playerOrder: [...existingOrder, playerId]
  });


  console.log("Joined room:", roomCode);
};

}


/* =========================
   DOM REFERENCES
========================= */
const playerColors = {
  1: "red",
  2: "blue",
  3: "yellow",
  4: "purple"
};  
const board = document.getElementById("board");
const rollDiceButton = document.getElementById("rollDice");
const diceImage = document.getElementById("diceImage");

const restartSideButton = document.getElementById("restartSide");

const addPlayerBtn = document.getElementById("addPlayer");
const removePlayerBtn = document.getElementById("removePlayer");
const playerCountDisplay = document.getElementById("playerCount");

const modal = document.getElementById("modal");
const questionText = document.getElementById("questionText");
const answersDiv = document.getElementById("answers");
const feedbackDiv = document.getElementById("feedback");
const questionCategory = document.getElementById("questionCategory");
const questionDifficulty = document.getElementById("questionDifficulty");

const turnIndicator = document.getElementById("turnIndicator");

const settingsToggle = document.getElementById("settingsToggle");
const settingsMenu = document.getElementById("settingsMenu");

const debugToggle = document.getElementById("debugToggle");
const skipQuestionBtn = document.getElementById("skipQuestion");

const winModal = document.getElementById("winModal");
const restartButton = document.getElementById("restartGame");
const closeEditorBtn = document.getElementById("closeEditor");

closeEditorBtn.addEventListener("click", () => {
  editor.classList.add("hidden");
   document.body.classList.remove("lock-scroll"); // 🔥 add this
});

const toggleEditorBtn = document.getElementById("toggleEditor");
const editor = document.getElementById("questionEditor");
const questionListDiv = document.getElementById("questionList");

const qText = document.getElementById("qe-question");
const qCategory = document.getElementById("qe-category");
const qDifficulty = document.getElementById("qe-difficulty");
const answersInputs = [
  document.getElementById("qe-a0"),
  document.getElementById("qe-a1"),
  document.getElementById("qe-a2"),
  document.getElementById("qe-a3")
];
const qCorrect = document.getElementById("qe-correct");

const addQuestionBtn = document.getElementById("addQuestion");
const exportBtn = document.getElementById("exportQuestions");

console.log("About to define Listentoroom")

function listenToRoom (roomCode) {

  const roomRef = ref(db, `rooms/${roomCode}`);

 unsubscribeRoomListener = onValue(roomRef, async (snapshot) => {
    const roomData = snapshot.val();
    
    if (!roomData) return;

    console.log("Room updated:", roomData);

    /* Sync Players */

    const firebasePlayers = roomData.players || {};
    const playerKeys = roomData.playerOrder || [];
    const activeIndex = roomData.currentPlayerIndex || 0;
    const activePlayerKey = playerKeys[activeIndex];
    state.activePlayerKey = activePlayerKey;

    rollDiceButton.disabled = window.myPlayerId !== activePlayerKey;

    const playersArray = Object.values(firebasePlayers);

const previousPlayers = state.players;

state.players = playersArray.map((p, index) => ({
  id: index + 1,
  name: p.name,
  position: p.position
}));

renderPlayerBar();

const board = document.getElementById("board");

state.players.forEach((player, i) => {

  let token = document.querySelector(`.player-${player.id}`);

  if (!token) {
    token = document.createElement("div");
    token.classList.add("player");
    token.classList.add(`player-${player.id}`);
    board.appendChild(token);

    // Only position instantly when first created
    positionPlayer(player.position, player.id);
    return;
  }

  const previous = previousPlayers[i];

  if (previous && player.position > previous.position) {

    animateOnlineMove(
      player.id,
      previous.position,
      player.position - previous.position
    );

  }

});
    state.currentPlayerIndex = activeIndex;

    // 🔥 Reset local turn lock when turn changes
state.isTurnLocked = false;
rollDiceButton.disabled = window.myPlayerId !== activePlayerKey;

renderPlayerBar();

    /* Handle Roll */

if (
  roomData.currentRoll &&
  window.myPlayerId === activePlayerKey
) {

  const { value, id } = roomData.currentRoll;

  if (id !== lastProcessedRollId) {

    lastProcessedRollId = id;

    console.log("Roll received:", value);
    console.log("My ID:", window.myPlayerId);
    console.log("Active ID:", activePlayerKey);

    simulateOnlineRoll(value);
  }
}

// 🔥 Reset roll tracking when cleared
if (!roomData.currentRoll) {
  lastProcessedRollId = null;
}
      
/* Handle Question */

if (roomData.currentQuestion) {

  if (!state.questionsLoaded) {
    console.log("Questions not loaded yet. Waiting...");
    return;
  }

  const question = state.questions.find(
    q => q.id === roomData.currentQuestion
  );

  if (!question) {
    console.error("Question not found in local pool:", roomData.currentQuestion);
    return;
  }

 const rollValue = roomData.currentRoll?.value ?? state.pendingMove;
showQuestion(question, rollValue);
}

 else {
  // If question cleared → close modal
  modal.classList.add("hidden");
}
  }); // end onValue

}; // end listenToRoom


console.log("listenToRoom defined");
/* =========================
   INIT
========================= */

window.addEventListener("DOMContentLoaded", init);

async function init() {

const savedRoom = localStorage.getItem("notculture_roomCode");
const savedPlayerId = localStorage.getItem("notculture_playerId");
const savedPlayerName = localStorage.getItem("notculture_playerName");

if (savedRoom && savedPlayerId && savedPlayerName) {

  try {
    console.log("Attempting reconnect...");

    window.currentRoomCode = savedRoom;
    window.myPlayerId = savedPlayerId;
    window.myPlayerName = savedPlayerName;

    await joinRoom(savedRoom, savedPlayerName);
    listenToRoom(savedRoom);

  } catch (err) {
    console.log("Reconnect failed, clearing saved session.");
    localStorage.removeItem("notculture_roomCode");
    localStorage.removeItem("notculture_playerId");
    localStorage.removeItem("notculture_playerName");
  }
}

  setupBoard(board);
  setupEventListeners();
  loadQuestions();

    window.addEventListener("resize", () => {
    setupBoard(board);
  });
  renderPlayerBar();

const localModeBtn = document.getElementById("localModeBtn");
const onlineModeBtn = document.getElementById("onlineModeBtn");
const localControls = document.getElementById("localControls");
const onlineControls = document.getElementById("onlineControls");

window.gameMode = "local";

// Default state
localControls.classList.remove("hidden");
onlineControls.classList.add("hidden");

localModeBtn.addEventListener("click", () => {
  window.gameMode = "local";
  localControls.classList.remove("hidden");
  onlineControls.classList.add("hidden");
});

onlineModeBtn.addEventListener("click", () => {
  window.gameMode = "online";
  localControls.classList.add("hidden");
  onlineControls.classList.remove("hidden");
});


const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const roomCodeInput = document.getElementById("roomCodeInput");
const playerNameInput = document.getElementById("playerNameInput");
const createdRoomDisplay = document.getElementById("createdRoomDisplay");

createRoomBtn.addEventListener("click", async () => {

  const playerName = playerNameInput.value.trim();

  if (!playerName) {
    alert("Enter your name first.");
    return;
  }

  const roomCode = generateRoomCode();

  const playerId = Date.now().toString();

  // Save identity
  localStorage.setItem("notculture_playerId", playerId);
  localStorage.setItem("notculture_playerName", playerName);
  localStorage.setItem("notculture_roomCode", roomCode);

  window.myPlayerId = playerId;
  window.myPlayerName = playerName;
  window.currentRoomCode = roomCode;

  // Create room WITH first player already inside
  await set(ref(db, `rooms/${roomCode}`), {
    players: {
      [playerId]: {
        id: playerId,
        name: playerName,
        position: 0
      }
    },
    playerOrder: [playerId],
    currentPlayerIndex: 0,
    currentRoll: null,
    gameState: "waiting"
  });

  createdRoomDisplay.textContent = `Room Code: ${roomCode}`;

  listenToRoom(roomCode);
});
}



/* =========================
   DATA
========================= */



function validateQuestions(questionList) {
  return questionList.filter(q =>
    categories.includes(q.category) &&
    Number.isInteger(q.difficulty) &&
    q.difficulty >= 1 &&
    q.difficulty <= 6 &&
    Array.isArray(q.answers) &&
    q.answers.length === 4 &&
    q.correctIndex >= 0 &&
    q.correctIndex < 4
  );
}

/* =========================
   EVENTS
========================= */

function setupEventListeners() {

  const addPlayerBtn = document.getElementById("addPlayer");
  const removePlayerBtn = document.getElementById("removePlayer");
  const rollDiceButton = document.getElementById("rollDice");
  const restartButton = document.getElementById("restartGame");
  const restartSideButton = document.getElementById("restartSide");
  const toggleEditorBtn = document.getElementById("toggleEditor");
  const settingsToggle = document.getElementById("settingsToggle");
  const addQuestionBtn = document.getElementById("addQuestion");
  const exportBtn = document.getElementById("exportQuestions");
  const debugToggle = document.getElementById("debugToggle");
  const skipQuestionBtn = document.getElementById("skipQuestion");

  addPlayerBtn?.addEventListener("click", handleAddPlayer);
  removePlayerBtn?.addEventListener("click", handleRemovePlayer);

  rollDiceButton?.addEventListener("click", () => {
    if (window.gameMode === "online") {
      if (!window.currentRoomCode) return;
      rollDiceMultiplayer(window.currentRoomCode);
    } else {
      handleDiceRoll();
    }
  });

  restartButton?.addEventListener("click", resetGame);
  restartSideButton?.addEventListener("click", resetGame);

  toggleEditorBtn?.addEventListener("click", () => {
    editor.classList.remove("hidden");
    settingsMenu.classList.add("hidden");
    document.body.classList.add("lock-scroll");
  });

  settingsToggle?.addEventListener("click", () => {
    settingsMenu.classList.toggle("hidden");
  });

  addQuestionBtn?.addEventListener("click", handleAddQuestion);
  exportBtn?.addEventListener("click", exportQuestions);
  debugToggle?.addEventListener("click", toggleDebugMode);
  skipQuestionBtn?.addEventListener("click", handleSkipQuestion);
}

async function loadQuestions() {

  const categoryFiles = ["film", "science", "general", "history"];

  try {

    const loaded = await Promise.all(
      categoryFiles.map(async cat => {
        const res = await fetch(`data/${cat}.json`);

        if (!res.ok) {
          console.error(`Failed to load ${cat}.json`);
          return [];
        }

        const data = await res.json();
        return data.map(q => ({ ...q, category: cat }));
      })
    );

    state.questions = loaded.flat();
    state.questionsLoaded = true;

    console.log("Questions loaded:", state.questions.length);

    renderQuestionList();

  } catch (err) {
    console.error("Error loading questions:", err);
    state.questions = [];
  }
}


function toggleDebugMode() {
  state.debugMode = !state.debugMode;

  console.log("Debug mode:", state.debugMode);

  setupBoard(board); // re-render board to show/hide numbers
}
/* =========================
   GAME LOGIC
========================= */

function handleDiceRoll() {
  if (state.isTurnLocked) return;

  playSound("dice");

  state.isTurnLocked = true;
  rollDiceButton.disabled = true;

  const roll = Math.floor(Math.random() * 6) + 1;

  // 🔥 DEBUG MODE: skip animation + pause
  if (state.debugMode) {
    diceImage.src = `assets/dice/dice-${roll}.png`;
    processRoll(roll); // go straight to logic
    return;
  }

  // 🎲 Normal animated roll
  let flashes = 0;
  let delay = 80;

  function animateRoll() {
    const randomFace = Math.floor(Math.random() * 6) + 1;
    diceImage.src = `assets/dice/dice-${randomFace}.png`;

    const rotation = Math.random() * 30 - 15;
    diceImage.style.transform = `rotate(${rotation}deg)`;

    flashes++;

    if (flashes < 12) {
      delay += 15;
      setTimeout(animateRoll, delay);
    } else {
      diceImage.style.transform = "rotate(0deg)";
      diceImage.src = `assets/dice/dice-${roll}.png`;

      setTimeout(() => {
        processRoll(roll);
      }, 800);
    }
  }

  animateRoll();
}

function simulateOnlineRoll(roll) {

  if (state.isTurnLocked) return;

  state.isTurnLocked = true;
  rollDiceButton.disabled = true;

  playSound("dice");

  if (state.debugMode) {
    diceImage.src = `assets/dice/dice-${roll}.png`;
    processRoll(roll);
    return;
  }

  let flashes = 0;
  let delay = 80;

  function animateRoll() {
    const randomFace = Math.floor(Math.random() * 6) + 1;
    diceImage.src = `assets/dice/dice-${randomFace}.png`;

    const rotation = Math.random() * 30 - 15;
    diceImage.style.transform = `rotate(${rotation}deg)`;

    flashes++;

    if (flashes < 12) {
      delay += 15;
      setTimeout(animateRoll, delay);
    } else {
      diceImage.style.transform = "rotate(0deg)";
      diceImage.src = `assets/dice/dice-${roll}.png`;

      setTimeout(() => {
        processRoll(roll);
      }, 800);
    }
  }

  animateRoll();
}

function processRoll(roll) {

  const currentCell = getCurrentCell();

  let category = categories.find(cat =>
    currentCell.classList.contains(cat)
  );

  if (!category) {
    category = categories[Math.floor(Math.random() * categories.length)];
  }

  state.pendingMove = roll;
  state.pendingCategory = category;

  console.log("Question category:", category);
  console.log("Roll difficulty:", roll);

  // ✅ ONLINE MODE: active player selects question here
  if (window.gameMode === "online") {

    if (window.myPlayerId === state.activePlayerKey) {

      const question = getQuestion(category, roll);

      if (!question) {
        console.error("No question found for:", category, roll);
        return;
      }

      const roomRef = ref(db, `rooms/${window.currentRoomCode}`);

      update(roomRef, {
        currentQuestion: question.id
      });

    }

  } else {
    // LOCAL MODE
    const question = getQuestion(category, roll);
    if (question) {
      showQuestion(question, roll);
    }
  }
}
 

function animateOnlineMove(playerId, startPosition, steps) {

  const MOVE_DURATION = 500;
  let current = startPosition;
  let movesRemaining = steps;

  function step() {

    if (movesRemaining <= 0) return;

    playSound("move");

    current++;
    positionPlayer(current, playerId);

    movesRemaining--;

    setTimeout(step, MOVE_DURATION);
  }

  step();
}

function getQuestion(category, difficulty) {

  // All matching questions
  const matching = state.questions.filter(q =>
    q.category === category &&
    q.difficulty === difficulty
  );

  if (matching.length === 0) {
    return null;
  }

  // Filter out already used questions
  const unused = matching.filter(q =>
    !state.usedQuestionIds.has(q.id)
  );

  // If all used, reset only this subset
  const pool = unused.length > 0 ? unused : matching;

  if (unused.length === 0) {
    console.log("Resetting question pool for", category, difficulty);
    matching.forEach(q => state.usedQuestionIds.delete(q.id));
  }

  // Pick random question
  const randomIndex = Math.floor(Math.random() * pool.length);
  const selected = pool[randomIndex];

  // Mark as used
  state.usedQuestionIds.add(selected.id);

  return selected;
}

function showQuestion(question, roll) {
  state.activeQuestion = question;
  state.pendingMove = roll;
document.body.classList.add("lock-scroll");
  questionCategory.textContent = categoryLabels[question.category];
  questionCategory.className = `category-${question.category}`;

  questionDifficulty.textContent =
    "★".repeat(question.difficulty) +
    "☆".repeat(6 - question.difficulty);

  questionText.textContent = question.question;
  answersDiv.innerHTML = "";
  feedbackDiv.textContent = "";

  if (state.debugMode) {
  skipQuestionBtn.classList.remove("hidden");
} else {
  skipQuestionBtn.classList.add("hidden");
}

  question.answers.forEach((answer, index) => {
    const btn = document.createElement("button");
    btn.textContent = answer;
    btn.onclick = () => handleAnswer(index);
    answersDiv.appendChild(btn);
  });

  modal.classList.remove("hidden");
  document.body.classList.add("lock-scroll");
}

async function handleAnswer(index) {

  // 🔒 Online safety: only active player can answer
  if (window.gameMode === "online") {
    if (window.myPlayerId !== state.activePlayerKey) return;
  }

  const correct = index === state.activeQuestion.correctIndex;

  document.body.classList.add("lock-scroll");

  feedbackDiv.textContent = correct ? "Correct!" : "Incorrect";
  feedbackDiv.className = correct ? "correct" : "incorrect";

  setTimeout(async () => {

    modal.classList.add("hidden");
    document.body.classList.remove("lock-scroll");

    if (window.gameMode === "online") {

      const roomRef = ref(db, `rooms/${window.currentRoomCode}`);

      // ✅ Move ONLY if correct
      if (correct) {
        await updatePlayerPosition(
          window.currentRoomCode,
          state.currentPlayerIndex,
          state.pendingMove
        );
      }

    const snapshot = await get(roomRef);
const roomData = snapshot.val();

const nextIndex =
  (roomData.currentPlayerIndex + 1) %
  roomData.playerOrder.length;

await update(roomRef, {
  currentQuestion: null,
  currentRoll: null,
  currentPlayerIndex: nextIndex
});

    } else {

      // Local mode logic
      if (correct) {
        movePlayer(state.pendingMove);
      }

      state.currentPlayerIndex =
        (state.currentPlayerIndex + 1) % state.players.length;
    }

    state.pendingMove = 0;
    unlockTurn();

  }, 1200);
}



function handleAddPlayer() {
  if (state.players.length >= state.maxPlayers) return;

  const newId = state.players.length + 1;

  state.players.push({
    id: newId,
    name: `Player ${newId}`,
    position: 0
  });

  updatePlayerUI();
  renderPlayerBar();
  setupBoard(board);
}
function handleRemovePlayer() {
  if (state.players.length <= state.minPlayers) return;

  state.players.pop();

  if (state.currentPlayerIndex >= state.players.length) {
    state.currentPlayerIndex = 0;
  }

  updatePlayerUI();
  renderPlayerBar();
  setupBoard(board);
}

function updatePlayerUI() {
  playerCountDisplay.textContent =
    `${state.players.length} Player${state.players.length > 1 ? "s" : ""}`;
}

function unlockTurn() {
 
  state.activeQuestion = null;
  state.pendingMove = 0;
  state.isTurnLocked = false;
  rollDiceButton.disabled = false;

  renderPlayerBar();
}
function resetGame() {

  // Reset all player positions
  state.players.forEach(player => {
    player.position = 0;
  });

  // Reset turn to Player 1
  state.currentPlayerIndex = 0;

  // Reset question state
  state.activeQuestion = null;
  state.pendingMove = 0;
  state.isTurnLocked = false;
  state.usedQuestionIds.clear();

  rollDiceButton.disabled = false;

  modal.classList.add("hidden");
  winModal.classList.add("hidden");

  //Reset Full question pool
  state.usedQuestionIds.clear();

  // Reposition both tokens
  state.players.forEach(player => {
    positionPlayer(player.position, player.id);
  });

  updatePlayerBar();
}

function handleSkipQuestion() {

  document.body.classList.add("lock-scroll");
  if (!state.debugMode) return;

  modal.classList.add("hidden");
  document.body.classList.remove("lock-scroll"); // 🔥 ADD THIS

  movePlayer(state.pendingMove);
  unlockTurn();
}

/* =========================
   EDITOR
========================= */


function renderQuestionList() {

  const questionListDiv = document.getElementById("questionList");

  if (!questionListDiv) return;

  questionListDiv.innerHTML = "";

  
  questionListDiv.innerHTML = "";

  const categories = ["film", "science", "general", "history"];

  categories.forEach(cat => {

    const wrapper = document.createElement("div");
    wrapper.className = "category-group";

    const header = document.createElement("div");
    header.className = "category-header";
    header.textContent = cat.toUpperCase();

    const content = document.createElement("div");
    content.className = "category-content hidden";

    header.addEventListener("click", () => {
      content.classList.toggle("hidden");
    });

    const filtered = state.questions
      .filter(q => q.category === cat)
      .sort((a, b) => a.difficulty - b.difficulty);

    filtered.forEach((q, index) => {
      const item = document.createElement("div");
      item.className = "question-item";

      item.innerHTML = `
        <strong>${q.question}</strong>
        <div class="question-meta">
          Difficulty ${q.difficulty}
        </div>
      `;

      const delBtn = document.createElement("button");
      delBtn.textContent = "Delete";
      delBtn.onclick = () => {
        state.questions = state.questions.filter(x => x.id !== q.id);
        renderQuestionList();
      };

      item.appendChild(delBtn);
      content.appendChild(item);
    });

    wrapper.appendChild(header);
    wrapper.appendChild(content);
    questionListDiv.appendChild(wrapper);
  });
}

function handleAddQuestion() {
  const questionTextValue = qText.value.trim();
  const categoryValue = qCategory.value;
  const difficultyValue = Number(qDifficulty.value);
  const answers = answersInputs.map(i => i.value.trim());
  const correctIndex = Number(qCorrect.value);

  // 🔎 Validation

  if (!questionTextValue) {
   const errorDiv = document.getElementById("editorError");
errorDiv.textContent = "Questions text must not be empty.";
return;
  }

  if (answers.some(a => !a)) {
   const errorDiv = document.getElementById("editorError");
errorDiv.textContent = "All answer fields must be filled.";
return;
  }

  if (new Set(answers).size !== answers.length) {
    const errorDiv = document.getElementById("editorError");
errorDiv.textContent = "All answers fields must be unique.";
return;
  }

  if (correctIndex < 0 || correctIndex > 3) {
    const errorDiv = document.getElementById("editorError");
errorDiv.textContent = "Please select a valid correct answer index";
return;
  }

  // ✅ Generate safe ID
  const newQuestion = {
    id: generateQuestionId(categoryValue),
    category: categoryValue,
    difficulty: difficultyValue,
    question: questionTextValue,
    answers,
    correctIndex
  };

  state.questions.push(newQuestion);
  renderQuestionList();

  // Clear inputs
  qText.value = "";
  answersInputs.forEach(i => (i.value = ""));
}

function exportQuestions() {

  const categories = ["film", "science", "general", "history"];

  categories.forEach(cat => {
    const categoryQuestions = state.questions
      .filter(q => q.category === cat)
      .map(({ category, ...rest }) => rest); // remove category field

    const blob = new Blob(
      [JSON.stringify(categoryQuestions, null, 2)],
      { type: "application/json" }
    );

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${cat}.json`;
    link.click();
  });
}

function renderPlayerBar() {
  const playerBar = document.getElementById("playerBar");
  playerBar.innerHTML = "";

  state.players.forEach(player => {
    const chip = document.createElement("div");
    chip.className = "player-chip";


  // Highlight if this browser controls this player
const firebasePlayers = Object.values(state.players);
const myIndex = firebasePlayers.findIndex(p => p.name === window.myPlayerName);

if (player.id === myIndex + 1) {
  chip.style.border = "2px solid #00ffff";
}

    if (player.id === state.players[state.currentPlayerIndex].id) {
      chip.classList.add("active");
    }

    const dot = document.createElement("div");
    dot.className = "player-dot";
    dot.style.background = playerColors[player.id];

   const name = document.createElement("span");
name.textContent = player.name;
name.style.cursor = "pointer";

name.addEventListener("click", () => {
  const newName = prompt("Enter new name:", player.name);
  if (newName && newName.trim() !== "") {
    player.name = newName.trim();
    renderPlayerBar();
  }
});

    chip.appendChild(dot);
    chip.appendChild(name);
    playerBar.appendChild(chip);
  });
}

function syncPlayerTokens() {

  const board = document.getElementById("board");

  state.players.forEach(player => {

    let token = document.querySelector(`.player-${player.id}`);

    if (!token) {
      token = document.createElement("div");
      token.classList.add("player");
      token.classList.add(`player-${player.id}`);
      board.appendChild(token);
    }

    positionPlayer(player.position, player.id);
  });
}



function generateQuestionId(category) {
  const categoryQuestions = state.questions.filter(
    q => q.category === category
  );

  if (categoryQuestions.length === 0) {
    return `${category}-001`;
  }

  const numbers = categoryQuestions.map(q => {
    const parts = q.id.split("-");
    return parseInt(parts[1], 10);
  });

  const maxNumber = Math.max(...numbers);
  const nextNumber = maxNumber + 1;

  return `${category}-${String(nextNumber).padStart(3, "0")}`;
}
