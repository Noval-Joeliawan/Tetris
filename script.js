const canvas = document.getElementById("tetris");
const context = canvas.getContext("2d");
context.scale(20, 20);

const canvasNext = document.getElementById("canvas-next");
const contextNext = canvasNext.getContext("2d");
contextNext.scale(20, 20);

const canvasHold = document.getElementById("canvas-hold");
const contextHold = canvasHold.getContext("2d");
contextHold.scale(20, 20);

// Palet Warna Taktil Retro Brick (Menggantikan palet neon lama)
const colors = [
  null,
  { main: "#a855f7", light: "#d8b4fe", dark: "#6b21a8" }, // T - Ungu Retro
  { main: "#eab308", light: "#fef08a", dark: "#a16207" }, // O - Kuning Mustard
  { main: "#f97316", light: "#fdba74", dark: "#c2410c" }, // L - Oranye Taktil
  { main: "#3b82f6", light: "#93c5fd", dark: "#1d4ed8" }, // J - Biru Kobalt
  { main: "#06b6d4", light: "#67e8f9", dark: "#0e7490" }, // I - Cyan Cerah
  { main: "#22c55e", light: "#86efac", dark: "#15803d" }, // S - Hijau Zamrud
  { main: "#ef4444", light: "#fca5a5", dark: "#b91c1c" }, // Z - Merah Koral
];

let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let isPaused = false;
let isGameOver = false;
let gameStarted = false;
let animeFrameId = null;

let holdPieceMatrix = null;
let canHold = true;
let savedHighScore = localStorage.getItem("tetrisNeonHighScore") || 0;

const arena = createMatrix(12, 20);
const player = { pos: { x: 0, y: 0 }, matrix: null, score: 0 };
let nextPiece = createPiece("ILJOTSZ"[(7 * Math.random()) | 0]);

function showPopup(type) {
  const popup = document.getElementById("popup-guide");
  const title = document.getElementById("popup-title");
  const text = document.getElementById("popup-text");

  if (type === "hp") {
    title.innerText = "KONTROL LAYAR HP";
    text.className = "popup-text";
    text.innerHTML = `
            • <strong>◀ / ▶</strong> : Geser Kiri / Kanan<br>
            • <strong>↻ PUTAR</strong> : Putar Balok<br>
            • <strong>▼</strong> : Turun Lebih Cepat<br>
            • <strong>DROP</strong> : Jatuh Instan (Hard Drop)<br>
            • <strong>HOLD</strong> : Simpan Balok Cadangan<br>
            • <strong>JEDA</strong> : Jeda Game / Menu
        `;
  } else {
    title.innerText = "KONTROL KEYBOARD PC";
    text.className = "popup-text pc-text";
    text.innerHTML = `
            • <strong>Panah Kiri / Kanan</strong> : Geser Balok<br>
            • <strong>Panah Atas</strong> : Putar Balok<br>
            • <strong>Panah Bawah</strong> : Turun Cepat<br>
            • <strong>Spasi (SPACE)</strong> : Jatuh Instan<br>
            • <strong>Tombol C / Shift</strong> : Simpan Balok<br>
            • <strong>Tombol P</strong> : Jeda Game
        `;
  }
  popup.style.display = "flex";
}

function closePopup() {
  document.getElementById("popup-guide").style.display = "none";
}

function drawGrid() {
  context.strokeStyle = "rgba(255, 255, 255, 0.05)";
  context.lineWidth = 0.04;
  for (let x = 0; x < 12; x++) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, 20);
    context.stroke();
  }
  for (let y = 0; y < 20; y++) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(12, y);
    context.stroke();
  }
}

// Render balok bergaya mainan fisik / konsol retro
function drawBlock(x, y, value, ctx = context) {
  const color = colors[value];
  if (!color) return;

  // Warna dasar balok
  ctx.fillStyle = color.main;
  ctx.fillRect(x, y, 1, 1);

  // Highlight Bevel Atas & Kiri
  ctx.fillStyle = color.light;
  ctx.fillRect(x, y, 1, 0.12);
  ctx.fillRect(x, y, 0.12, 1);

  // Bayangan Bevel Bawah & Kanan
  ctx.fillStyle = color.dark;
  ctx.fillRect(x, y + 0.88, 1, 0.12);
  ctx.fillRect(x + 0.88, y, 0.12, 1);

  // Detail kepingan tengah (Stud Taktil)
  ctx.fillStyle = color.dark;
  ctx.fillRect(x + 0.28, y + 0.28, 0.44, 0.44);
  ctx.fillStyle = color.main;
  ctx.fillRect(x + 0.33, y + 0.33, 0.34, 0.34);

  // Garis tepi hitam tegas antar-balok
  ctx.strokeStyle = "#18181b";
  ctx.lineWidth = 0.06;
  ctx.strokeRect(x + 0.03, y + 0.03, 0.94, 0.94);
}

