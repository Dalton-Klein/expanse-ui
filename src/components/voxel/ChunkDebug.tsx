import React from "react";
import {
  ChunkData,
  VoxelType,
  CHUNK_SIZE,
  CHUNK_HEIGHT,
  VOXEL_SIZE,
} from "./types";

const voxelColors: { [key in VoxelType]: string } = {
  [VoxelType.AIR]: "#000000",
  [VoxelType.GRASS]: "#4ade80",
  [VoxelType.DIRT]: "#8b4513",
  [VoxelType.STONE]: "#808080",
  [VoxelType.SAND]: "#ffd700",
  [VoxelType.WATER]: "#0000ff",
};

interface ChunkProps {
  data: ChunkData;
}

export default function ChunkDebug({ data }: ChunkProps) {
  const voxels = [];

  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const voxel = data.voxels[x][y][z];
        if (voxel.type !== VoxelType.AIR) {
          const worldPos: [number, number, number] = [
            data.position[0] * CHUNK_SIZE + x,
            data.position[1] * CHUNK_SIZE + y,
            data.position[2] * CHUNK_SIZE + z,
          ];

          voxels.push(
            <mesh
              key={`${x}-${y}-${z}`}
              position={worldPos}
              castShadow
              receiveShadow
            >
              <boxGeometry
                args={[VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE]}
              />
              <meshLambertMaterial
                color={voxelColors[voxel.type]}
              />
            </mesh>
          );
        }
      }
    }
  }

  console.log(
    `Chunk [${data.position.join(", ")}]: Rendering ${
      voxels.length
    } individual voxels`
  );

  return <group>{voxels}</group>;
}
