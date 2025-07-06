import React, { useMemo, useCallback } from "react";
import ChunkGreedyMesher from "./ChunkGreedyMesher";
import {
  VoxelType,
  CHUNK_SIZE,
  CHUNK_HEIGHT,
  LODLevel,
} from "./types";

interface FlatworldTesterProps {
  wireframeMode?: boolean;
  pattern?: string;
}

// Simple flat terrain data generator
const generateFlatChunkData = (
  chunkX: number,
  chunkZ: number
) => {
  const voxels: any = [];
  const flatHeight = 16; // One block above sea level

  for (let x = 0; x < CHUNK_SIZE; x++) {
    voxels[x] = [];
    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      voxels[x][y] = [];
      for (let z = 0; z < CHUNK_SIZE; z++) {
        let voxelType = VoxelType.AIR;

        if (y < flatHeight - 3) {
          voxelType = VoxelType.STONE; // Stone at bottom
        } else if (y < flatHeight) {
          voxelType = VoxelType.DIRT; // Dirt layer
        } else if (y === flatHeight) {
          voxelType = VoxelType.GRASS; // Grass surface
        }
        // else remains AIR

        voxels[x][y][z] = { type: voxelType };
      }
    }
  }

  return {
    position: [chunkX, 0, chunkZ] as [
      number,
      number,
      number
    ],
    voxels,
    lodLevel: LODLevel.FULL,
    lodScale: 1,
  };
};

// Checkerboard pattern generator - alternating materials
const generateCheckerboardChunkData = (
  chunkX: number,
  chunkZ: number
) => {
  const voxels: any = [];
  const baseHeight = 16;

  for (let x = 0; x < CHUNK_SIZE; x++) {
    voxels[x] = [];
    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      voxels[x][y] = [];
      for (let z = 0; z < CHUNK_SIZE; z++) {
        let voxelType = VoxelType.AIR;

        if (y < baseHeight - 3) {
          voxelType = VoxelType.STONE;
        } else if (y < baseHeight) {
          voxelType = VoxelType.DIRT;
        } else if (y === baseHeight) {
          // Checkerboard pattern on surface
          const worldX = chunkX * CHUNK_SIZE + x;
          const worldZ = chunkZ * CHUNK_SIZE + z;
          const isEven = (worldX + worldZ) % 2 === 0;
          voxelType = isEven
            ? VoxelType.GRASS
            : VoxelType.DIRT;
        }

        voxels[x][y][z] = { type: voxelType };
      }
    }
  }

  return {
    position: [chunkX, 0, chunkZ] as [
      number,
      number,
      number
    ],
    voxels,
    lodLevel: LODLevel.FULL,
    lodScale: 1,
  };
};

// Stepped terrain generator - height variations
const generateSteppedChunkData = (
  chunkX: number,
  chunkZ: number
) => {
  const voxels: any = [];
  const baseHeight = 16;

  for (let x = 0; x < CHUNK_SIZE; x++) {
    voxels[x] = [];
    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      voxels[x][y] = [];
      for (let z = 0; z < CHUNK_SIZE; z++) {
        let voxelType = VoxelType.AIR;

        // Create stepped pattern - height varies diagonally per voxel
        const worldX = chunkX * CHUNK_SIZE + x;
        const worldZ = chunkZ * CHUNK_SIZE + z;
        // Step up by 1 block every diagonal voxel
        const diagonalIndex = worldX + worldZ;
        const stepHeight = baseHeight + (diagonalIndex % 10); // Step up immediately, mod 10 to limit height

        if (y < stepHeight - 3) {
          voxelType = VoxelType.STONE;
        } else if (y < stepHeight) {
          voxelType = VoxelType.DIRT;
        } else if (y === stepHeight) {
          // Different materials at different heights
          if (stepHeight >= baseHeight + 2) {
            voxelType = VoxelType.STONE; // High areas are stone
          } else {
            voxelType = VoxelType.GRASS; // Low areas are grass
          }
        }

        voxels[x][y][z] = { type: voxelType };
      }
    }
  }

  return {
    position: [chunkX, 0, chunkZ] as [
      number,
      number,
      number
    ],
    voxels,
    lodLevel: LODLevel.FULL,
    lodScale: 1,
  };
};

// Mixed materials generator - stepped heights with different materials
const generateMixedMaterialChunkData = (
  chunkX: number,
  chunkZ: number
) => {
  const voxels: any = [];
  const baseHeight = 16;

  for (let x = 0; x < CHUNK_SIZE; x++) {
    voxels[x] = [];
    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      voxels[x][y] = [];
      for (let z = 0; z < CHUNK_SIZE; z++) {
        let voxelType = VoxelType.AIR;

        // Use same stepped height logic as stepped pattern - per voxel
        const worldX = chunkX * CHUNK_SIZE + x;
        const worldZ = chunkZ * CHUNK_SIZE + z;
        const diagonalIndex = worldX + worldZ;
        const stepHeight = baseHeight + (diagonalIndex % 10);

        if (y < stepHeight - 3) {
          voxelType = VoxelType.STONE; // Deep layers always stone
        } else if (y < stepHeight) {
          voxelType = VoxelType.DIRT; // Subsurface always dirt
        } else if (y === stepHeight) {
          // Different surface material based on height step
          const materials = [
            VoxelType.GRASS,  // Height 16
            VoxelType.DIRT,   // Height 17
            VoxelType.SAND,   // Height 18
            VoxelType.STONE,  // Height 19
            VoxelType.GRASS,  // Height 20 (cycle back)
          ];
          const materialIndex = (stepHeight - baseHeight) % materials.length;
          voxelType = materials[materialIndex];
        }

        voxels[x][y][z] = { type: voxelType };
      }
    }
  }

  return {
    position: [chunkX, 0, chunkZ] as [
      number,
      number,
      number
    ],
    voxels,
    lodLevel: LODLevel.FULL,
    lodScale: 1,
  };
};