function arenaSweep() {
  let rowCount = 1;
  let linesCleared = 0;
  outer: for (let y = arena.length - 1; y > 0; --y) {
    for (let x = 0; x < arena[y].length; ++x) {
      if (arena[y][x] === 0) continue outer;
    }
    const row = arena.splice(y, 1)[0].fill(0);
    arena.unshift(row);
    ++y;

    player.score += rowCount * 10;
    rowCount *= 2;
    linesCleared++;
  }
  if (linesCleared > 0) {
    dropInterval = Math.max(150, dropInterval - 25);
  }
}

function collide(arena, playerCheck) {
  const m = playerCheck.matrix;
  const o = playerCheck.pos;
  for (let y = 0; y < m.length; ++y) {
    for (let x = 0; x < m[y].length; ++x) {
      if (m[y][x] !== 0 && (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0) {
        return true;
      }
    }
  }
  return false;
}

function createMatrix(w, h) {
  const matrix = [];
  while (h--) {
    matrix.push(new Array(w).fill(0));
  }
  return matrix;
}

function createPiece(type) {
  if (type === "T")
    return [
      [0, 0, 0],
      [1, 1, 1],
      [0, 1, 0],
    ];
  if (type === "O")
    return [
      [2, 2],
      [2, 2],
    ];
  if (type === "L")
    return [
      [0, 3, 0],
      [0, 3, 0],
      [0, 3, 3],
    ];
  if (type === "J")
    return [
      [0, 4, 0],
      [0, 4, 0],
      [4, 4, 0],
    ];
  if (type === "I")
    return [
      [0, 5, 0, 0],
      [0, 5, 0, 0],
      [0, 5, 0, 0],
      [0, 5, 0, 0],
    ];
  if (type === "S")
    return [
      [0, 6, 6],
      [6, 6, 0],
      [0, 0, 0],
    ];
  if (type === "Z")
    return [
      [7, 7, 0],
      [0, 7, 7],
      [0, 0, 0],
    ];
}

function drawMatrix(matrix, offset, ctx = context) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        drawBlock(x + offset.x, y + offset.y, value, ctx);
      }
    });
  });
}

function drawGhost() {
  const ghost = {
    matrix: player.matrix,
    pos: { x: player.pos.x, y: player.pos.y },
  };
  while (!collide(arena, ghost)) {
    ghost.pos.y++;
  }
  ghost.pos.y--;

  context.globalAlpha = 0.22;
  drawMatrix(ghost.matrix, ghost.pos);
  context.globalAlpha = 1.0;
}

function draw() {
  context.clearRect(0, 0, canvas.width, canvas.height);

  drawGrid();
  drawMatrix(arena, { x: 0, y: 0 });

  if (player.matrix) {
    drawGhost();
    drawMatrix(player.matrix, player.pos);
  }

  contextNext.clearRect(0, 0, canvasNext.width, canvasNext.height);
  const nX = (4 - nextPiece[0].length) / 2;
  const nY = (4 - nextPiece.length) / 2;
  drawMatrix(nextPiece, { x: nX, y: nY }, contextNext);

  contextHold.clearRect(0, 0, canvasHold.width, canvasHold.height);
  if (holdPieceMatrix) {
    const hX = (4 - holdPieceMatrix[0].length) / 2;
    const hY = (4 - holdPieceMatrix.length) / 2;
    drawMatrix(holdPieceMatrix, { x: hX, y: hY }, contextHold);
  }
}

function merge(arena, player) {
  player.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        arena[y + player.pos.y][x + player.pos.x] = value;
      }
    });
  });
}

function playerDrop() {
  if (isPaused || isGameOver || !gameStarted) return;
  player.pos.y++;
  if (collide(arena, player)) {
    player.pos.y--;
    merge(arena, player);
    spawnPiece();
    arenaSweep();
    updateScore();
    canHold = true;
  }
  dropCounter = 0;
}

function playerHardDrop() {
  if (isPaused || isGameOver || !gameStarted) return;
  while (!collide(arena, player)) {
    player.pos.y++;
  }
  player.pos.y--;
  merge(arena, player);
  spawnPiece();
  arenaSweep();
  updateScore();
  canHold = true;
  dropCounter = 0;
}

function playerMove(dir) {
  if (isPaused || isGameOver || !gameStarted) return;
  player.pos.x += dir;
  if (collide(arena, player)) {
    player.pos.x -= dir;
  }
}

function spawnPiece() {
  player.matrix = nextPiece;
  nextPiece = createPiece("ILJOTSZ"[(7 * Math.random()) | 0]);
  player.pos.y = 0;
  player.pos.x =
    ((arena[0].length / 2) | 0) - ((player.matrix[0].length / 2) | 0);

  if (collide(arena, player)) {
    handleGameOver();
  }
}

