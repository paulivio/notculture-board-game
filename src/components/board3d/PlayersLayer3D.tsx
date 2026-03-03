import { Suspense, useState, useEffect, useRef } from 'react';
import { useGame } from '../../context/GameContext';
import { MAX_POSITION } from '../../lib/constants';
import CharacterPawn3D from './CharacterPawn3D';
import PlayerPawn3D from './PlayerPawn3D';
import type { AnswerResult } from '../../types/game';

export default function PlayersLayer3D() {
  const state = useGame();

  // Per-player hit counters — increment each wrong answer for that player
  const [hitCounts, setHitCounts] = useState<number[]>(() =>
    state.players.map(() => 0),
  );
  const prevAnswerResultRef = useRef<AnswerResult | null>(null);
  const prevShowWinRef = useRef(false);

  useEffect(() => {
    const curr = state.answerResult;
    if (curr && curr !== prevAnswerResultRef.current && !curr.wasCorrect) {
      setHitCounts((prev) => {
        const next = [...prev];
        next[state.currentPlayerIndex] = (next[state.currentPlayerIndex] ?? 0) + 1;
        return next;
      });
    }
    prevAnswerResultRef.current = curr;
  }, [state.answerResult, state.currentPlayerIndex]);

  // Reset hit counts when game restarts (win modal closes)
  useEffect(() => {
    if (prevShowWinRef.current && !state.showWinModal) {
      setHitCounts(state.players.map(() => 0));
    }
    prevShowWinRef.current = state.showWinModal;
  }, [state.showWinModal, state.players]);

  // Effective finish position (custom boards have different lengths)
  const effectiveMax = state.customBoardConfig
    ? state.customBoardConfig.totalTiles - 1
    : MAX_POSITION;

  return (
    <>
      {state.players.map((player, i) => {
        const isWinner = state.showWinModal && player.position >= effectiveMax;
        const playDeath = state.showWinModal && !isWinner;
        const playWin = isWinner;

        return (
          <Suspense
            key={player.id}
            fallback={<PlayerPawn3D player={player} allPlayers={state.players} />}
          >
            <CharacterPawn3D
              player={player}
              allPlayers={state.players}
              playerIndex={i}
              hitTrigger={hitCounts[i] ?? 0}
              playDeath={playDeath}
              playWin={playWin}
            />
          </Suspense>
        );
      })}
    </>
  );
}
