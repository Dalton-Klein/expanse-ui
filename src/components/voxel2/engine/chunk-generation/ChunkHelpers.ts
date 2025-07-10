import {
  ChunkData,
  Position3D,
  Voxel,
  VoxelType,
} from "../../types";
import { CHUNK_SIZE } from "../TerrainConfig";

// Chunk data management for voxel2 system
// TODO: Implement chunk data utilities and management

export class ChunkHelpers {
  // Create empty chunk
  static createEmpty(chunkPos: Position3D): ChunkData {
    const CHUNK_SIZE_P = CHUNK_SIZE + 2; // Padding for neighbor chunks
    const voxels: Voxel[][][] = [];
    // Initialize 3D array
    for (let x = 0; x < CHUNK_SIZE_P; x++) {
      voxels[x] = [];
      for (let y = 0; y < CHUNK_SIZE_P; y++) {
        voxels[x][y] = [];
        for (let z = 0; z < CHUNK_SIZE_P; z++) {
          voxels[x][y][z] = { type: VoxelType.AIR };
        }
      }
    }
    return {
      position: chunkPos,
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
    const CHUNK_SIZE_P = CHUNK_SIZE + 2; // Padding for neighbor chunks
    if (
      x < 0 ||
      x >= CHUNK_SIZE_P ||
      y < 0 ||
      y >= CHUNK_SIZE_P ||
      z < 0 ||
      z >= CHUNK_SIZE_P
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
    const CHUNK_SIZE_P = CHUNK_SIZE + 2;
    if (
      x < 0 ||
      x >= CHUNK_SIZE_P ||
      y < 0 ||
      y >= CHUNK_SIZE_P ||
      z < 0 ||
      z >= CHUNK_SIZE_P
    ) {
      return false;
    }

    chunk.voxels[x][y][z] = voxel;
    return true;
  }

  static getChunkEndPosFromStartPos(
    startPos: Position3D
  ): Position3D {
    return {
      x: startPos.x + CHUNK_SIZE - 1,
      y: startPos.y + CHUNK_SIZE - 1,
      z: startPos.z + CHUNK_SIZE - 1,
    };
  }
}

// TODO: Add chunk management system
// TODO: Add chunk caching
// TODO: Add chunk loading/unloading
