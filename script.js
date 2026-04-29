const WINNING_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
];

class GameEngine {
  constructor() {
    this.mode = "PVP";
    this.aiLevel = "basic";
    this.scores = { X: 0, O: 0, draws: 0 };
    this.startingMark = "X";
    this.round = 1;
    this.startRound({ toggleStarter: false, countRound: false });
  }

  startRound({ toggleStarter = false, countRound = true } = {}) {
    if (toggleStarter) {
      this.startingMark = this.startingMark === "X" ? "O" : "X";
    }

    if (countRound) {
      this.round += 1;
    }

    this.board = Array(9).fill(null);
    this.currentMark = this.startingMark;
    this.status = "playing";
    this.winner = null;
    this.winningLine = null;
  }

  setMode(mode) {
    if (mode !== "PVP" && mode !== "AI") {
      return;
    }

    if (mode === this.mode) {
      return;
    }

    this.mode = mode;
    this.resetAll();
  }

  setAiLevel(level) {
    if (level === "basic" || level === "minimax") {
      this.aiLevel = level;
    }
  }

  restartRound() {
    this.startRound({ toggleStarter: true, countRound: true });
  }

  resetAll() {
    this.scores = { X: 0, O: 0, draws: 0 };
    this.startingMark = "X";
    this.round = 1;
    this.startRound({ toggleStarter: false, countRound: false });
  }

  makeMove(index) {
    if (this.status !== "playing") {
      return { accepted: false };
    }

    if (!Number.isInteger(index) || index < 0 || index > 8 || this.board[index]) {
      return { accepted: false };
    }

    const mark = this.currentMark;
    this.board[index] = mark;

    const outcome = GameEngine.evaluateBoard(this.board);

    if (outcome.winner) {
      this.status = "won";
      this.winner = outcome.winner;
      this.winningLine = outcome.line;
      this.scores[mark] += 1;
    } else if (outcome.draw) {
      this.status = "draw";
      this.scores.draws += 1;
    } else {
      this.currentMark = this.currentMark === "X" ? "O" : "X";
    }

    return {
      accepted: true,
      mark,
      status: this.status,
      winner: this.winner,
      winningLine: this.winningLine
    };
  }

  needsAiMove() {
    return this.mode === "AI" && this.status === "playing" && this.currentMark === "O";
  }

  getSnapshot() {
    return {
      board: [...this.board],
      currentMark: this.currentMark,
      status: this.status,
      winner: this.winner,
      winningLine: this.winningLine ? [...this.winningLine] : null,
      mode: this.mode,
      aiLevel: this.aiLevel,
      scores: { ...this.scores },
      round: this.round
    };
  }

  static evaluateBoard(board) {
    for (const line of WINNING_LINES) {
      const [a, b, c] = line;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return { winner: board[a], line, draw: false };
      }
    }

    if (board.every((cell) => cell !== null)) {
      return { winner: null, line: null, draw: true };
    }

    return { winner: null, line: null, draw: false };
  }
}

class AIPlayer {
  static chooseMove(engine) {
    const board = [...engine.board];

    if (engine.aiLevel === "minimax") {
      return this.chooseMinimax(board, "O", "X");
    }

    return this.chooseBasic(board, "O", "X");
  }

  static chooseBasic(board, aiMark, humanMark) {
    const available = this.availableMoves(board);

    for (const index of available) {
      board[index] = aiMark;
      const result = GameEngine.evaluateBoard(board);
      board[index] = null;
      if (result.winner === aiMark) {
        return index;
      }
    }

    for (const index of available) {
      board[index] = humanMark;
      const result = GameEngine.evaluateBoard(board);
      board[index] = null;
      if (result.winner === humanMark) {
        return index;
      }
    }

    if (board[4] === null) {
      return 4;
    }

    const corners = [0, 2, 6, 8].filter((index) => board[index] === null);
    if (corners.length > 0) {
      return corners[Math.floor(Math.random() * corners.length)];
    }

    return available[Math.floor(Math.random() * available.length)];
  }

  static chooseMinimax(board, aiMark, humanMark) {
    const bestMove = this.minimax(board, aiMark, aiMark, humanMark, 0);

    if (typeof bestMove.index === "number") {
      return bestMove.index;
    }

    return this.chooseBasic(board, aiMark, humanMark);
  }

