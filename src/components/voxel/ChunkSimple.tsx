import React, { useMemo } from "react";
import { ChunkData, VoxelType, CHUNK_SIZE, CHUNK_HEIGHT, VOXEL_SIZE } from "./types";

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

export default function ChunkSimple({ data }: ChunkProps) {
  const voxelsByType = useMemo(() => {
    const groups: { [key in VoxelType]?: [number, number, number][] } = {};
    
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
          const voxel = data.voxels[x][y][z];
          if (voxel.type !== VoxelType.AIR) {
            if (!groups[voxel.type]) groups[voxel.type] = [];
            groups[voxel.type]!.push([
              data.position[0] * CHUNK_SIZE + x,
              data.position[1] * CHUNK_SIZE + y,
              data.position[2] * CHUNK_SIZE + z
            ]);
          }
        }
      }
    }
    
    return groups;
  }, [data]);

  return (
    <group>
      {Object.entries(voxelsByType).map(([type, positions]) => {
        const voxelType = parseInt(type) as VoxelType;
        const color = voxelColors[voxelType];
        
        return (
          <instancedMesh key={type} args={[undefined, undefined, positions!.length]} castShadow receiveShadow>
            <boxGeometry args={[VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE]} />
            <meshLambertMaterial color={color} />
            {positions!.map((pos, i) => (
              <mesh key={i} position={pos} visible={false} />
            ))}
          </instancedMesh>
        );
      })}
    </group>
  );
}