import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import { SPIRAL_PATH } from "../../lib/constants";
import BoardSurface3D from "./BoardSurface3D";
import PathLine3D from "./PathLine3D";
import PlayersLayer3D from "./PlayersLayer3D";

function LogoPlane() {
  const texture = useTexture(`${import.meta.env.BASE_URL}assets/logo.svg`);
  return (
    <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[2.5, 2.5]} />
      <meshBasicMaterial map={texture} transparent opacity={0.35} />
    </mesh>
  );
}

function Scene() {
  const totalTiles = SPIRAL_PATH.length;

  return (
    <>
      <ambientLight intensity={0.65} />
      <directionalLight
        position={[5, 10, 5]}
        intensity={1.1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-5, 6, -5]} intensity={0.35} />

      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={4}
        maxDistance={20}
      />

      <BoardSurface3D />
      <PathLine3D totalTiles={totalTiles} />
      <PlayersLayer3D />

      <Suspense fallback={null}>
        <LogoPlane />
      </Suspense>
    </>
  );
}

export default function Board3D() {
  return (
    <div className="w-full h-full relative">
      <Canvas
        style={{ position: "absolute", inset: 0 }}
        camera={{ position: [0, 8, 7], fov: 45 }}
        shadows
      >
        <Scene />
      </Canvas>
    </div>
  );
}
