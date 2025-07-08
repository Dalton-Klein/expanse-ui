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

  /**
   * Test binary encoding using the existing generateTinyChunk function
   * Creates a 2x2x2 cube and verifies the binary representation
   */
  public static testBinaryEncodingWithTinyChunk(): boolean {
    console.log("[GreedyMesher] Testing binary encoding with generateTinyChunk...");
    
    // Generate a tiny chunk with 2x2x2 cube pattern
    const tinyChunk = ChunkGenerator.generateTinyChunk({ x: 0, y: 0, z: 0 });
    
    // Log the actual voxel data for reference
    console.log("Generated chunk voxel data:");
    let solidCount = 0;
    for (let x = 0; x < CHUNK_SIZE + 2; x++) {
      for (let y = 0; y < CHUNK_SIZE + 2; y++) {
        for (let z = 0; z < CHUNK_SIZE + 2; z++) {
          if (ChunkHelpers.getVoxel(tinyChunk, x, y, z)) {
            console.log(`Solid voxel at (${x}, ${y}, ${z})`);
            solidCount++;
          }
        }
      }
    }
    console.log(`Total solid voxels: ${solidCount}`);

    // Encode to binary
    const axisCols = this.encodeToBinary(tinyChunk);
    
    // Verify the encoding
    let success = true;
    let errorCount = 0;
    
    // Based on generateTinyChunk logic: it creates blocks at (1,1,1), (1,2,1), (2,1,1), (2,2,1), 
    // (1,1,2), (1,2,2), (2,1,2), (2,2,2) - a 2x2x2 cube starting at position 1
    // So we expect bits set at positions 1 and 2 in all axes
    const expectedMask = (1 << 1) | (1 << 2);  // Binary: 110 (bits 1 and 2 set)
    
    // Check Y-axis columns - should have bits set at positions 1 and 2 for solid blocks
    for (let x = 1; x <= 2; x++) {
      for (let z = 1; z <= 2; z++) {
        if (axisCols[0][z][x] !== expectedMask) {
          console.error(`Y-axis column [${z}][${x}] expected 0b${expectedMask.toString(2).padStart(32, '0')}, got 0b${axisCols[0][z][x].toString(2).padStart(32, '0')}`);
          success = false;
          errorCount++;
        } else {
          console.log(`✓ Y-axis column [${z}][${x}] correct: 0b${axisCols[0][z][x].toString(2).padStart(32, '0')}`);
        }
      }
    }

    // Check X-axis columns - should have bits set at positions 1 and 2 for solid blocks
    for (let y = 1; y <= 2; y++) {
      for (let z = 1; z <= 2; z++) {
        if (axisCols[1][y][z] !== expectedMask) {
          console.error(`X-axis column [${y}][${z}] expected 0b${expectedMask.toString(2).padStart(32, '0')}, got 0b${axisCols[1][y][z].toString(2).padStart(32, '0')}`);
          success = false;
          errorCount++;
        } else {
          console.log(`✓ X-axis column [${y}][${z}] correct: 0b${axisCols[1][y][z].toString(2).padStart(32, '0')}`);
        }
      }
    }

    // Check Z-axis columns - should have bits set at positions 1 and 2 for solid blocks
    for (let x = 1; x <= 2; x++) {
      for (let y = 1; y <= 2; y++) {
        if (axisCols[2][y][x] !== expectedMask) {
          console.error(`Z-axis column [${y}][${x}] expected 0b${expectedMask.toString(2).padStart(32, '0')}, got 0b${axisCols[2][y][x].toString(2).padStart(32, '0')}`);
          success = false;
          errorCount++;
        } else {
          console.log(`✓ Z-axis column [${y}][${x}] correct: 0b${axisCols[2][y][x].toString(2).padStart(32, '0')}`);
        }
      }
    }

    console.log(`[GreedyMesher] TinyChunk binary encoding test ${success ? 'PASSED' : 'FAILED'}`);
    if (success) {
      console.log(`✅ All 2x2x2 cube positions correctly encoded in all 3 axes`);
      console.log(`Expected pattern: 0b${expectedMask.toString(2).padStart(32, '0')} (bits 1 and 2 set)`);
    } else {
      console.log(`❌ ${errorCount} encoding errors found`);
    }
    
    return success;
  }
}
