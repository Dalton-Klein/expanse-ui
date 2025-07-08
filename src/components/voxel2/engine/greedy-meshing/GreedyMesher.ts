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

    // Debug: Log binary encoding results
    console.log(
      `[GreedyMesher] Binary encoding for chunk at (${chunk.position.x}, ${chunk.position.y}, ${chunk.position.z})`
    );
    console.log(
      `Axis columns dimensions: [${axisCols.length}][${axisCols[0]?.length}][${axisCols[0]?.[0]?.length}]`
    );

    // 2. Face Culling- Cull voxel faces based on adjacency to air, use bitwise operations to find face transitions
    //    - Generate 6 face masks (one for each direction: +X, -X, +Y, -Y, +Z, -Z)
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
   * Convert 3D voxel data into binary columns for efficient face culling
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
          if (ChunkHelpers.getVoxel(chunk, x, y, z)) {
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
              console.log(
                `Axis ${axis}, [${z}][${x}]: 0b${axisCols[
                  axis
                ][z][x]
                  .toString(2)
                  .padStart(32, "0")}`
              );
              sampleCount++;
            }
          }
        }
      }
    }
    console.log(
      `Total non-zero binary columns: ${nonZeroCount}`
    );

    return axisCols;
  }
}
