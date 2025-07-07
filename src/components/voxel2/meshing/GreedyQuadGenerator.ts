import * as THREE from "three";
import { ChunkData, VoxelType } from "../types";
import {
  CHUNK_SIZE,
  CHUNK_HEIGHT,
} from "../terrain/TerrainConfig";
import {
  FaceMask,
  BinaryGreedyMesher,
} from "./BinaryGreedyMesher";
import { BitMaskUtils } from "./BitMaskUtils";
import { ChunkDataUtils } from "../chunks/ChunkData";

// Generates optimized quads from binary face masks using greedy algorithm

export interface QuadData {
  vertices: THREE.Vector3[]; // 4 vertices defining the quad
  normal: THREE.Vector3; // Face normal
  color: THREE.Color; // Material color
  voxelType: VoxelType; // Type of voxel this quad represents
}

// Voxel colors for visualization
const VOXEL_COLORS: Record<VoxelType, THREE.Color> = {
  [VoxelType.AIR]: new THREE.Color(0x000000),
  [VoxelType.STONE]: new THREE.Color(0x808080),
  [VoxelType.GRASS]: new THREE.Color(0x4caf50),
  [VoxelType.DIRT]: new THREE.Color(0x8d6e63),
  [VoxelType.SAND]: new THREE.Color(0xfdd835),
  [VoxelType.WATER]: new THREE.Color(0x2196f3),
};

export class GreedyQuadGenerator {
  private static readonly FACE_NORMALS = [
    new THREE.Vector3(1, 0, 0), // +X
    new THREE.Vector3(-1, 0, 0), // -X
    new THREE.Vector3(0, 1, 0), // +Y
    new THREE.Vector3(0, -1, 0), // -Y
    new THREE.Vector3(0, 0, 1), // +Z
    new THREE.Vector3(0, 0, -1), // -Z
  ];

  // Debug logging control - sync with BinaryGreedyMesher
  private static get DEBUG_ENABLED() {
    return (BinaryGreedyMesher as any).DEBUG_ENABLED;
  }

  private static get Y_FACE_DEBUG() {
    return (BinaryGreedyMesher as any).Y_FACE_DEBUG;
  }

  // Generate quads for a single face direction
  static generateQuadsForFace(
    faceMask: FaceMask,
    chunk: ChunkData,
    direction: number
  ): QuadData[] {
    const isYFace = direction === 2 || direction === 3;

    const quads: QuadData[] = [];
    const processedMask =
      this.createProcessedMaskCopy(faceMask);

    // Get face configuration
    const faceAxis = Math.floor(direction / 2);
    const facePositive = direction % 2 === 0;
    const normal = this.FACE_NORMALS[direction];

    // Determine iteration order based on face axis
    const [uSize, vSize] = this.getFaceDimensions(faceAxis);

    // Process the face mask to find and merge quads
    if (isYFace) {
      // Y-faces: iterate through both Z and X dimensions of faceMask[z][x]
      for (let z = 0; z < uSize; z++) {
        for (let x = 0; x < vSize; x++) {
          let currentMask = processedMask[z][x];
          if (currentMask === 0n) continue;

          // Find runs of set bits (Y positions)
          while (currentMask !== 0n) {
            const firstBit =
              BitMaskUtils.firstSetBit(currentMask);
            if (firstBit === -1) break;

            const y = firstBit;

            // Create quad using Z,X,Y coordinates
            const quad = this.createGreedyQuadYFace(
              processedMask,
              chunk,
              z,
              x,
              y,
              faceAxis,
              facePositive,
              normal
            );

            if (quad) {
              quads.push(quad);

              // Clear the processed area from the mask
              this.clearProcessedAreaYFace(
                processedMask,
                z,
                x,
                y,
                quad.width,
                quad.height
              );

              // Update current mask
              currentMask = processedMask[z][x];
            } else {
              // Clear this bit if we couldn't create a quad
              currentMask &= ~(1n << BigInt(firstBit));
              processedMask[z][x] = currentMask;
            }
          }
        }
      }
    } else {
      // X and Z faces: use original logic
      for (let u = 0; u < uSize; u++) {
        for (let vBase = 0; vBase < vSize; vBase += 64) {
          const maskIndex = Math.floor(vBase / 64);
          let currentMask = processedMask[u][maskIndex];

          if (currentMask === 0n) continue;

          // Find runs of set bits
          while (currentMask !== 0n) {
            const firstBit =
              BitMaskUtils.firstSetBit(currentMask);
            if (firstBit === -1) break;

            const v = vBase + firstBit;

            // Try to create the largest possible quad starting from this position
            const quad = this.createGreedyQuad(
              processedMask,
              chunk,
              u,
              v,
              uSize,
              vSize,
              faceAxis,
              facePositive,
              normal
            );

            if (quad) {
              quads.push(quad);
              // Clear the processed area from the mask
              this.clearProcessedArea(
                processedMask,
                u,
                v,
                quad.width,
                quad.height
              );

              // Update current mask
              currentMask = processedMask[u][maskIndex];
            } else {
              // Clear this bit if we couldn't create a quad
              currentMask &= ~(1n << BigInt(firstBit));
              processedMask[u][maskIndex] = currentMask;
            }
          }
        }
      }
    }
    return quads;
  }

