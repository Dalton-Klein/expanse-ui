import * as THREE from "three";
import {
  ChunkData,
  Position3D,
  VoxelType,
  TerrainResult,
  ChunkMeshResult,
} from "../../types";
import { CHUNK_SIZE } from "../TerrainConfig";
import { ChunkHelpers } from "../chunk-generation/ChunkHelpers";
import { ChunkGenerator } from "../chunk-generation/ChunkGenerator";

// Type for axis columns using native 32-bit integers
// Each axis stores columns in different arrangements (same as TanTanDev):
// axisCols[0] (Y-axis): [z][x] - column along Y at position (x,z)
// axisCols[1] (X-axis): [y][z] - column along X at position (y,z)
// axisCols[2] (Z-axis): [y][x] - column along Z at position (x,y)
type AxisColumns = number[][][];

// GreedyMesher is a class that implements the greedy meshing algorithm and face culling
// It is based on TanTanDevs binary greedy meshing algorithm found here: https://github.com/TanTanDev/binary_greedy_mesher_demo
export class GreedyMesher {
  public static generateMeshForChunk(
    chunk: ChunkData
  ): ChunkMeshResult {
    const startTime = performance.now();

    let result: ChunkMeshResult = {
      geometry: new THREE.BufferGeometry(),
      triangleCount: 0,
      generationTime: 0,
    };

    // 1. Binary Encoding- Convert 3d array chunk data into binary columns
    const axisCols = this.encodeToBinary(chunk);

    // 2. Face Culling- Cull voxel faces based on adjacency to air, use bitwise operations to find face transitions
    const faceMasks =
      this.generateFaceCullingMasks(axisCols);

    // 3. Group Faces By Block Type (And Later Ambient Occlusion)- Create 2D binary planes for each unique combination
    //    - Store as data[axis][block_hash][y_level] = 32x32 binary plane
    // 4. Greedy algorithm- For each 2D binary plane, apply the greedy algorithm
    //    - Expand rectangles first vertically (height), then horizontally (width)
    //    - Clear bits as they're merged to avoid duplicate processing
    // 5. Generate Geometry (And Later Ambient Occlusion)- Convert greedy quads to vertices with proper winding order

    const endTime = performance.now();
    result.generationTime = endTime - startTime;

    return result;
  }

  /**
   * 1. Convert 3D voxel data into binary columns for efficient face culling
   * Based on TanTanDev's binary greedy meshing algorithm
   */
  private static encodeToBinary(
    chunk: ChunkData
  ): AxisColumns {
    // With padding for neighbors: 30 + 2 = 32 (perfect for 32-bit integer operations native to JS)
    const CHUNK_SIZE_P = CHUNK_SIZE + 2; // 32

    // Initialize 3 axes of binary columns
    // Each axis stores columns in different arrangements (same as TanTanDev):
    // axisCols[0] (Y-axis): [z][x] - column along Y at position (x,z)
    // axisCols[1] (X-axis): [y][z] - column along X at position (y,z)
    // axisCols[2] (Z-axis): [y][x] - column along Z at position (x,y)
    const axisCols: AxisColumns = [
      Array(CHUNK_SIZE_P)
        .fill(null)
        .map(() => new Array(CHUNK_SIZE_P).fill(0)),
      Array(CHUNK_SIZE_P)
        .fill(null)
        .map(() => new Array(CHUNK_SIZE_P).fill(0)),
      Array(CHUNK_SIZE_P)
        .fill(null)
        .map(() => new Array(CHUNK_SIZE_P).fill(0)),
    ];

    // Process the full 32x32x32 space (including neighbor padding)
    for (let x = 0; x < CHUNK_SIZE_P; x++) {
      for (let y = 0; y < CHUNK_SIZE_P; y++) {
        for (let z = 0; z < CHUNK_SIZE_P; z++) {
          const voxel = ChunkHelpers.getVoxel(
            chunk,
            x,
            y,
            z
          );
          if (voxel && voxel.type !== VoxelType.AIR) {
            // Set bit in all 3 axis representations following TanTanDev's pattern
            // Y-axis column at (x,z) - set bit at position y
            axisCols[0][z][x] |= 1 << y;

            // X-axis column at (y,z) - set bit at position x
            axisCols[1][y][z] |= 1 << x;

            // Z-axis column at (x,y) - set bit at position z
            axisCols[2][y][x] |= 1 << z;
          }
        }
      }
    }
    // Debug: Show sample binary data for verification
    let nonZeroCount = 0;
    let sampleCount = 0;
    for (let axis = 0; axis < 3; axis++) {
      for (let z = 0; z < CHUNK_SIZE_P; z++) {
        for (let x = 0; x < CHUNK_SIZE_P; x++) {
          if (axisCols[axis][z][x] !== 0) {
            nonZeroCount++;
            if (sampleCount < 3) {
              // Only log first 3 for brevity
              sampleCount++;
            }
          }
        }
      }
    }

    return axisCols;
  }

  /**
   * 2. Generate face culling masks for all 6 face directions
   * A face is visible if there's a solid voxel with air on the adjacent side
   *
   * @param axisCols Binary encoded voxel columns
   * @returns Array of 6 face masks: [+Y, -Y, +X, -X, +Z, -Z]
   */
  private static generateFaceCullingMasks(
    axisCols: AxisColumns
  ): AxisColumns[] {
    const CHUNK_SIZE_P = CHUNK_SIZE + 2; // 32

    // Initialize 6 face masks (one for each direction)
    const faceMasks: AxisColumns[] = [];
    for (let i = 0; i < 6; i++) {
      faceMasks.push([
        Array(CHUNK_SIZE_P)
          .fill(null)
          .map(() => new Array(CHUNK_SIZE_P).fill(0)),
        Array(CHUNK_SIZE_P)
          .fill(null)
          .map(() => new Array(CHUNK_SIZE_P).fill(0)),
        Array(CHUNK_SIZE_P)
          .fill(null)
          .map(() => new Array(CHUNK_SIZE_P).fill(0)),
      ]);
    }

    // Process each axis for face culling
    // Y-axis faces (+Y and -Y)
    for (let z = 0; z < CHUNK_SIZE_P; z++) {
      for (let x = 0; x < CHUNK_SIZE_P; x++) {
        const col = axisCols[0][z][x];

        // +Y faces: solid voxel with air above
        // Shift right to check voxel above (Y+1)
        faceMasks[0][0][z][x] = col & ~(col >> 1);

        // -Y faces: solid voxel with air below
        // Shift left to check voxel below (Y-1)
        faceMasks[1][0][z][x] = col & ~(col << 1);
      }
    }

    // X-axis faces (+X and -X)
    for (let y = 0; y < CHUNK_SIZE_P; y++) {
      for (let z = 0; z < CHUNK_SIZE_P; z++) {
        const col = axisCols[1][y][z];

        // +X faces: solid voxel with air to the right
        faceMasks[2][1][y][z] = col & ~(col >> 1);

        // -X faces: solid voxel with air to the left
        faceMasks[3][1][y][z] = col & ~(col << 1);
      }
    }

    // Z-axis faces (+Z and -Z)
    for (let y = 0; y < CHUNK_SIZE_P; y++) {
      for (let x = 0; x < CHUNK_SIZE_P; x++) {
        const col = axisCols[2][y][x];

        // +Z faces: solid voxel with air in front
        faceMasks[4][2][y][x] = col & ~(col >> 1);

        // -Z faces: solid voxel with air behind
        faceMasks[5][2][y][x] = col & ~(col << 1);
      }
    }

    return faceMasks;
  }
}
