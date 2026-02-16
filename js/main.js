import { state, categories, categoryLabels } from "./state.js";
import { 
  setupBoard, 
  movePlayer, 
  getCurrentCell, 
  getCellByPosition,
  getMaxPosition,
  positionPlayer   // 👈 add this
} from "./board.js";

import { playSound } from "./sound.js";
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

/* =========================
   INIT
========================= */

window.addEventListener("DOMContentLoaded", init);

function init() {
  setupBoard(board);
  setupEventListeners();
  loadQuestions();

    window.addEventListener("resize", () => {
    setupBoard(board);
  });
  renderPlayerBar();
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
  addPlayerBtn.addEventListener("click", handleAddPlayer);
removePlayerBtn.addEventListener("click", handleRemovePlayer);
  rollDiceButton.addEventListener("click", handleDiceRoll);
  restartButton.addEventListener("click", resetGame);
  restartSideButton.addEventListener("click", resetGame);
toggleEditorBtn.addEventListener("click", () => {
  editor.classList.remove("hidden");
  settingsMenu.classList.add("hidden");
  document.body.classList.add("lock-scroll"); // 🔥 add this
});
  settingsToggle.addEventListener("click", () => {
  settingsMenu.classList.toggle("hidden");});
  addQuestionBtn.addEventListener("click", handleAddQuestion);
  exportBtn.addEventListener("click", exportQuestions);
  debugToggle.addEventListener("click", toggleDebugMode);
  skipQuestionBtn.addEventListener("click", handleSkipQuestion);

}

async function loadQuestions() {
  const categoryFiles = ["film", "science", "general", "history"];

  const loaded = await Promise.all(
    categoryFiles.map(cat =>
      fetch(`data/${cat}.json`)
        .then(res => res.json())
        .then(data => data.map(q => ({ ...q, category: cat })))
    )
  );

  state.questions = loaded.flat();
  renderQuestionList();
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

function processRoll(roll) {

  const currentCell = getCurrentCell();

  let category = categories.find(cat =>
    currentCell.classList.contains(cat)
  );

  // 🎲 If on START, pick random category
  if (!category) {
    category = categories[Math.floor(Math.random() * categories.length)];
    console.log("Start square — random category:", category);
  }

  console.log("Question category:", category);
  console.log("Roll difficulty:", roll);

  const question = getQuestion(category, roll);

  if (!question) {
    console.log("No matching question found.");
    unlockTurn();
    return;
  }

  showQuestion(question, roll);
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

function handleAnswer(index) {
  const correct = index === state.activeQuestion.correctIndex;
document.body.classList.add("lock-scroll");
  feedbackDiv.textContent = correct ? "Correct!" : "Incorrect";
  feedbackDiv.className = correct ? "correct" : "incorrect";

  setTimeout(() => {
    modal.classList.add("hidden");
      document.body.classList.remove("lock-scroll"); // 🔥 ADD THIS

    if (correct) movePlayer(state.pendingMove);

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

  // 🔁 Switch turn
  state.currentPlayerIndex =
    (state.currentPlayerIndex + 1) % state.players.length;

  
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