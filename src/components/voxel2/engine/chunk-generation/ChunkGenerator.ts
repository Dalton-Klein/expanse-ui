import {
  ChunkData,
  Position3D,
  VoxelType,
} from "../../types";
import { CHUNK_SIZE } from "../TerrainConfig";
import { ChunkHelpers } from "./ChunkHelpers";

/**
 * Debug terrain generator for testing and development
 * Creates predictable terrain patterns for debugging greedy meshing and LOD systems
 */
export class ChunkGenerator {
  /**
   * Generate flat terrain pattern
   * Creates an 8-block tall platform for better debugging of face generation
   */
  public static generateFlatChunk(
    startPos: Position3D
  ): ChunkData {
    // 1: Initialize empty chunk
    let chunk = ChunkHelpers.createEmpty(startPos);
    const platformHeight = 8; // Platform height in world coordinates
    const voxelType = VoxelType.GRASS;

    // Determine if this chunk contains the platform (platform is at world Y=8)
    const chunkMinY = startPos.y;
    const chunkMaxY = startPos.y + CHUNK_SIZE - 1;

    // Only fill if the platform height intersects with this chunk
    if (
      platformHeight >= chunkMinY &&
      platformHeight <= chunkMaxY
    ) {
      // 2: Iterate through x and z and fill at the platform level
      for (let x = 1; x <= CHUNK_SIZE; x++) {
        for (let z = 1; z <= CHUNK_SIZE; z++) {
          // Calculate local Y position for the platform
          const localY = platformHeight - chunkMinY + 1;

          // Fill from bottom of chunk up to platform height
          for (
            let y = 1;
            y <= localY && y <= CHUNK_SIZE;
            y++
          ) {
            ChunkHelpers.setVoxel(chunk, x, y, z, {
              type: voxelType,
            });
          }
        }
      }
    } else if (chunkMaxY < platformHeight) {
      // If chunk is entirely below platform, fill it completely
      for (let x = 1; x <= CHUNK_SIZE; x++) {
        for (let z = 1; z <= CHUNK_SIZE; z++) {
          for (let y = 1; y <= CHUNK_SIZE; y++) {
            ChunkHelpers.setVoxel(chunk, x, y, z, {
              type: VoxelType.STONE,
            });
          }
        }
      }
    }
    // If chunk is above platform, leave it as air

    return chunk;
  }

  /**
   * Generate simple small cube for baseline debugging
   * Creates a 2x2x2 cube at world position (10,10,10)
   */
  public static generateTinyChunk(
    startPos: Position3D
  ): ChunkData {
    // 1: Initialize empty chunk
    let chunk = ChunkHelpers.createEmpty(startPos);
    const voxelType = VoxelType.GRASS;

    // Define the world position of the tiny cube
    const cubeWorldPos = { x: 10, y: 10, z: 10 };
    const cubeSize = 2;

    // Check if this chunk contains any part of the cube
    const chunkMinX = startPos.x;
    const chunkMinY = startPos.y;
    const chunkMinZ = startPos.z;
    const chunkMaxX = startPos.x + CHUNK_SIZE - 1;
    const chunkMaxY = startPos.y + CHUNK_SIZE - 1;
    const chunkMaxZ = startPos.z + CHUNK_SIZE - 1;

    // Check if cube intersects with this chunk
    if (
      cubeWorldPos.x >= chunkMinX &&
      cubeWorldPos.x < chunkMaxX &&
      cubeWorldPos.y >= chunkMinY &&
      cubeWorldPos.y < chunkMaxY &&
      cubeWorldPos.z >= chunkMinZ &&
      cubeWorldPos.z < chunkMaxZ
    ) {
      // Fill the cube within this chunk
      for (let dx = 0; dx < cubeSize; dx++) {
        for (let dy = 0; dy < cubeSize; dy++) {
          for (let dz = 0; dz < cubeSize; dz++) {
            const worldX = cubeWorldPos.x + dx;
            const worldY = cubeWorldPos.y + dy;
            const worldZ = cubeWorldPos.z + dz;

            // Convert to local chunk coordinates (with padding offset)
            const localX = worldX - chunkMinX + 1;
            const localY = worldY - chunkMinY + 1;
            const localZ = worldZ - chunkMinZ + 1;

            // Ensure we're within chunk bounds
            if (
              localX >= 1 &&
              localX <= CHUNK_SIZE &&
              localY >= 1 &&
              localY <= CHUNK_SIZE &&
              localZ >= 1 &&
              localZ <= CHUNK_SIZE
            ) {
              ChunkHelpers.setVoxel(
                chunk,
                localX,
                localY,
                localZ,
                {
                  type: voxelType,
                }
              );
            }
          }
        }
      }
    }

    return chunk;
  }

