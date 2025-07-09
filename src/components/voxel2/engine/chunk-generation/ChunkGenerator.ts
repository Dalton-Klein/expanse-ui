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
    const flatChunkHeight = 9; // 8 blocks tall for visualization, 1 block for padding
    const voxelType = VoxelType.GRASS;
    const chunkSizeP = CHUNK_SIZE + 2; // Padding for neighbor chunks
    // 2: Interate through x and z with assumed y, and fill chunk with flat terrain
    for (let x = 0; x < chunkSizeP; x++) {
      for (let z = 0; z < chunkSizeP; z++) {
        // Fill from Y=0 to Y=7 with blocks
        for (let y = 0; y < flatChunkHeight; y++) {
          // Make a large cube of grass, accounting for padding of neighbor chunks
          // Assume we can create faces at chunk borders in debug mode (make neighbor data remain as air)
          if (x !== 0 && z !== 0 && y !== 0) {
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
   * Generate simple small cube for baseline debugging
   * Creates an 2x2-block tall platform for better debugging of face generation
   */
  public static generateTinyChunk(
    startPos: Position3D
  ): ChunkData {
    // 1: Initialize empty chunk
    let chunk = ChunkHelpers.createEmpty(startPos);
    const tinyTestSize = 3; // 2x2 blocks tall for visualization, 1 block for padding
    const voxelType = VoxelType.GRASS;
    // 2: Interate through x and z with assumed y, and fill chunk with flat terrain
    for (let x = 0; x < tinyTestSize; x++) {
      for (let z = 0; z < tinyTestSize; z++) {
        // Fill from Y=0 to Y=7 with blocks
        for (let y = 0; y < tinyTestSize; y++) {
          if (x !== 0 && z !== 0 && y !== 0) {
            // small cube of grass, accounting for padding of neighbor chunks
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

    // 2: Generate the stepped pattern
    const chunkSizeP = CHUNK_SIZE + 2; // Padding for neighbor chunks

    // Use padded coordinates (1 to CHUNK_SIZE) to account for neighbor data
    for (let x = 1; x <= CHUNK_SIZE; x++) {
      for (let z = 1; z <= CHUNK_SIZE; z++) {
        // Calculate world coordinates (subtract 1 to convert from padded to chunk coordinates)
        const worldX = chunk.position.x + (x - 1);
        const worldZ = chunk.position.z + (z - 1);

        // Create diagonal stepping pattern
        const diagonalIndex = worldX + worldZ;
        const stepHeight = 1 + (diagonalIndex % 4); // Heights 1-4

        // Choose material based on height
        let voxelType: VoxelType;
        switch (stepHeight) {
          case 1:
            voxelType = VoxelType.GRASS;
            break;
          case 2:
            voxelType = VoxelType.DIRT;
            break;
          case 3:
            voxelType = VoxelType.STONE;
            break;
          case 4:
            voxelType = VoxelType.SAND;
            break;
          default:
            voxelType = VoxelType.GRASS;
        }

        // Fill from Y=1 up to step height (accounting for padding)
        for (let y = 1; y <= stepHeight; y++) {
          ChunkHelpers.setVoxel(chunk, x, y, z, {
            type: voxelType,
          });
        }
      }
    }

    return chunk;
  }
}