  // Create a deep copy of the face mask for processing
  private static createProcessedMaskCopy(
    faceMask: FaceMask
  ): bigint[][] {
    const copy: bigint[][] = [];
    for (let i = 0; i < faceMask.mask.length; i++) {
      const row = faceMask.mask[i];
      copy[i] = row.map((cell) => BigInt(cell));
    }
    return copy;
  }

  // Get face dimensions based on axis (following TanTanDev's approach)
  private static getFaceDimensions(
    faceAxis: number
  ): [number, number] {
    switch (faceAxis) {
      case 0:
        return [CHUNK_SIZE, CHUNK_HEIGHT]; // X face: Z x Y
      case 1:
        return [CHUNK_SIZE, CHUNK_SIZE]; // Y face: Z x X (both horizontal dimensions)
      case 2:
        return [CHUNK_SIZE, CHUNK_HEIGHT]; // Z face: X x Y
      default:
        return [CHUNK_SIZE, CHUNK_HEIGHT];
    }
  }

  // Create a greedy quad starting from position (u,v)
  private static createGreedyQuad(
    mask: bigint[][],
    chunk: ChunkData,
    startU: number,
    startV: number,
    maxU: number,
    maxV: number,
    faceAxis: number,
    facePositive: boolean,
    normal: THREE.Vector3
  ): (QuadData & { width: number; height: number }) | null {
    // Get the voxel type at this position
    const [x, y, z] = this.getFacePosition(
      startU,
      startV,
      faceAxis,
      facePositive
    );
    const voxel = ChunkDataUtils.getVoxel(chunk, x, y, z);
    if (!voxel || voxel.type === VoxelType.AIR) return null;

    const voxelType = voxel.type;

    // Find the maximum width and height for this quad
    let width = 1;
    let height = 1;

    // First, expand horizontally as far as possible
    const startMaskIndex = Math.floor(startV / 64);
    const startBitIndex = startV % 64;

    // Debug for Y-faces only
    const isYFace = faceAxis === 1;

    // Check how far we can extend horizontally with same voxel type
    for (let u = startU + 1; u < maxU; u++) {
      // Check if this position has the same voxel type
      const [checkX, checkY, checkZ] = this.getFacePosition(
        u,
        startV,
        faceAxis,
        facePositive
      );
      const checkVoxel = ChunkDataUtils.getVoxel(
        chunk,
        checkX,
        checkY,
        checkZ
      );
      width++;
    }

    // Then, try to expand vertically
    for (let v = startV + 1; v < maxV; v++) {
      const vMaskIndex = Math.floor(v / 64);
      const vBitIndex = v % 64;

      // Check if all positions in this row have the same voxel type and are set in mask
      let canExpand = true;

      for (let u = startU; u < startU + width; u++) {
        const [checkX, checkY, checkZ] =
          this.getFacePosition(
            u,
            v,
            faceAxis,
            facePositive
          );
        const checkVoxel = ChunkDataUtils.getVoxel(
          chunk,
          checkX,
          checkY,
          checkZ
        );

        if (!checkVoxel || checkVoxel.type !== voxelType) {
          canExpand = false;
          break;
        }

        const checkMask = mask[u][vMaskIndex];
        if (
          (checkMask & (1n << BigInt(vBitIndex))) ===
          0n
        ) {
          canExpand = false;
          break;
        }
      }

      if (!canExpand) break;
      height++;
    }

    // Create quad vertices
    const vertices = this.createQuadVertices(
      startU,
      startV,
      width,
      height,
      faceAxis,
      facePositive,
      chunk.position
    );
    return {
      vertices,
      normal: normal.clone(),
      color: VOXEL_COLORS[voxelType].clone(),
      voxelType,
      width,
      height,
    };
  }

