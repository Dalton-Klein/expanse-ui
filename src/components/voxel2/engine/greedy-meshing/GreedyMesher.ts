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

// Type for block-type-separated columns for efficient processing
// blockTypeCols[blockType][axis][z][x] - binary columns for each block type
type BlockTypeColumns = Map<VoxelType, AxisColumns>;

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

    // 1. Binary Encoding- Convert 3d array chunk data into binary columns separated by block type
    const blockTypeCols =
      this.encodeToBinaryByBlockType(chunk);

    // 2. Face Culling- Cull voxel faces based on adjacency to air, use bitwise operations to find face transitions
    const faceMasksByBlockType =
      this.generateFaceCullingMasksByBlockType(
        blockTypeCols
      );

    // 3. Greedy algorithm- For each 2D binary plane, apply the greedy algorithm
    //    - Expand rectangles first vertically (height), then horizontally (width)
    //    - Clear bits as they're merged to avoid duplicate processing
    // 4. Generate Geometry (And Later Ambient Occlusion)- Convert greedy quads to vertices with proper winding order

    const endTime = performance.now();
    result.generationTime = endTime - startTime;

    return result;
  }

  /**
   * 1. Convert 3D voxel data into binary columns separated by block type
   * This eliminates the need for expensive grouping later
   * Based on TanTanDev's binary greedy meshing algorithm
   */
  private static encodeToBinaryByBlockType(
    chunk: ChunkData
  ): BlockTypeColumns {
    // With padding for neighbors: 30 + 2 = 32 (perfect for 32-bit integer operations native to JS)
    const CHUNK_SIZE_P = CHUNK_SIZE + 2; // 32

    const blockTypeCols = new Map<VoxelType, AxisColumns>();

    // Helper function to create empty axis columns
    const createEmptyAxisColumns = (): AxisColumns => [
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
            // Ensure we have columns for this block type
            if (!blockTypeCols.has(voxel.type)) {
              blockTypeCols.set(
                voxel.type,
                createEmptyAxisColumns()
              );
            }

            const axisCols = blockTypeCols.get(voxel.type)!;

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

    return blockTypeCols;
  }

  /**
   * 2. Generate face culling masks for all 6 face directions for each block type
   * A face is visible if there's a solid voxel with air on the adjacent side
   *
   * @param blockTypeCols Binary encoded voxel columns separated by block type
   * @returns Map of block types to their face masks: [+Y, -Y, +X, -X, +Z, -Z]
   */
  private static generateFaceCullingMasksByBlockType(
    blockTypeCols: BlockTypeColumns
  ): Map<VoxelType, AxisColumns[]> {
    const CHUNK_SIZE_P = CHUNK_SIZE + 2; // 32
    const faceMasksByBlockType = new Map<
      VoxelType,
      AxisColumns[]
    >();

    // Helper function to create empty face masks
    const createEmptyFaceMasks = (): AxisColumns[] => {
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
      return faceMasks;
    };

    // Process each block type
    for (const [blockType, axisCols] of blockTypeCols) {
      const faceMasks = createEmptyFaceMasks();

      // Y-axis faces (+Y and -Y)
      for (let z = 0; z < CHUNK_SIZE_P; z++) {
        for (let x = 0; x < CHUNK_SIZE_P; x++) {
          const col = axisCols[0][z][x];

          // +Y faces: solid voxel with air above
          faceMasks[0][0][z][x] = col & ~(col >> 1);

          // -Y faces: solid voxel with air below
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

      faceMasksByBlockType.set(blockType, faceMasks);
    }

    return faceMasksByBlockType;
  }
}
