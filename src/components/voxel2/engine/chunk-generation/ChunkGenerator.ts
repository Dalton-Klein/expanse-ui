import {
  ChunkData,
  Position3D,
  VoxelType,
} from "../../types";
import { CHUNK_SIZE, CHUNK_HEIGHT } from "../TerrainConfig";
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
    const flatChunkHeight = 8; // 8 blocks tall for better visualization
    const voxelType = VoxelType.GRASS;
    // 2: Interate through x and z with assumed y, and fill chunk with flat terrain
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        // Fill from Y=0 to Y=7 with blocks
        for (let y = 0; y < flatChunkHeight; y++) {
          // Top layer is grass, rest is dirt
          ChunkHelpers.setVoxel(chunk, x, y, z, {
            type: voxelType,
          });
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
    const tinyTestSize = 2; // 8 blocks tall for better visualization
    const voxelType = VoxelType.GRASS;
    // 2: Interate through x and z with assumed y, and fill chunk with flat terrain
    for (let x = 0; x < tinyTestSize; x++) {
      for (let z = 0; z < tinyTestSize; z++) {
        // Fill from Y=0 to Y=7 with blocks
        for (let y = 0; y < tinyTestSize; y++) {
          // Top layer is grass, rest is dirt
          ChunkHelpers.setVoxel(chunk, x, y, z, {
            type: voxelType,
          });
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
   * Generate stepped pattern
   * Diagonal height variations with different materials
   */
  private static generateSteppedPattern(
    chunk: ChunkData
  ): void {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        // Calculate world coordinates
        const worldX = chunk.position.x * CHUNK_SIZE + x;
        const worldZ = chunk.position.z * CHUNK_SIZE + z;

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

        // Fill from Y=1 up to step height
        for (let y = 1; y <= stepHeight; y++) {
          ChunkHelpers.setVoxel(chunk, x, y, z, {
            type: voxelType,
          });
        }
      }
    }
  }
}
