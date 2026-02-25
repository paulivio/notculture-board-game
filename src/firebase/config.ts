import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyD7f_fbDPiRf1Usm6AbymeeeCw-iEWZ5xs",
  authDomain: "notculture-board-game.firebaseapp.com",
  databaseURL:
    "https://notculture-board-game-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "notculture-board-game",
  storageBucket: "notculture-board-game.firebasestorage.app",
  messagingSenderId: "110068266707",
  appId: "1:110068266707:web:8ca21aec951f5838238626",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
