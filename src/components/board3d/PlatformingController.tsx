import { useRef, useEffect, useCallback, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Group, AnimationAction, MeshBasicMaterial, LoopOnce } from 'three';
import type { Player } from '../../types/game';
import { pathIndexTo3D, TILE_HEIGHT, ANIM_IDLE, ANIM_RUN } from './utils3d';

interface Props {
  currentPlayer: Player;
  targetPathIndex: number;
  characterGroupRef: MutableRefObject<Group | null>;
  characterActionsRef: MutableRefObject<Record<string, AnimationAction | null> | null>;
  onComplete: () => void;
}

// ─── Tuning constants ────────────────────────────────────────────────
const SPEED = 2.0;           // fallback if run clip hasn't loaded yet
const STRIDE_LENGTH = 1.2;  // world units the character visually travels per animation cycle
const BOARD_LIMIT = 4.0;     // clamp character inside board area

const CAM_RADIUS = 4.5;      // distance from character to camera
const CAM_PIVOT_Y = 1.0;     // look-at height above character base
const PITCH_DEFAULT = 0.45;  // radians — comfortable 3rd-person angle (~26° above horizon)
const PITCH_MIN = 0.1;       // flattest view
const PITCH_MAX = 1.3;       // most overhead
const MOUSE_SENS = 0.002;    // radians per pixel

const TURN_SPEED = 10;       // how fast character rotates toward movement direction (rad/s)

const JUMP_HEIGHT    = 0.3;   // world units above tile surface at peak
const JUMP_DURATION  = 0.85;  // seconds for full arc (up + down)
const JUMP_WINDUP    = 0.28;  // seconds Jump_Start plays before lift-off
const LAND_TRIGGER   = 0.75;  // arc progress (0–1) at which Jump_Land starts playing

const PROXIMITY_SQ = 0.4 * 0.4; // squared distance to trigger tile completion
// ─────────────────────────────────────────────────────────────────────

