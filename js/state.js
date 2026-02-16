// js/state.js

export const state = {
  questions: [],
players: [
  { id: 1, name: "Player 1", position: 0 },
  { id: 2, name: "Player 2", position: 0 }
],
maxPlayers: 4,
minPlayers: 1,
currentPlayerIndex: 0,
  activeQuestion: null,
  pendingMove: 0,
  isTurnLocked: false,
  usedQuestionIds: new Set(),

   debugMode: false // 👈 ADD THIS
};

export const categories = ["film", "science", "general", "history"];

export const categoryLabels = {
  film: "Film & TV",
  science: "Science & Technology",
  general: "General Knowledge",
  history: "History & Arts"
};

