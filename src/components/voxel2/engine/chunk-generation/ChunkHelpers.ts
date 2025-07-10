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

  /**
   * Validate that all padding areas contain only air voxels
   * Padding areas are coordinates 0 and 31 on all axes
   */
  static validatePadding(
    chunk: ChunkData,
    label?: string
  ): boolean {
    const CHUNK_SIZE_P = CHUNK_SIZE + 2; // 32
    const violations: string[] = [];
    let isValid = true;

    console.log(
      `\n=== PADDING VALIDATION: ${label || "Unknown"} ===`
    );

    // Check X-axis edges (X=0 and X=31)
    let xViolations = 0;
    for (let y = 0; y < CHUNK_SIZE_P; y++) {
      for (let z = 0; z < CHUNK_SIZE_P; z++) {
        const voxel0: any = this.getVoxel(chunk, 0, y, z);
        const voxel31: any = this.getVoxel(
          chunk,
          CHUNK_SIZE_P - 1,
          y,
          z
        );

        if (voxel0?.type !== VoxelType.AIR) {
          violations.push(
            `X=0 has ${
              VoxelType[voxel0.type]
            } at (0,${y},${z})`
          );
          xViolations++;
          isValid = false;
        }
        if (voxel31?.type !== VoxelType.AIR) {
          violations.push(
            `X=31 has ${
              VoxelType[voxel31.type]
            } at (31,${y},${z})`
          );
          xViolations++;
          isValid = false;
        }
      }
    }

    // Check Y-axis edges (Y=0 and Y=31)
    let yViolations = 0;
    for (let x = 0; x < CHUNK_SIZE_P; x++) {
      for (let z = 0; z < CHUNK_SIZE_P; z++) {
        const voxel0: any = this.getVoxel(chunk, x, 0, z);
        const voxel31: any = this.getVoxel(
          chunk,
          x,
          CHUNK_SIZE_P - 1,
          z
        );

        if (voxel0?.type !== VoxelType.AIR) {
          violations.push(
            `Y=0 has ${
              VoxelType[voxel0.type]
            } at (${x},0,${z})`
          );
          yViolations++;
          isValid = false;
        }
        if (voxel31?.type !== VoxelType.AIR) {
          violations.push(
            `Y=31 has ${
              VoxelType[voxel31.type]
            } at (${x},31,${z})`
          );
          yViolations++;
          isValid = false;
        }
      }
    }

    // Check Z-axis edges (Z=0 and Z=31)
    let zViolations = 0;
    for (let x = 0; x < CHUNK_SIZE_P; x++) {
      for (let y = 0; y < CHUNK_SIZE_P; y++) {
        const voxel0: any = this.getVoxel(chunk, x, y, 0);
        const voxel31: any = this.getVoxel(
          chunk,
          x,
          y,
          CHUNK_SIZE_P - 1
        );

        if (voxel0?.type !== VoxelType.AIR) {
          violations.push(
            `Z=0 has ${
              VoxelType[voxel0.type]
            } at (${x},${y},0)`
          );
          zViolations++;
          isValid = false;
        }
        if (voxel31?.type !== VoxelType.AIR) {
          violations.push(
            `Z=31 has ${
              VoxelType[voxel31.type]
            } at (${x},${y},31)`
          );
          zViolations++;
          isValid = false;
        }
      }
    }

    // Print results
    console.log(
      `${xViolations === 0 ? "✓" : "✗"} X-edges: ${
        xViolations === 0
          ? "OK (all air)"
          : `${xViolations} violations found`
      }`
    );
    console.log(
      `${yViolations === 0 ? "✓" : "✗"} Y-edges: ${
        yViolations === 0
          ? "OK (all air)"
          : `${yViolations} violations found`
      }`
    );
    console.log(
      `${zViolations === 0 ? "✓" : "✗"} Z-edges: ${
        zViolations === 0
          ? "OK (all air)"
          : `${zViolations} violations found`
      }`
    );

    if (violations.length > 0) {
      console.log("Violations:");
      violations
        .slice(0, 10)
        .forEach((violation) =>
          console.log(`  ${violation}`)
        );
      if (violations.length > 10) {
        console.log(
          `  ... and ${
            violations.length - 10
          } more violations`
        );
      }
      console.log(
        `RESULT: FAILED (${violations.length} total violations)`
      );
    } else {
      console.log(
        "RESULT: PASSED (all padding areas are air)"
      );
    }

    console.log("=== END PADDING VALIDATION ===\n");
    return isValid;
  }
}

// TODO: Add chunk management system
// TODO: Add chunk caching
// TODO: Add chunk loading/unloading
