import { useRef, useEffect, useLayoutEffect, useMemo, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import { SkeletonUtils } from 'three-stdlib';
import { Group, Vector3, LoopOnce, type AnimationAction } from 'three';
import type { Player } from '../../types/game';
import {
  multiPlayerPositions,
  pathIndexTo3D,
  CHARACTER_SCALE,
  TILE_HEIGHT,
  HOP_HEIGHT,
  ANIM_IDLE,
  ANIM_WALK,
} from './utils3d';
import { MOVE_DURATION } from '../../lib/constants';

const BASE = import.meta.env.BASE_URL as string;

const MODEL_URLS = [
  `${BASE}models/Knight.glb`,
  `${BASE}models/Mage.glb`,
  `${BASE}models/Ranger.glb`,
  `${BASE}models/Barbarian.glb`,
];

const ANIM_URLS = [
  `${BASE}models/Rig_Medium_General.glb`,
  `${BASE}models/Rig_Medium_MovementBasic.glb`,
];

[...MODEL_URLS, ...ANIM_URLS].forEach((url) => useGLTF.preload(url));

interface Props {
  player: Player;
  allPlayers: Player[];
  playerIndex: number;
  hitTrigger: number;  // increments on each wrong answer for this player
  playDeath: boolean;  // true when game over and this player lost
  playWin: boolean;    // true when this player won
  groupRefOut?: MutableRefObject<Group | null>;
  actionsRefOut?: MutableRefObject<Record<string, AnimationAction | null> | null>;
  platformingActive?: boolean;  // when true, suppress own position writes
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

export default function CharacterPawn3D({ player, allPlayers, playerIndex, hitTrigger, playDeath, playWin, groupRefOut, actionsRefOut, platformingActive }: Props) {
  const modelUrl = MODEL_URLS[playerIndex % MODEL_URLS.length];
  const { scene } = useGLTF(modelUrl);
  const { animations: animsGeneral } = useGLTF(ANIM_URLS[0]);
  const { animations: animsMovement } = useGLTF(ANIM_URLS[1]);

  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const allAnimations = useMemo(
    () => [...animsGeneral, ...animsMovement],
    [animsGeneral, animsMovement],
  );

  const groupRef = useRef<Group>(null);
  const { actions } = useAnimations(allAnimations, groupRef);

  // Stable ref so timeout callbacks always see latest actions
  const actionsRef = useRef(actions);
  useEffect(() => { actionsRef.current = actions; }, [actions]);

  // Forward refs to PlatformingController when platformingActive
  useEffect(() => {
    if (groupRefOut) groupRefOut.current = groupRef.current;
  }, [groupRefOut]);

  // Debug: log all available clip names when this character enters platforming mode
  useEffect(() => {
    if (!platformingActive) return;
    const clips = Object.keys(actions).filter((k) => actions[k]).sort();
    console.log(`[CharacterPawn3D] Available clips (${clips.length}):\n  ${clips.join('\n  ')}`);
  }, [platformingActive]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (actionsRefOut) actionsRefOut.current = actionsRef.current;
  }, [actions, actionsRefOut]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Position helpers ---
  const playersAtPos = useMemo(
    () => allPlayers.filter((p) => p.position === player.position),
    [allPlayers, player.position],
  );
  const myIndex = playersAtPos.findIndex((p) => p.id === player.id);
  const totalAtPos = playersAtPos.length;
  const target = multiPlayerPositions(player.position, myIndex, totalAtPos);

  const targetVec = useRef(new Vector3(target[0], TILE_HEIGHT, target[2]));
  const startPosRef = useRef(new Vector3(target[0], TILE_HEIGHT, target[2]));
  const moveProgressRef = useRef(1);

  const prevPositionRef = useRef(player.position);
  const targetRotY = useRef(0);

  // --- Idle cycling state ---
  const currentIdleRef = useRef('');
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDeadRef = useRef(false);

  function clearIdleTimer() {
    if (idleTimerRef.current !== null) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }

  // Randomly cycle between available idle clips (3–8 s intervals)
  function scheduleIdleCycle() {
    clearIdleTimer();
    if (isDeadRef.current) return;
    const delay = 3000 + Math.random() * 5000;
    idleTimerRef.current = setTimeout(() => {
      const a = actionsRef.current;
      const opts = ANIM_IDLE.filter((n) => a[n]);
      const next = opts.find((n) => n !== currentIdleRef.current) ?? opts[0];
      if (!next) { scheduleIdleCycle(); return; }
      a[next]!.reset().fadeIn(0.5).play();
      if (currentIdleRef.current) a[currentIdleRef.current]?.fadeOut(0.5);
      currentIdleRef.current = next;
      scheduleIdleCycle();
    }, delay);
  }

  // Helper: start the first idle and kick off cycling
  function startIdling(a: typeof actions) {
    const clip = ANIM_IDLE.find((n) => a[n]);
    if (!clip) return;
    a[clip]!.reset().fadeIn(0.3).play();
    currentIdleRef.current = clip;
    scheduleIdleCycle();
  }

  // --- Play idle + begin cycling on mount ---
  useEffect(() => {
    startIdling(actions);
    return clearIdleTimer;
  }, [actions]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Set initial position before first render ---
  useLayoutEffect(() => {
    if (groupRef.current) {
      groupRef.current.position.set(target[0], TILE_HEIGHT, target[2]);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Hit animation on wrong answer ---
  useEffect(() => {
    if (hitTrigger === 0) return;
    clearIdleTimer();
    const a = actionsRef.current;
    const hitClip = Math.random() < 0.5 ? 'Hit_A' : 'Hit_B';
    if (!a[hitClip]) return;

    if (currentIdleRef.current) a[currentIdleRef.current]?.fadeOut(0.1);
    a[hitClip]!.setLoop(LoopOnce, 1);
    a[hitClip]!.clampWhenFinished = false;
    a[hitClip]!.reset().fadeIn(0.1).play();

    const duration = a[hitClip]!.getClip().duration * 1000;
    const t = setTimeout(() => {
      if (isDeadRef.current) return;
      startIdling(actionsRef.current);
      actionsRef.current[hitClip]?.fadeOut(0.2);
    }, duration * 0.95);
    return () => clearTimeout(t);
  }, [hitTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Win animation (T-Pose) / recovery on game reset ---
  useEffect(() => {
    if (playWin) {
      isDeadRef.current = true;
      clearIdleTimer();
      const a = actionsRef.current;
      Object.keys(a).forEach((k) => a[k]?.fadeOut(0.2));
      if (a['T-Pose']) {
        a['T-Pose']!.setLoop(LoopOnce, 1);
        a['T-Pose']!.clampWhenFinished = true;
        a['T-Pose']!.reset().fadeIn(0.3).play();
      }
    } else if (isDeadRef.current) {
      // Game reset — teleport to spawn, clear T-Pose, return to upright idle
      isDeadRef.current = false;
      targetRotY.current = 0;
      prevPositionRef.current = 0;
      targetVec.current.set(target[0], TILE_HEIGHT, target[2]);
      startPosRef.current.set(target[0], TILE_HEIGHT, target[2]);
      moveProgressRef.current = 1;
      if (groupRef.current) {
        groupRef.current.position.set(target[0], TILE_HEIGHT, target[2]);
        groupRef.current.rotation.y = 0;
      }
      const a = actionsRef.current;
      Object.keys(a).forEach((k) => {
        if (a[k]) {
          a[k]!.clampWhenFinished = false;
          a[k]!.stop();
        }
      });
      startIdling(a);
    }
  }, [playWin]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Death animation when game over / recovery on game reset ---
  useEffect(() => {
    if (playDeath) {
      isDeadRef.current = true;
      clearIdleTimer();
      const a = actionsRef.current;
      const deathClip = Math.random() < 0.5 ? 'Death_A' : 'Death_B';
      Object.keys(a).forEach((k) => a[k]?.fadeOut(0.2));
      if (a[deathClip]) {
        a[deathClip]!.setLoop(LoopOnce, 1);
        a[deathClip]!.clampWhenFinished = true;
        a[deathClip]!.reset().fadeIn(0.2).play();
      }
    } else if (isDeadRef.current) {
      // Game reset — teleport to spawn, clear death pose, return to idle
      isDeadRef.current = false;
      targetRotY.current = 0;
      prevPositionRef.current = 0;
      targetVec.current.set(target[0], TILE_HEIGHT, target[2]);
      startPosRef.current.set(target[0], TILE_HEIGHT, target[2]);
      moveProgressRef.current = 1;
      if (groupRef.current) {
        groupRef.current.position.set(target[0], TILE_HEIGHT, target[2]);
        groupRef.current.rotation.y = 0;
      }
      const a = actionsRef.current;
      Object.keys(a).forEach((k) => {
        if (a[k]) {
          a[k]!.clampWhenFinished = false;
          a[k]!.stop();
        }
      });
      startIdling(a);
    }
  }, [playDeath]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Suppress hop when platforming just ended (character already at destination) ---
  const wasPlatformingRef = useRef(false);
  useEffect(() => {
    if (wasPlatformingRef.current && !platformingActive) {
      // Platforming just ended — teleport to the exact tile so no hop plays and
      // prevPositionRef matches, causing the position-change effect below to exit early.
      const [tx, , tz] = pathIndexTo3D(player.position);
      prevPositionRef.current = player.position;
      startPosRef.current.set(tx, TILE_HEIGHT, tz);
      targetVec.current.set(tx, TILE_HEIGHT, tz);
      moveProgressRef.current = 1;
      if (groupRef.current) groupRef.current.position.set(tx, TILE_HEIGHT, tz);
    }
    wasPlatformingRef.current = platformingActive ?? false;
  }, [platformingActive, player.position]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Position change: jump to next tile ---
  useEffect(() => {
    if (player.position === prevPositionRef.current) return;

    const from = pathIndexTo3D(prevPositionRef.current);
    const to = pathIndexTo3D(player.position);
    const dx = to[0] - from[0];
    const dz = to[2] - from[2];
    if (Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001) {
      targetRotY.current = Math.atan2(dx, dz);
    }

    prevPositionRef.current = player.position;

    if (groupRef.current) {
      startPosRef.current.set(
        groupRef.current.position.x,
        TILE_HEIGHT,
        groupRef.current.position.z,
      );
    }
    targetVec.current.set(target[0], TILE_HEIGHT, target[2]);
    moveProgressRef.current = 0;

    const walkClip = ANIM_WALK.find((n) => actions[n]);
    clearIdleTimer();
    if (walkClip) actions[walkClip]!.reset().fadeIn(0.1).play();
    if (currentIdleRef.current) actions[currentIdleRef.current]?.fadeOut(0.1);

    const t = setTimeout(() => {
      if (isDeadRef.current) return;
      const a = actionsRef.current;
      startIdling(a);
      if (walkClip) a[walkClip]?.fadeOut(0.15);
    }, MOVE_DURATION * 0.85);

    return () => clearTimeout(t);
  }, [player.position, actions, target[0], target[2]]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- useFrame: timed XZ movement + arc + facing ---
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    if (platformingActive) return;  // PlatformingController owns this character's position

    if (moveProgressRef.current < 1) {
      moveProgressRef.current = Math.min(
        1,
        moveProgressRef.current + delta / (MOVE_DURATION / 1000),
      );
      const e = easeInOut(moveProgressRef.current);
      groupRef.current.position.x =
        startPosRef.current.x + (targetVec.current.x - startPosRef.current.x) * e;
      groupRef.current.position.z =
        startPosRef.current.z + (targetVec.current.z - startPosRef.current.z) * e;
    } else {
      groupRef.current.position.x = targetVec.current.x;
      groupRef.current.position.z = targetVec.current.z;
    }

    groupRef.current.position.y =
      moveProgressRef.current < 1
        ? TILE_HEIGHT + Math.sin(Math.PI * moveProgressRef.current) * HOP_HEIGHT
        : TILE_HEIGHT;

    const curR = groupRef.current.rotation.y;
    let diff = targetRotY.current - curR;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    groupRef.current.rotation.y += diff * Math.min(1, delta * 10);
  });

  return (
    <group ref={groupRef} scale={CHARACTER_SCALE} castShadow>
      <primitive object={clone} />
    </group>
  );
}