export default function FlatworldTester({
  wireframeMode = false,
  pattern = "flat",
}: FlatworldTesterProps) {
  // Generate a 3x3 grid of chunks for testing greedy meshing
  const flatChunks = useMemo(() => {
    const chunks = [];

    // Select generator based on pattern
    let generateChunkData;
    switch (pattern) {
      case "checkerboard":
        generateChunkData = generateCheckerboardChunkData;
        break;
      case "stepped":
        generateChunkData = generateSteppedChunkData;
        break;
      case "mixed":
        generateChunkData = generateMixedMaterialChunkData;
        break;
      default:
        generateChunkData = generateFlatChunkData;
        break;
    }

    // Create chunks at origin since main terrain is unloaded when flatworld is active
    const gridSize = 2; // Half-size: -2 to +2 = 5x5 grid
    for (let x = -gridSize; x <= gridSize; x++) {
      for (let z = -gridSize; z <= gridSize; z++) {
        chunks.push(generateChunkData(x, z));
      }
    }

    // Debug the stepped pattern generation
    if (pattern === "stepped") {
      const baseHeight = 16;
      console.log(`=== IMMEDIATE DIAGONAL STEPPED PATTERN DEBUG ===`);
      // Show sample heights at adjacent positions to demonstrate immediate stepping
      for (let sampleX = -2; sampleX <= 2; sampleX += 1) {
        for (let sampleZ = -2; sampleZ <= 2; sampleZ += 1) {
          const diagonalIndex = sampleX + sampleZ;
          const stepHeight = baseHeight + (diagonalIndex % 10);
          console.log(`  World pos (${sampleX}, ${sampleZ}) -> diagonalIndex=${diagonalIndex} height=${stepHeight}`);
        }
      }
    }

    return chunks;
  }, [pattern]);

  // Pattern-aware voxel lookup for cross-chunk queries
  const getVoxelAt = useCallback(
    (
      worldX: number,
      worldY: number,
      worldZ: number
    ): VoxelType => {
      const baseHeight = 16;

      // Debug logging for top face checks in stepped pattern
      if (
        pattern === "stepped" &&
        worldY > baseHeight + 3
      ) {
        const stepHeight =
          baseHeight + (Math.floor(worldX / 8) % 4);
        console.log(
          `Top face check: world(${worldX}, ${worldY}, ${worldZ}) stepHeight=${stepHeight} -> returning AIR`
        );
      }

      switch (pattern) {
        case "checkerboard": {
          if (worldY < baseHeight - 3) {
            return VoxelType.STONE;
          } else if (worldY < baseHeight) {
            return VoxelType.DIRT;
          } else if (worldY === baseHeight) {
            const isEven = (worldX + worldZ) % 2 === 0;
            return isEven
              ? VoxelType.GRASS
              : VoxelType.DIRT;
          }
          return VoxelType.AIR;
        }

        case "stepped": {
          // Step up by 1 block every diagonal voxel
          const diagonalIndex = worldX + worldZ;
          const stepHeight = baseHeight + (diagonalIndex % 10);
          
          if (worldY < stepHeight - 3) {
            return VoxelType.STONE;
          } else if (worldY < stepHeight) {
            return VoxelType.DIRT;
          } else if (worldY === stepHeight) {
            return stepHeight >= baseHeight + 5
              ? VoxelType.STONE
              : VoxelType.GRASS;
          }
          return VoxelType.AIR;
        }

        case "mixed": {
          // Use same logic as stepped pattern for heights - per voxel
          const diagonalIndex = worldX + worldZ;
          const stepHeight = baseHeight + (diagonalIndex % 10);

          if (worldY < stepHeight - 3) {
            return VoxelType.STONE;
          } else if (worldY < stepHeight) {
            return VoxelType.DIRT;
          } else if (worldY === stepHeight) {
            // Same material assignment as in generation
            const materials = [
              VoxelType.GRASS,  // Height 16
              VoxelType.DIRT,   // Height 17
              VoxelType.SAND,   // Height 18
              VoxelType.STONE,  // Height 19
              VoxelType.GRASS,  // Height 20 (cycle back)
            ];
            const materialIndex = (stepHeight - baseHeight) % materials.length;
            return materials[materialIndex];
          }
          return VoxelType.AIR;
        }

        default: {
          // Flat pattern
          if (worldY < baseHeight - 3) {
            return VoxelType.STONE;
          } else if (worldY < baseHeight) {
            return VoxelType.DIRT;
          } else if (worldY === baseHeight) {
            return VoxelType.GRASS;
          }
          return VoxelType.AIR;
        }
      }
    },
    [pattern]
  );

  console.log(
    `FlatworldTester rendering ${flatChunks.length} chunks with wireframe: ${wireframeMode}`
  );

  return (
    <group>
      {flatChunks.map((chunkData, index) => {
        return (
          <ChunkGreedyMesher
            key={`flatworld-${chunkData.position[0]}-${chunkData.position[2]}`}
            data={chunkData}
            getVoxelAt={getVoxelAt}
            getVoxelAtWithLODCheck={getVoxelAt} // Re-enable cross-chunk face culling
            wireframeMode={wireframeMode}
          />
        );
      })}
    </group>
  );
}