  /**
   * Generate checkerboard pattern chunk
   * Alternating grass and dirt blocks at Y=1
   */
  private static generateCheckerboardChunk(
    chunk: ChunkData
  ): void {
    const baseHeight = 1;

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        // Create checkerboard pattern
        const isEven = (x + z) % 2 === 0;
        const voxelType = isEven
          ? VoxelType.GRASS
          : VoxelType.DIRT;

        ChunkHelpers.setVoxel(chunk, x, baseHeight, z, {
          type: voxelType,
        });
      }
    }
  }

  /**
   * Generate stepped terrain pattern
   * Creates diagonal height variations with different materials for debugging
   */
  public static generateSteppedChunk(
    startPos: Position3D
  ): ChunkData {
    // 1: Initialize empty chunk
    let chunk = ChunkHelpers.createEmpty(startPos);

    // Get chunk Y bounds
    const chunkMinY = startPos.y;

    // Use padded coordinates (1 to CHUNK_SIZE) to account for neighbor data
    for (let x = 1; x <= CHUNK_SIZE; x++) {
      for (let z = 1; z <= CHUNK_SIZE; z++) {
        // Calculate world coordinates (subtract 1 to convert from padded to chunk coordinates)
        const worldX = chunk.position.x + (x - 1);
        const worldZ = chunk.position.z + (z - 1);

        // Create diagonal stepping pattern - heights vary from 4 to 16 blocks
        const diagonalIndex = worldX + worldZ;
        const worldStepHeight = 4 + (diagonalIndex % 13); // World Y heights 4-16

        // Choose material based on height
        let voxelType: VoxelType;
        const heightMod = worldStepHeight % 4;
        switch (heightMod) {
          case 0:
            voxelType = VoxelType.GRASS;
            break;
          case 1:
            voxelType = VoxelType.DIRT;
            break;
          case 2:
            voxelType = VoxelType.STONE;
            break;
          case 3:
            voxelType = VoxelType.SAND;
            break;
          default:
            voxelType = VoxelType.GRASS;
        }

        // Fill voxels in this chunk that are at or below the step height
        for (let y = 1; y <= CHUNK_SIZE; y++) {
          const worldY = chunkMinY + y - 1;
          if (worldY <= worldStepHeight) {
            ChunkHelpers.setVoxel(chunk, x, y, z, {
              type: voxelType,
            });
          }
        }
      }
    }

    return chunk;
  }

  /**
   * Generate two separate 2x2x2 cubes for face culling debugging
   * Creates two isolated cubes with air gap between them to test side face generation
   */
  public static generateTwoCubesChunk(
    startPos: Position3D
  ): ChunkData {
    // 1: Initialize empty chunk
    let chunk = ChunkHelpers.createEmpty(startPos);

    const voxelType = VoxelType.GRASS;

    // 2: Generate first cube at position (2,2,2) to (3,3,3) in padded coordinates
    for (let x = 1; x <= 2; x++) {
      for (let y = 1; y <= 2; y++) {
        for (let z = 1; z <= 2; z++) {
          ChunkHelpers.setVoxel(chunk, x, y, z, {
            type: voxelType,
          });
        }
      }
    }

    // 3: Generate second cube at position (5,2,2) to (6,3,3) in padded coordinates
    // This creates a 1-block air gap between the cubes (x=4 is air)
    for (let x = 5; x <= 6; x++) {
      for (let y = 1; y <= 2; y++) {
        for (let z = 1; z <= 2; z++) {
          ChunkHelpers.setVoxel(chunk, x, y, z, {
            type: voxelType,
          });
        }
      }
    }

    return chunk;
  }
}
