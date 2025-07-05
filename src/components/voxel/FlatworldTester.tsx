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

        // Create stepped pattern - height varies by X position only
        const worldX = chunkX * CHUNK_SIZE + x;
        const stepHeight =
          baseHeight + (Math.floor(worldX / 8) % 4); // Steps of 0-3 blocks

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

// Mixed materials generator - complex patterns
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

        const worldX = chunkX * CHUNK_SIZE + x;
        const worldZ = chunkZ * CHUNK_SIZE + z;

        // Create irregular height variation
        const heightNoise =
          (Math.sin(worldX * 0.3) +
            Math.cos(worldZ * 0.3)) *
          1.5;
        const terrainHeight = Math.floor(
          baseHeight + heightNoise
        );

        if (y < terrainHeight - 3) {
          voxelType = VoxelType.STONE;
        } else if (y < terrainHeight) {
          voxelType = VoxelType.DIRT;
        } else if (y === terrainHeight) {
          // Complex material distribution
          const materialNoise =
            Math.sin(worldX * 0.2) * Math.cos(worldZ * 0.2);
          if (materialNoise > 0.3) {
            voxelType = VoxelType.STONE; // Stone outcroppings
          } else if (materialNoise < -0.3) {
            voxelType = VoxelType.SAND; // Sand patches
          } else {
            voxelType = VoxelType.GRASS; // Default grass
          }
        } else if (
          y === terrainHeight + 1 &&
          Math.random() > 0.9
        ) {
          // Occasional blocks on top for extra complexity
          voxelType = VoxelType.STONE;
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
  // Generate a 5x5 grid of chunks for testing greedy meshing
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
    for (let x = -1; x <= 1; x++) {
      for (let z = -1; z <= 1; z++) {
        chunks.push(generateChunkData(x, z));
      }
    }

    console.log(
      `FlatworldTester: Generated ${chunks.length} chunks with pattern: ${pattern}`
    );

    // Debug the stepped pattern generation
    if (pattern === "stepped") {
      console.log("=== STEPPED PATTERN DEBUG ===");
      const baseHeight = 16;
      for (let chunkX = -1; chunkX <= 1; chunkX++) {
        for (let chunkZ = -1; chunkZ <= 1; chunkZ++) {
          console.log(`Chunk [${chunkX}, ${chunkZ}]:`);
          // Check a few positions in this chunk
          for (let localX = 0; localX < 4; localX++) {
            const worldX = chunkX * CHUNK_SIZE + localX;
            const stepHeight =
              baseHeight + (Math.floor(worldX / 8) % 4);
            console.log(
              `  localX=${localX}, worldX=${worldX}, stepHeight=${stepHeight}`
            );
          }
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
          const stepHeight =
            baseHeight + (Math.floor(worldX / 8) % 4);
          if (worldY < stepHeight - 3) {
            return VoxelType.STONE;
          } else if (worldY < stepHeight) {
            return VoxelType.DIRT;
          } else if (worldY === stepHeight) {
            return stepHeight >= baseHeight + 2
              ? VoxelType.STONE
              : VoxelType.GRASS;
          }
          return VoxelType.AIR;
        }

        case "mixed": {
          const heightNoise =
            (Math.sin(worldX * 0.3) +
              Math.cos(worldZ * 0.3)) *
            1.5;
          const terrainHeight = Math.floor(
            baseHeight + heightNoise
          );

          if (worldY < terrainHeight - 3) {
            return VoxelType.STONE;
          } else if (worldY < terrainHeight) {
            return VoxelType.DIRT;
          } else if (worldY === terrainHeight) {
            const materialNoise =
              Math.sin(worldX * 0.2) *
              Math.cos(worldZ * 0.2);
            if (materialNoise > 0.3) {
              return VoxelType.STONE;
            } else if (materialNoise < -0.3) {
              return VoxelType.SAND;
            } else {
              return VoxelType.GRASS;
            }
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
            getVoxelAtWithLODCheck={undefined} // TEMPORARILY DISABLE cross-chunk face culling for testing
            wireframeMode={wireframeMode}
          />
        );
      })}
    </group>
  );
}
