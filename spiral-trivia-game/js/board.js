import { state, categories } from "./state.js";

let cells = [];
let spiralPath = [];

/* =========================
   BOARD SETUP
========================= */

export function setupBoard(boardElement) {

  cells = [];
  boardElement.innerHTML = "";

  const canvas = document.createElement("canvas");
  canvas.id = "pathLayer";
  boardElement.appendChild(canvas);

const logo = document.createElement("img");
logo.src = "assets/logo.png";
logo.classList.add("board-logo");
boardElement.appendChild(logo);

  for (let i = 0; i < 49; i++) {
    const cell = document.createElement("div");
    cell.classList.add("cell");
    cells.push(cell);
    boardElement.appendChild(cell);
  }

  spiralPath = [
    0,1,2,3,4,5,6,
    13,20,27,34,41,48,
    47,46,45,44,43,42,
    35,28,21,14,7,
    8,9,10,11,12,
    19,26,33,40,
    39,38,37,36,
    29,22,15
  ];

cells.forEach(cell => {
  cell.classList.add("inactive");
});

// Now define spiral path styling
spiralPath.forEach((cellIndex, pathIndex) => {
  const cell = cells[cellIndex];

  cell.classList.remove("inactive");

  // 🔗 Mark connected direction
  const nextIndex = spiralPath[pathIndex + 1];

  if (nextIndex !== undefined) {
    const currentRow = Math.floor(cellIndex / 7);
    const currentCol = cellIndex % 7;

    const nextRow = Math.floor(nextIndex / 7);
    const nextCol = nextIndex % 7;

    if (nextRow === currentRow && nextCol === currentCol + 1)
      cell.classList.add("connect-right");

    if (nextRow === currentRow && nextCol === currentCol - 1)
      cell.classList.add("connect-left");

    if (nextCol === currentCol && nextRow === currentRow + 1)
      cell.classList.add("connect-down");

    if (nextCol === currentCol && nextRow === currentRow - 1)
      cell.classList.add("connect-up");
  }

  // START square
  if (pathIndex === 0) {
    cell.classList.add("start");
    cell.textContent = "START";
    return;
  }

  // FINISH square
  if (pathIndex === spiralPath.length - 1) {
    cell.classList.add("finish");
    cell.textContent = "FINISH";
    return;
  }

  // Category assignment
  const category = categories[pathIndex % categories.length];
  cell.classList.add(category);

  if (state.debugMode) {
    cell.textContent = pathIndex;
  }

  drawSpiralPath(boardElement);
});



  
state.players.forEach(playerData => {
  const token = document.createElement("div");
  token.classList.add("player");
  token.classList.add(`player-${playerData.id}`);
  boardElement.appendChild(token);
  positionPlayer(playerData.position, playerData.id);
});
}

/* =========================
   MOVEMENT
========================= */

export function movePlayer(steps) {
  const currentPlayer = state.players[state.currentPlayerIndex];
  const maxPosition = spiralPath.length - 1;

  let movesRemaining = steps;

  function stepMove() {
    if (movesRemaining <= 0) {

      // 🏁 Win check
      if (currentPlayer.position === maxPosition) {
        document.getElementById("winModal").classList.remove("hidden");
      }

      return;
    }

    if (currentPlayer.position < maxPosition) {
      currentPlayer.position++;
      positionPlayer(currentPlayer.position, currentPlayer.id);
    }

    movesRemaining--;
    setTimeout(stepMove, 200);
  }

  stepMove();
}

export function positionPlayer(position, playerId) {
  const cellIndex = spiralPath[position];
  const cell = cells[cellIndex];

  const board = document.getElementById("board");
  const boardRect = board.getBoundingClientRect();
  const cellRect = cell.getBoundingClientRect();

  const player = document.querySelector(`.player-${playerId}`);

  if (!player) return; // 🔥 Prevent crash

  let offsetX = 5;
  let offsetY = 5;

  if (playerId === 2) {
    offsetX = 35;
    offsetY = 35;
  }

  player.style.left = (cellRect.left - boardRect.left + offsetX) + "px";
  player.style.top = (cellRect.top - boardRect.top + offsetY) + "px";
}

export function getCurrentCell() {
  const currentPlayer = state.players[state.currentPlayerIndex];
  return cells[spiralPath[currentPlayer.position]];
}

export function getCellByPosition(position) {
  return cells[spiralPath[position]];
}

export function getMaxPosition() {
  return spiralPath.length - 1;
}

function drawSpiralPath(boardElement) {
  const canvas = document.getElementById("pathLayer");
  const ctx = canvas.getContext("2d");

  const rect = boardElement.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
  ctx.lineWidth = 8;
  ctx.lineCap = "round";

  ctx.beginPath();

  spiralPath.forEach((cellIndex, i) => {
    const cell = cells[cellIndex];
    const cellRect = cell.getBoundingClientRect();

    const x = cellRect.left - rect.left + cellRect.width / 2;
    const y = cellRect.top - rect.top + cellRect.height / 2;

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.stroke();
}