  static minimax(board, currentMark, aiMark, humanMark, depth) {
    const outcome = GameEngine.evaluateBoard(board);

    if (outcome.winner === aiMark) {
      return { score: 10 - depth };
    }

    if (outcome.winner === humanMark) {
      return { score: depth - 10 };
    }

    if (outcome.draw) {
      return { score: 0 };
    }

    const moves = [];

    for (const index of this.availableMoves(board)) {
      board[index] = currentMark;
      const nextMark = currentMark === aiMark ? humanMark : aiMark;
      const result = this.minimax(board, nextMark, aiMark, humanMark, depth + 1);
      board[index] = null;
      moves.push({ index, score: result.score });
    }

    if (currentMark === aiMark) {
      return moves.reduce((best, move) => (move.score > best.score ? move : best));
    }

    return moves.reduce((best, move) => (move.score < best.score ? move : best));
  }

  static availableMoves(board) {
    const moves = [];

    for (let i = 0; i < board.length; i += 1) {
      if (board[i] === null) {
        moves.push(i);
      }
    }

    return moves;
  }
}

class GameUI {
  constructor(engine) {
    this.engine = engine;
    this.isAiThinking = false;
    this.aiTimerId = null;

    this.boardElement = document.getElementById("board");
    this.statusElement = document.getElementById("status");
    this.winLineElement = document.getElementById("win-line");
    this.restartButton = document.getElementById("restart-round");
    this.resetButton = document.getElementById("reset-all");
    this.modeButtons = Array.from(document.querySelectorAll(".mode-btn"));
    this.difficultySelect = document.getElementById("difficulty");

    this.scoreX = document.getElementById("score-x");
    this.scoreO = document.getElementById("score-o");
    this.scoreDraw = document.getElementById("score-draw");
    this.labelX = document.getElementById("label-x");
    this.labelO = document.getElementById("label-o");

    this.cells = this.createBoardCells();
    this.bindEvents();
    this.render();
    this.maybeRunAiTurn();
  }

  createBoardCells() {
    const fragment = document.createDocumentFragment();
    const cells = [];

    for (let index = 0; index < 9; index += 1) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      cell.dataset.index = String(index);
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-label", `Cell ${index + 1}`);
      fragment.appendChild(cell);
      cells.push(cell);
    }

