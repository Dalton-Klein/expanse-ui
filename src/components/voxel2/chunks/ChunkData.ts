import {
  ChunkData,
  Position3D,
  Voxel,
  VoxelType,
} from "../types";
import {
  CHUNK_SIZE,
  CHUNK_HEIGHT,
} from "../terrain/TerrainConfig";

// Chunk data management for voxel2 system
// TODO: Implement chunk data utilities and management

export class ChunkDataUtils {
  // Create empty chunk
  static createEmpty(startPos: Position3D): ChunkData {
    const voxels: Voxel[][][] = [];
    // Dynamically set end postion based on start position and chunk size
    let endPos: Position3D = {
      x: startPos.x + CHUNK_SIZE - 1,
      y: startPos.y + CHUNK_HEIGHT - 1,
      z: startPos.z + CHUNK_SIZE - 1,
    };
    // Initialize 3D array
    for (let x = startPos.x; x < endPos.x; x++) {
      voxels[x] = [];
      for (let y = startPos.y; y < endPos.y; y++) {
        voxels[x][y] = [];
        for (let z = startPos.z; z < endPos.z; z++) {
          voxels[x][y][z] = { type: VoxelType.AIR };
        }
      }
    }

    return {
      position: startPos,
      voxels,
    };
  }

  // Get voxel at local coordinates
  static getVoxel(
    chunk: ChunkData,
    x: number,
    y: number,
    z: number
  ): Voxel | null {
    // TODO: Add bounds checking
    if (
      x < 0 ||
      x >= CHUNK_SIZE ||
      y < 0 ||
      y >= CHUNK_HEIGHT ||
      z < 0 ||
      z >= CHUNK_SIZE
    ) {
      return null;
    }

    return chunk.voxels[x][y][z];
  }

  // Set voxel at local coordinates
  static setVoxel(
    chunk: ChunkData,
    x: number,
    y: number,
    z: number,
    voxel: Voxel
  ): boolean {
    // TODO: Add bounds checking
    if (
      x < 0 ||
      x >= CHUNK_SIZE ||
      y < 0 ||
      y >= CHUNK_HEIGHT ||
      z < 0 ||
      z >= CHUNK_SIZE
    ) {
      return false;
    }

    chunk.voxels[x][y][z] = voxel;
    return true;
  }

  // TODO: Add chunk utilities:
  // - Chunk validation
  // - Chunk serialization
  // - Chunk comparison
  // - Chunk statistics
}

// TODO: Add chunk management system
// TODO: Add chunk caching
// TODO: Add chunk loading/unloading