  // Create a greedy quad for Y-faces starting from position (z,x,y)
  private static createGreedyQuadYFace(
    mask: bigint[][],
    chunk: ChunkData,
    startZ: number,
    startX: number,
    startY: number,
    faceAxis: number,
    facePositive: boolean,
    normal: THREE.Vector3
  ): (QuadData & { width: number; height: number }) | null {
    // Get the voxel type at this position
    const voxel = ChunkDataUtils.getVoxel(
      chunk,
      startX,
      startY,
      startZ
    );
    if (!voxel || voxel.type === VoxelType.AIR) return null;

    const voxelType = voxel.type;

    // Find the maximum width and height for this quad in X-Z plane
    let widthZ = 1; // expansion in Z direction
    let heightX = 1; // expansion in X direction

    // First, expand in Z direction as far as possible
    for (let z = startZ + 1; z < CHUNK_SIZE; z++) {
      // Check if this position has the same voxel type
      const checkVoxel = ChunkDataUtils.getVoxel(
        chunk,
        startX,
        startY,
        z
      );
      if (!checkVoxel || checkVoxel.type !== voxelType)
        break;

      // Check if the bit is set in the mask
      const checkMask = mask[z][startX];
      if ((checkMask & (1n << BigInt(startY))) === 0n)
        break;

      widthZ++;
    }

    // Then, try to expand in X direction
    for (let x = startX + 1; x < CHUNK_SIZE; x++) {
      // Check if all positions in this row have the same voxel type and are set in mask
      let canExpand = true;

      for (let z = startZ; z < startZ + widthZ; z++) {
        const checkVoxel = ChunkDataUtils.getVoxel(
          chunk,
          x,
          startY,
          z
        );
        if (!checkVoxel || checkVoxel.type !== voxelType) {
          canExpand = false;
          break;
        }

        const checkMask = mask[z][x];
        if ((checkMask & (1n << BigInt(startY))) === 0n) {
          canExpand = false;
          break;
        }
      }

      if (!canExpand) break;
      heightX++;
    }

    // Create quad vertices for Y-face
    const vertices = this.createQuadVerticesYFace(
      startZ,
      startX,
      startY,
      widthZ,
      heightX,
      facePositive,
      chunk.position
    );

    return {
      vertices,
      normal: normal.clone(),
      color: VOXEL_COLORS[voxelType].clone(),
      voxelType,
      width: widthZ,
      height: heightX,
    };
  }

  // Clear processed area from mask
  private static clearProcessedArea(
    mask: bigint[][],
    startU: number,
    startV: number,
    width: number,
    height: number
  ): void {
    for (let u = startU; u < startU + width; u++) {
      for (let v = startV; v < startV + height; v++) {
        const maskIndex = Math.floor(v / 64);
        const bitIndex = v % 64;
        mask[u][maskIndex] &= ~(1n << BigInt(bitIndex));
      }
    }
  }

  // Clear processed area from Y-face mask
  private static clearProcessedAreaYFace(
    mask: bigint[][],
    startZ: number,
    startX: number,
    startY: number,
    widthZ: number,
    heightX: number
  ): void {
    for (let z = startZ; z < startZ + widthZ; z++) {
      for (let x = startX; x < startX + heightX; x++) {
        mask[z][x] &= ~(1n << BigInt(startY));
      }
    }
  }

  // Create quad vertices for Y-faces in world space
  private static createQuadVerticesYFace(
    startZ: number,
    startX: number,
    startY: number,
    widthZ: number,
    heightX: number,
    facePositive: boolean,
    chunkPosition: { x: number; z: number }
  ): THREE.Vector3[] {
    const worldX = chunkPosition.x * CHUNK_SIZE;
    const worldZ = chunkPosition.z * CHUNK_SIZE;

    // Y-face vertices in the X-Z plane
    const y = startY + (facePositive ? 1 : 0);
    const vertices: THREE.Vector3[] = [];

    if (facePositive) {
      // +Y face: vertices should be ordered counter-clockwise when viewed from above
      vertices.push(
        new THREE.Vector3(
          worldX + startX,
          y,
          worldZ + startZ + widthZ
        ),
        new THREE.Vector3(
          worldX + startX + heightX,
          y,
          worldZ + startZ + widthZ
        ),
        new THREE.Vector3(
          worldX + startX + heightX,
          y,
          worldZ + startZ
        ),
        new THREE.Vector3(
          worldX + startX,
          y,
          worldZ + startZ
        )
      );
    } else {
      // -Y face: vertices should be ordered counter-clockwise when viewed from below
      vertices.push(
        new THREE.Vector3(
          worldX + startX,
          y,
          worldZ + startZ
        ),
        new THREE.Vector3(
          worldX + startX + heightX,
          y,
          worldZ + startZ
        ),
        new THREE.Vector3(
          worldX + startX + heightX,
          y,
          worldZ + startZ + widthZ
        ),
        new THREE.Vector3(
          worldX + startX,
          y,
          worldZ + startZ + widthZ
        )
      );
    }

    return vertices;
  }