export default function PlatformingController({
  targetPathIndex,
  characterGroupRef,
  characterActionsRef,
  onComplete,
}: Props) {
  const { camera, gl } = useThree();

  // All input state lives in refs — we never want re-renders from these
  const keysRef            = useRef<Set<string>>(new Set());
  const yawRef             = useRef(0);          // horizontal orbit angle, accumulates freely
  const pitchRef           = useRef(PITCH_DEFAULT);
  const charFacingRef      = useRef<number | null>(null); // null = pick up from group on first frame
  const walkingRef         = useRef(false);
  const runSpeedRef        = useRef(SPEED); // updated once from clip duration
  const jumpingRef         = useRef(false);
  const jumpWindupRef      = useRef(0);   // counts down before arc begins
  const jumpProgressRef    = useRef(0);
  const jumpPhaseRef       = useRef<'start' | 'air' | 'land' | 'none'>('none');
  const emoteRef           = useRef<string | null>(null); // active emote clip name
  const emoteTimerRef      = useRef(0);                   // seconds remaining
  const pendingEmoteRef    = useRef<string | null>(null); // set from keydown, consumed in useFrame
  const completedRef       = useRef(false);
  const pointerLockedRef   = useRef(false);
  const onCompleteRef      = useRef(onComplete);
  onCompleteRef.current    = onComplete;

  // Pulsing target-ring state
  const phaseRef    = useRef(0);
  const ringMatRef  = useRef<MeshBasicMaterial | null>(null);

  const [tx, , tz] = pathIndexTo3D(targetPathIndex);

  // ── Pointer lock helper ──────────────────────────────────────────
  const requestLock = useCallback(() => {
    const canvas = gl.domElement;
    if (document.pointerLockElement !== canvas) canvas.requestPointerLock();
  }, [gl.domElement]);

  // ── Event listeners ──────────────────────────────────────────────
  useEffect(() => {
    const canvas = gl.domElement;

    const EMOTE_KEYS: Record<string, string> = {
      KeyE: 'Interact',
      KeyF: 'PickUp',
      KeyQ: 'Throw',
      KeyR: 'Use_Item',
    };

    function onKeyDown(e: KeyboardEvent) {
      keysRef.current.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      if (EMOTE_KEYS[e.code]) {
        pendingEmoteRef.current = EMOTE_KEYS[e.code];
      }
    }
    function onKeyUp(e: KeyboardEvent) { keysRef.current.delete(e.code); }

    function onMouseMove(e: MouseEvent) {
      if (!pointerLockedRef.current) return;
      // Mouse X  → horizontal orbit (yaw)
      yawRef.current -= e.movementX * MOUSE_SENS;
      // Mouse Y  → vertical orbit (pitch): up = higher pitch = more overhead view
      pitchRef.current = Math.max(
        PITCH_MIN,
        Math.min(PITCH_MAX, pitchRef.current + e.movementY * MOUSE_SENS),
      );
    }

    function onLockChange() {
      pointerLockedRef.current = document.pointerLockElement === canvas;
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('pointerlockchange', onLockChange);
    canvas.addEventListener('click', requestLock);

    requestLock(); // grab lock immediately on mount

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('pointerlockchange', onLockChange);
      canvas.removeEventListener('click', requestLock);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    };
  }, [gl.domElement, requestLock]);

  // ── Cleanup on unmount: stop all platforming anims → idle ───────
  useEffect(() => {
    return () => {
      const a = characterActionsRef.current;
      if (!a) return;
      ANIM_RUN.forEach((n) => a[n]?.fadeOut(0.15));
      ['Jump_Start', 'Jump_Idle', 'Jump_Land'].forEach((n) => a[n]?.fadeOut(0.1));
      const clip = ANIM_IDLE.find((n) => a[n]);
      if (clip) a[clip]!.reset().fadeIn(0.2).play();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Main loop ───────────────────────────────────────────────────
  useFrame((_, delta) => {
    const group = characterGroupRef.current;
    if (!group) return;

    // Pulse ring
    phaseRef.current += delta * 3;
    if (ringMatRef.current) {
      ringMatRef.current.opacity = 0.4 + 0.4 * Math.sin(phaseRef.current);
    }

    if (completedRef.current) return;

    // Pick up character's current facing on first frame (seamless handoff)
    if (charFacingRef.current === null) {
      charFacingRef.current = group.rotation.y;
    }

    const a = characterActionsRef.current;

    // ── Emotes ────────────────────────────────────────────────────
    // Tick down active emote timer
    if (emoteRef.current) {
      emoteTimerRef.current -= delta;
      if (emoteTimerRef.current <= 0) {
        // Emote finished — fade back to idle
        if (a) {
          a[emoteRef.current]?.fadeOut(0.2);
          const idleClip = ANIM_IDLE.find((n) => a[n]);
          if (idleClip) a[idleClip]!.reset().fadeIn(0.2).play();
        }
        emoteRef.current = null;
        walkingRef.current = false;
      }
    }

    // Start a pending emote (only when grounded and not already emoting or jumping)
    if (pendingEmoteRef.current && !jumpingRef.current && !emoteRef.current) {
      const clipName = pendingEmoteRef.current;
      pendingEmoteRef.current = null;
      if (a?.[clipName]) {
        // Fade out current animation
        ANIM_RUN.forEach((n) => a[n]?.fadeOut(0.15));
        ANIM_IDLE.forEach((n) => a[n]?.fadeOut(0.15));
        a[clipName]!.setLoop(LoopOnce, 1);
        a[clipName]!.clampWhenFinished = true;
        a[clipName]!.reset().fadeIn(0.15).play();
        emoteRef.current = clipName;
        emoteTimerRef.current = a[clipName]!.getClip().duration;
        walkingRef.current = false;
      }
    } else {
      pendingEmoteRef.current = null; // discard if conditions not met
    }

    const yaw  = yawRef.current;
    const sinY = Math.sin(yaw);
    const cosY = Math.cos(yaw);

    // ── Movement (horizontal — allowed in air too) ────────────────
    // Camera-relative directions in world XZ:
    //   Forward  = (-sinY, -cosY)   ← flat projection of camera look direction
    //   Right    = ( cosY, -sinY)   ← 90° clockwise from forward
    let wx = 0, wz = 0;
    const keys = keysRef.current;
    if (keys.has('KeyW') || keys.has('ArrowUp'))    { wx -= sinY; wz -= cosY; }
    if (keys.has('KeyS') || keys.has('ArrowDown'))  { wx += sinY; wz += cosY; }
    if (keys.has('KeyA') || keys.has('ArrowLeft'))  { wx -= cosY; wz += sinY; }
    if (keys.has('KeyD') || keys.has('ArrowRight')) { wx += cosY; wz -= sinY; }

    const speedLen = Math.sqrt(wx * wx + wz * wz);
    const isMoving = speedLen > 0;

    const inWindup = jumpingRef.current && jumpWindupRef.current > 0;
    const inEmote  = emoteRef.current !== null;
    const effectiveSpeed = inWindup ? runSpeedRef.current * 0.15 : runSpeedRef.current;

    if (isMoving && !inEmote) {
      const nx = wx / speedLen;
      const nz = wz / speedLen;

      group.position.x = Math.max(-BOARD_LIMIT, Math.min(BOARD_LIMIT,
        group.position.x + nx * effectiveSpeed * delta));
      group.position.z = Math.max(-BOARD_LIMIT, Math.min(BOARD_LIMIT,
        group.position.z + nz * effectiveSpeed * delta));

      // Pattern B: character rotates toward movement direction, camera orbits freely
      const desired = Math.atan2(nx, nz);
      let diff = desired - charFacingRef.current!;
      while (diff >  Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      charFacingRef.current! += diff * Math.min(1, delta * TURN_SPEED);
      group.rotation.y = charFacingRef.current!;
    }

    // ── Jump ──────────────────────────────────────────────────────
    if (keys.has('Space') && !jumpingRef.current && !inEmote) {
      // Phase 1 — Jump_Start: plays immediately during wind-up (crouch + launch)
      jumpingRef.current = true;
      jumpWindupRef.current = JUMP_WINDUP;
      jumpProgressRef.current = 0;
      jumpPhaseRef.current = 'start';
      walkingRef.current = false;
      if (a) {
        ANIM_RUN.forEach((n) => a[n]?.fadeOut(0.1));
        ANIM_IDLE.forEach((n) => a[n]?.fadeOut(0.1));
        const clip = a['Jump_Start'];
        if (clip) {
          clip.setLoop(LoopOnce, 1);
          clip.clampWhenFinished = true;
          clip.reset().fadeIn(0.1).play();
        }
      }
    }

    // Y position — wind-up on ground, then arc while airborne
    if (jumpingRef.current) {
      if (jumpWindupRef.current > 0) {
        // Still winding up: stay on ground
        jumpWindupRef.current -= delta;
        group.position.y = TILE_HEIGHT;

        // Wind-up just expired → Phase 2: Jump_Idle loops while airborne
        if (jumpWindupRef.current <= 0 && jumpPhaseRef.current === 'start') {
          jumpPhaseRef.current = 'air';
          if (a) {
            a['Jump_Start']?.fadeOut(0.12);
            const clip = a['Jump_Idle'];
            if (clip) clip.reset().fadeIn(0.12).play(); // loops by default
          }
        }
      } else {
        jumpProgressRef.current = Math.min(1, jumpProgressRef.current + delta / JUMP_DURATION);
        group.position.y = TILE_HEIGHT + Math.sin(Math.PI * jumpProgressRef.current) * JUMP_HEIGHT;

        // Phase 3 — Jump_Land: starts on descent, before touching down
        if (jumpPhaseRef.current === 'air' && jumpProgressRef.current >= LAND_TRIGGER) {
          jumpPhaseRef.current = 'land';
          if (a) {
            a['Jump_Idle']?.fadeOut(0.12);
            const clip = a['Jump_Land'];
            if (clip) {
              clip.setLoop(LoopOnce, 1);
              clip.clampWhenFinished = true;
              clip.reset().fadeIn(0.1).play();
            }
          }
        }

        // Touched down — fade out Jump_Land, start idle immediately
        if (jumpProgressRef.current >= 1) {
          jumpingRef.current = false;
          jumpPhaseRef.current = 'none';
          group.position.y = TILE_HEIGHT;
          walkingRef.current = false;
          if (a) {
            a['Jump_Land']?.fadeOut(0.15);
            const idleClip = ANIM_IDLE.find((n) => a[n]);
            if (idleClip) a[idleClip]!.reset().fadeIn(0.15).play();
          }
        }
      }
    } else {
      group.position.y = TILE_HEIGHT;
    }

    // ── Run / idle animation (skipped while airborne or emoting) ──
    if (!jumpingRef.current && !inEmote && a) {
      if (isMoving && !walkingRef.current) {
        walkingRef.current = true;
        const runClip  = ANIM_RUN.find((n) => a[n]);
        const idleClip = ANIM_IDLE.find((n) => a[n]);
        if (runClip) {
          // Derive movement speed from clip duration so feet stay in sync
          const clipDuration = a[runClip]!.getClip().duration;
          if (clipDuration > 0) runSpeedRef.current = STRIDE_LENGTH / clipDuration;
          a[runClip]!.reset().fadeIn(0.15).play();
        }
        if (idleClip) a[idleClip]?.fadeOut(0.15);
      } else if (!isMoving && walkingRef.current) {
        walkingRef.current = false;
        const runClip  = ANIM_RUN.find((n) => a[n]);
        const idleClip = ANIM_IDLE.find((n) => a[n]);
        if (runClip)  a[runClip]?.fadeOut(0.2);
        if (idleClip) a[idleClip]!.reset().fadeIn(0.2).play();
      }
    }

    // ── Camera: spherical orbit around character ──────────────────
    // Position = character + offset derived from yaw + pitch:
    //   x = sin(yaw) * cos(pitch) * r    (horizontal ring)
    //   y = sin(pitch) * r               (elevation)
    //   z = cos(yaw) * cos(pitch) * r    (horizontal ring)
    // lookAt a point slightly above the character's base so the character
    // stays centred in frame even when pitch is shallow.
    const pitch = pitchRef.current;
    const cpitch = Math.cos(pitch);
    const charX = group.position.x;
    const charY = group.position.y;
    const charZ = group.position.z;

    camera.position.set(
      charX + sinY  * cpitch * CAM_RADIUS,
      charY + Math.sin(pitch) * CAM_RADIUS + CAM_PIVOT_Y,
      charZ + cosY  * cpitch * CAM_RADIUS,
    );
    camera.lookAt(charX, charY + CAM_PIVOT_Y, charZ);

    // ── Proximity check ────────────────────────────────────────────
    const dx = charX - tx;
    const dz = charZ - tz;
    if (dx * dx + dz * dz < PROXIMITY_SQ) {
      completedRef.current = true;
      onCompleteRef.current();
    }
  });

  return (
    <mesh position={[tx, TILE_HEIGHT + 0.02, tz]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.35, 0.45, 32]} />
      <meshBasicMaterial
        ref={ringMatRef}
        color="#ffe066"
        transparent
        opacity={0.6}
      />
    </mesh>
  );
}
