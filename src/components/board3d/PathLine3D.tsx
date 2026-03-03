import { useMemo, useEffect } from "react";
import { CatmullRomCurve3, TubeGeometry, Vector3 } from "three";
import { SPIRAL_PATH } from "../../lib/constants";
import { gridIndexTo3D, TILE_HEIGHT } from "./utils3d";

interface Props {
  totalTiles: number;
}

export default function PathLine3D({ totalTiles }: Props) {
  const geometry = useMemo(() => {
    const activePath = SPIRAL_PATH.slice(0, totalTiles);
    if (activePath.length < 2) return null;

    const points = activePath.map((gridIndex) => {
      const [x, , z] = gridIndexTo3D(gridIndex);
      // Run through the vertical centre of the tiles so the tile geometry
      // occludes the tube where they overlap, revealing a pipe cross-section
      // only in the gaps between tiles.
      return new Vector3(x, TILE_HEIGHT / 2, z);
    });

    // tension=0 → straight lines between axis-aligned grid centres (no overshoot at corners)
    const curve = new CatmullRomCurve3(points, false, "catmullrom", 0);
    return new TubeGeometry(curve, totalTiles * 2, 0.05, 12, false);
  }, [totalTiles]);

  useEffect(() => {
    return () => {
      geometry?.dispose();
    };
  }, [geometry]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#ffffff" roughness={0.2} metalness={0.6} />
    </mesh>
  );
}
