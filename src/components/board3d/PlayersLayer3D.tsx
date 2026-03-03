import { useGame } from "../../context/GameContext";
import PlayerPawn3D from "./PlayerPawn3D";

export default function PlayersLayer3D() {
  const state = useGame();
  return (
    <>
      {state.players.map((player) => (
        <PlayerPawn3D key={player.id} player={player} allPlayers={state.players} />
      ))}
    </>
  );
}