  // Convert face coordinates to voxel coordinates (following TanTanDev's coordinate mapping)
  private static getFacePosition(
    u: number,
    v: number,
    faceAxis: number,
    facePositive: boolean
  ): [number, number, number] {
    let result: [number, number, number];
    switch (faceAxis) {
      case 0: // X face
        result = [facePositive ? CHUNK_SIZE - 1 : 0, v, u];
        break;
      case 1: // Y face - Face mask stored as faceMask[z][x]
        // For Y-faces, TanTanDev maps: ivec3(x, y, z)
        // But our current iteration uses u=Z, v=Y
        // We need proper X coordinate - temporarily use 0 until we fix iteration
        result = [0, v, u]; // X=0 (temp), v=Y, u=Z
        break;
      case 2: // Z face
        result = [u, v, facePositive ? CHUNK_SIZE - 1 : 0];
        break;
      default:
        result = [0, 0, 0];
    }

    return result;
  }

  // Create quad vertices in world space
  private static createQuadVertices(
    u: number,
    v: number,
    width: number,
    height: number,
    faceAxis: number,
    facePositive: boolean,
    chunkPosition: { x: number; z: number }
  ): THREE.Vector3[] {
    const worldX = chunkPosition.x * CHUNK_SIZE;
    const worldZ = chunkPosition.z * CHUNK_SIZE;

    // Create vertices based on face axis and direction
    const vertices: THREE.Vector3[] = [];
    const offset = facePositive ? 1 : 0;

    switch (faceAxis) {
      case 0: // X face
        {
          const x = facePositive ? CHUNK_SIZE : 0;
          if (facePositive) {
            // +X face: vertices should be ordered counter-clockwise when viewed from outside
            vertices.push(
              new THREE.Vector3(worldX + x, v, worldZ + u),
              new THREE.Vector3(
                worldX + x,
                v + height,
                worldZ + u
              ),
              new THREE.Vector3(
                worldX + x,
                v + height,
                worldZ + u + width
              ),
              new THREE.Vector3(
                worldX + x,
                v,
                worldZ + u + width
              )
            );
          } else {
            // -X face: vertices should be ordered counter-clockwise when viewed from outside
            vertices.push(
              new THREE.Vector3(
                worldX + x,
                v,
                worldZ + u + width
              ),
              new THREE.Vector3(
                worldX + x,
                v + height,
                worldZ + u + width
              ),
              new THREE.Vector3(
                worldX + x,
                v + height,
                worldZ + u
              ),
              new THREE.Vector3(worldX + x, v, worldZ + u)
            );
          }
        }
        break;

      case 1: // Y face
        {
          // For Y-faces, v represents the Y coordinate (from bit position)
          // Add offset for face positioning: +Y faces are on top of voxel, -Y faces on bottom
          const y = v + (facePositive ? 1 : 0);
          if (facePositive) {
            // +Y face: vertices should be ordered counter-clockwise when viewed from above
            vertices.push(
              new THREE.Vector3(
                worldX + u,
                y,
                worldZ + height
              ),
              new THREE.Vector3(
                worldX + u + width,
                y,
                worldZ + height
              ),
              new THREE.Vector3(
                worldX + u + width,
                y,
                worldZ + 0
              ),
              new THREE.Vector3(worldX + u, y, worldZ + 0)
            );
          } else {
            // -Y face: vertices should be ordered counter-clockwise when viewed from below
            vertices.push(
              new THREE.Vector3(worldX + u, y, worldZ + 0),
              new THREE.Vector3(
                worldX + u + width,
                y,
                worldZ + 0
              ),
              new THREE.Vector3(
                worldX + u + width,
                y,
                worldZ + height
              ),
              new THREE.Vector3(
                worldX + u,
                y,
                worldZ + height
              )
            );
          }
        }
        break;

      case 2: // Z face
        {
          const z = facePositive ? CHUNK_SIZE : 0;
          if (facePositive) {
            // +Z face: vertices should be ordered counter-clockwise when viewed from outside
            vertices.push(
              new THREE.Vector3(
                worldX + u + width,
                v,
                worldZ + z
              ),
              new THREE.Vector3(
                worldX + u + width,
                v + height,
                worldZ + z
              ),
              new THREE.Vector3(
                worldX + u,
                v + height,
                worldZ + z
              ),
              new THREE.Vector3(worldX + u, v, worldZ + z)
            );
          } else {
            // -Z face: vertices should be ordered counter-clockwise when viewed from outside
            vertices.push(
              new THREE.Vector3(worldX + u, v, worldZ + z),
              new THREE.Vector3(
                worldX + u,
                v + height,
                worldZ + z
              ),
              new THREE.Vector3(
                worldX + u + width,
                v + height,
                worldZ + z
              ),
              new THREE.Vector3(
                worldX + u + width,
                v,
                worldZ + z
              )
            );
          }
        }
        break;
    }

    // Winding order is now handled individually for each face type above

    return vertices;
  }
}

// TODO: Future optimizations:
// 1. Implement texture atlas support with UV coordinate generation
// 2. Add ambient occlusion calculation for vertices
// 3. Support for transparent voxel types with separate render pass
// 4. LOD-aware quad generation with configurable detail levels
// 5. Vertex deduplication and index buffer optimization
