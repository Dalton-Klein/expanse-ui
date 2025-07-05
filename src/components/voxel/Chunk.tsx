import React, { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import {
  ChunkData,
  VoxelType,
  CHUNK_SIZE,
  CHUNK_HEIGHT,
  VOXEL_SIZE,
} from "./types";

const voxelColors: { [key in VoxelType]: number } = {
  [VoxelType.AIR]: 0x000000,
  [VoxelType.GRASS]: 0x4ade80,
  [VoxelType.DIRT]: 0x8b4513,
  [VoxelType.STONE]: 0x808080,
  [VoxelType.SAND]: 0xffd700,
  [VoxelType.WATER]: 0x0000ff,
};

interface ChunkProps {
  data: ChunkData;
}

export default function Chunk({ data }: ChunkProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const { instanceCount, positions, colors } =
    useMemo(() => {
      let count = 0;
      const tempPositions: [number, number, number][] = [];
      const tempColors: number[] = [];

      for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          for (let z = 0; z < CHUNK_SIZE; z++) {
            const voxel = data.voxels[x][y][z];
            if (voxel.type !== VoxelType.AIR) {
              tempPositions.push([
                data.position[0] * CHUNK_SIZE + x,
                data.position[1] * CHUNK_SIZE + y,
                data.position[2] * CHUNK_SIZE + z,
              ]);
              tempColors.push(voxelColors[voxel.type]);
              count++;
            }
          }
        }
      }

      return {
        instanceCount: count,
        positions: tempPositions,
        colors: tempColors,
      };
    }, [data]);

  // Set up instance matrices and colors
  useEffect(() => {
    if (!meshRef.current || instanceCount === 0) return;

    const mesh = meshRef.current;
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();

    positions.forEach((pos, i) => {
      // Set position
      matrix.setPosition(pos[0], pos[1], pos[2]);
      mesh.setMatrixAt(i, matrix);

      // Set color
      color.setHex(colors[i]);
      mesh.setColorAt(i, color);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor)
      mesh.instanceColor.needsUpdate = true;
  }, [data, instanceCount, positions, colors]);

  // Don't render if no voxels
  if (instanceCount === 0) {
    console.warn(
      `Chunk at [${data.position.join(
        ", "
      )}] has no voxels to render`
    );
    return null;
  }

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, instanceCount]}
      castShadow
      receiveShadow
    >
      <boxGeometry
        args={[VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE]}
      />
      <meshLambertMaterial vertexColors />
    </instancedMesh>
  );
}