    this.boardElement.appendChild(fragment);
    return cells;
  }

  bindEvents() {
    this.boardElement.addEventListener("click", (event) => {
      const cell = event.target.closest(".cell");
      if (!cell) {
        return;
      }

      const index = Number.parseInt(cell.dataset.index, 10);
      this.handlePlayerMove(index);
    });

    this.modeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        this.cancelAiTurn();
        const selectedMode = button.dataset.mode;
        this.engine.setMode(selectedMode);
        this.render();
        this.maybeRunAiTurn();
      });
    });

    this.difficultySelect.addEventListener("change", (event) => {
      this.engine.setAiLevel(event.target.value);
      this.renderStatus();
    });

    this.restartButton.addEventListener("click", () => {
      this.cancelAiTurn();
      this.engine.restartRound();
      this.render();
      this.maybeRunAiTurn();
    });

    this.resetButton.addEventListener("click", () => {
      this.cancelAiTurn();
      this.engine.resetAll();
      this.render();
      this.maybeRunAiTurn();
    });

    window.addEventListener("resize", () => {
      if (this.engine.status === "won" && this.engine.winningLine) {
        this.drawWinLine(this.engine.winningLine);
      }
    });
  }

  handlePlayerMove(index) {
    if (this.isAiThinking) {
      return;
    }

    if (this.engine.mode === "AI" && this.engine.currentMark === "O") {
      return;
    }

    const move = this.engine.makeMove(index);

    if (!move.accepted) {
      return;
    }

    this.render();
    this.maybeRunAiTurn();
  }

  maybeRunAiTurn() {
    if (!this.engine.needsAiMove()) {
      return;
    }

    this.isAiThinking = true;
    this.renderStatus();
    this.updateBoardInteractivity();

    this.aiTimerId = window.setTimeout(() => {
      this.aiTimerId = null;
      if (!this.engine.needsAiMove()) {
        this.isAiThinking = false;
        this.render();
        return;
      }

      const aiMove = AIPlayer.chooseMove(this.engine);
      this.engine.makeMove(aiMove);
      this.isAiThinking = false;
      this.render();
    }, 500);
  }

  cancelAiTurn() {
    if (this.aiTimerId !== null) {
      window.clearTimeout(this.aiTimerId);
      this.aiTimerId = null;
    }

    this.isAiThinking = false;
  }

  getPlayerName(mark) {
    if (this.engine.mode === "PVP") {
      return mark === "X" ? "Player 1" : "Player 2";
    }

    return mark === "X" ? "You" : "AI";
  }

  render() {
    const state = this.engine.getSnapshot();

    this.modeButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.mode === state.mode);
    });

    this.difficultySelect.disabled = state.mode !== "AI";
    this.difficultySelect.value = state.aiLevel;

    this.labelX.textContent = state.mode === "AI" ? "You (X)" : "Player 1 (X)";
    this.labelO.textContent = state.mode === "AI" ? "AI (O)" : "Player 2 (O)";

    this.scoreX.textContent = String(state.scores.X);
    this.scoreO.textContent = String(state.scores.O);
    this.scoreDraw.textContent = String(state.scores.draws);

    this.cells.forEach((cell, index) => {
      const mark = state.board[index];
      cell.textContent = mark || "";
      cell.classList.toggle("x", mark === "X");
      cell.classList.toggle("o", mark === "O");
      cell.classList.remove("win");
    });

    if (state.status === "won" && state.winningLine) {
      state.winningLine.forEach((index) => {
        this.cells[index].classList.add("win");
      });
      this.drawWinLine(state.winningLine);
    } else {
      this.hideWinLine();
    }

    this.renderStatus();
    this.updateBoardInteractivity();
  }

  renderStatus() {
    const state = this.engine.getSnapshot();

    if (this.isAiThinking) {
      this.statusElement.textContent = `Round ${state.round}: AI is thinking...`;
      this.statusElement.classList.add("thinking");
      return;
    }

    this.statusElement.classList.remove("thinking");

    if (state.status === "won") {
      this.statusElement.textContent = `Round ${state.round}: ${this.getPlayerName(state.winner)} wins!`;
      return;
    }

    if (state.status === "draw") {
      this.statusElement.textContent = `Round ${state.round}: Draw game.`;
      return;
    }

    this.statusElement.textContent = `Round ${state.round}: ${this.getPlayerName(state.currentMark)}'s turn (${state.currentMark})`;
  }

  updateBoardInteractivity() {
    const state = this.engine.getSnapshot();
    const isLocked = this.isAiThinking || state.status !== "playing";

    this.cells.forEach((cell, index) => {
      const occupied = state.board[index] !== null;
      cell.disabled =
        isLocked ||
        occupied ||
        (state.mode === "AI" && state.currentMark === "O");
    });
  }

  hideWinLine() {
    this.winLineElement.classList.remove("visible");
  }

  drawWinLine(line) {
    const startCell = this.cells[line[0]];
    const endCell = this.cells[line[2]];

    const boardRect = this.boardElement.getBoundingClientRect();
    const startRect = startCell.getBoundingClientRect();
    const endRect = endCell.getBoundingClientRect();

    const startX = startRect.left - boardRect.left + startRect.width / 2;
    const startY = startRect.top - boardRect.top + startRect.height / 2;
    const endX = endRect.left - boardRect.left + endRect.width / 2;
    const endY = endRect.top - boardRect.top + endRect.height / 2;

    const length = Math.hypot(endX - startX, endY - startY);
    const angle = (Math.atan2(endY - startY, endX - startX) * 180) / Math.PI;

    this.winLineElement.classList.remove("visible");
    this.winLineElement.style.setProperty("--line-x", `${startX}px`);
    this.winLineElement.style.setProperty("--line-y", `${startY - 5}px`);
    this.winLineElement.style.setProperty("--line-length", `${length}px`);
    this.winLineElement.style.setProperty("--line-angle", `${angle}deg`);

    window.requestAnimationFrame(() => {
      this.winLineElement.classList.add("visible");
    });
  }
}

const gameEngine = new GameEngine();
new GameUI(gameEngine);