function holdPiece() {
  if (isPaused || isGameOver || !canHold || !gameStarted) return;

  if (holdPieceMatrix === null) {
    holdPieceMatrix = player.matrix;
    spawnPiece();
  } else {
    const temp = player.matrix;
    player.matrix = holdPieceMatrix;
    holdPieceMatrix = temp;
    player.pos.y = 0;
    player.pos.x =
      ((arena[0].length / 2) | 0) - ((player.matrix[0].length / 2) | 0);
  }
  canHold = false;
  dropCounter = 0;
}

function handleGameOver() {
  isGameOver = true;
  document.getElementById("final-score").innerText = "Skor: " + player.score;
  document.getElementById("game-over-overlay").style.display = "flex";

  if (player.score > savedHighScore) {
    savedHighScore = player.score;
    localStorage.setItem("tetrisNeonHighScore", savedHighScore);
  }
  updateScore();
}

function startGame() {
  document.getElementById("menu-screen").style.display = "none";
  document.getElementById("game-title").style.display = "block";
  document.getElementById("main-game").style.display = "flex";

  if (window.innerWidth <= 600) {
    document.getElementById("mobile-pads").style.display = "grid";
  } else {
    document.getElementById("game-rules").style.display = "block";
  }

  gameStarted = true;
  isPaused = false;
  isGameOver = false;
  updateScore();
  spawnPiece();
  lastTime = performance.now();
  update();
}

function resetGame() {
  arena.forEach((row) => row.fill(0));
  player.score = 0;
  dropInterval = 1000;
  holdPieceMatrix = null;
  canHold = true;
  isGameOver = false;
  document.getElementById("game-over-overlay").style.display = "none";

  updateScore();
  spawnPiece();
  lastTime = performance.now();
}

function backToMenu() {
  gameStarted = false;
  isPaused = false;
  isGameOver = false;

  if (animeFrameId) {
    cancelAnimationFrame(animeFrameId);
  }

  arena.forEach((row) => row.fill(0));
  player.score = 0;
  dropInterval = 1000;
  holdPieceMatrix = null;
  canHold = true;

  document.getElementById("pause-overlay").style.display = "none";
  document.getElementById("game-over-overlay").style.display = "none";
  document.getElementById("main-game").style.display = "none";
  document.getElementById("mobile-pads").style.display = "none";
  document.getElementById("game-rules").style.display = "none";
  document.getElementById("game-title").style.display = "none";

  document.getElementById("menu-screen").style.display = "flex";
}

function playerRotate(dir) {
  if (isPaused || isGameOver || !gameStarted) return;
  const pos = player.pos.x;
  let offset = 1;
  rotate(player.matrix, dir);
  while (collide(arena, player)) {
    player.pos.x += offset;
    offset = -(offset + (offset > 0 ? 1 : -1));
    if (offset > player.matrix[0].length) {
      rotate(player.matrix, -dir);
      player.pos.x = pos;
      return;
    }
  }
}

function rotate(matrix, dir) {
  for (let y = 0; y < matrix.length; ++y) {
    for (let x = 0; x < y; ++x) {
      [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
    }
  }
  if (dir > 0) matrix.forEach((row) => row.reverse());
  else matrix.reverse();
}

function update(time = 0) {
  if (!gameStarted) return;
  if (!isPaused && !isGameOver) {
    const deltaTime = time - lastTime;
    lastTime = time;

    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
      playerDrop();
    }
    draw();
  }
  animeFrameId = requestAnimationFrame(update);
}

function updateScore() {
  document.getElementById("score").innerText = player.score;
  document.getElementById("high-score").innerText = savedHighScore;
}

function togglePause() {
  if (isGameOver || !gameStarted) return;
  isPaused = !isPaused;
  const overlay = document.getElementById("pause-overlay");
  if (isPaused) {
    overlay.style.display = "flex";
  } else {
    overlay.style.display = "none";
    lastTime = performance.now();
  }
}

document.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "p") togglePause();

  if (!isPaused && !isGameOver && gameStarted) {
    if (event.key === "ArrowLeft") playerMove(-1);
    else if (event.key === "ArrowRight") playerMove(1);
    else if (event.key === "ArrowDown") playerDrop();
    else if (event.key === "ArrowUp") playerRotate(1);
    else if (event.key === " ") {
      event.preventDefault();
      playerHardDrop();
    } else if (event.key.toLowerCase() === "c" || event.key === "Shift")
      holdPiece();
  }
});

const setupMobileBtn = (id, action) => {
  const btn = document.getElementById(id);
  btn.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      if (!isPaused && !isGameOver && gameStarted) action();
    },
    { passive: false },
  );

  btn.addEventListener("mousedown", (e) => {
    e.preventDefault();
    if (!isPaused && !isGameOver && gameStarted) action();
  });
};

setupMobileBtn("btn-left", () => playerMove(-1));
setupMobileBtn("btn-right", () => playerMove(1));
setupMobileBtn("btn-down", () => playerDrop());
setupMobileBtn("btn-rotate", () => playerRotate(1));
setupMobileBtn("btn-drop", () => playerHardDrop());
setupMobileBtn("btn-hold", () => holdPiece());
