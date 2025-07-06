import * as THREE from "three";
import { ChunkData, VoxelType } from "../types";
import {
  CHUNK_SIZE,
  CHUNK_HEIGHT,
} from "../terrain/TerrainConfig";
import { BitMaskUtils } from "./BitMaskUtils";
import {
  GreedyQuadGenerator,
  QuadData,
} from "./GreedyQuadGenerator";

// Binary greedy meshing implementation based on TanTanDev's algorithm
// Uses bitwise operations for ultra-fast mesh generation (target: 100-500μs per chunk)

export interface BinaryMeshResult {
  geometry: THREE.BufferGeometry;
  triangleCount: number;
  generationTimeMs: number;
}

export interface FaceMask {
  direction: number; // 0-5 for the 6 cube faces
  mask: bigint[][]; // 2D array of bigint for face visibility
  width: number;
  height: number;
}

export class BinaryGreedyMesher {
  private static readonly FACE_DIRECTIONS = [
    { axis: 0, positive: true }, // +X (Right)
    { axis: 0, positive: false }, // -X (Left)
    { axis: 1, positive: true }, // +Y (Top)
    { axis: 1, positive: false }, // -Y (Bottom)
    { axis: 2, positive: true }, // +Z (Front)
    { axis: 2, positive: false }, // -Z (Back)
  ];

  // Debug logging control
  private static DEBUG_ENABLED = false;
  private static Y_FACE_DEBUG = true;

  static enableDebug(enabled: boolean = true) {
    this.DEBUG_ENABLED = enabled;
  }

  static enableYFaceDebug(enabled: boolean = true) {
    this.Y_FACE_DEBUG = enabled;
    this.DEBUG_ENABLED = false; // Disable general debug when Y-face debug is on
  }

  // Main entry point for mesh generation
  static generateMesh(chunk: ChunkData): BinaryMeshResult {
    const startTime = performance.now();

    if (this.Y_FACE_DEBUG) {
      console.log("=== Y-FACE DEBUG SUMMARY ===");
    } else if (this.DEBUG_ENABLED) {
      console.log(
        `[BinaryGreedyMesher] Starting mesh generation for chunk (${chunk.position.x}, ${chunk.position.z})`
      );
    }

    // Step 1: Create binary occupancy mask
    const occupancyMask = this.createOccupancyMask(chunk);
    if (this.Y_FACE_DEBUG) {
      this.debugYFaceOccupancy(occupancyMask, chunk);
    } else if (this.DEBUG_ENABLED) {
      this.debugOccupancyMask(occupancyMask, chunk);
    }

    // Step 2: Cull faces using bitwise operations
    const faceMasks = this.cullFaces(occupancyMask, chunk);
    if (this.DEBUG_ENABLED && !this.Y_FACE_DEBUG) {
      this.debugFaceMasks(faceMasks, chunk);
    }

    // Step 3: Generate greedy quads from face masks
    const quads = this.generateQuads(faceMasks, chunk);
    if (this.Y_FACE_DEBUG) {
      this.debugYFaceQuads(quads, faceMasks);
      console.log("=== END Y-FACE DEBUG ===");
    } else if (this.DEBUG_ENABLED) {
      this.debugQuads(quads, chunk);
    }

    // Step 4: Build Three.js geometry from quads
    const geometry = this.buildGeometry(quads);

    const endTime = performance.now();

    if (this.DEBUG_ENABLED) {
      console.log(
        `[BinaryGreedyMesher] Completed mesh generation in ${
          endTime - startTime
        }ms - ${quads.length} quads`
      );
    }

    return {
      geometry,
      triangleCount: quads.length * 2, // Each quad = 2 triangles
      generationTimeMs: endTime - startTime,
    };
  }

  // Step 1: Create binary occupancy mask
  // Each bit represents whether a voxel is solid (1) or air (0)
  private static createOccupancyMask(
    chunk: ChunkData
  ): bigint[][] {
    const mask: bigint[][] = [];

    // Initialize 2D array of bigint masks
    // Each bigint represents a column of 64 voxels in the Y direction
    for (let x = 0; x < CHUNK_SIZE; x++) {
      mask[x] = [];
      for (let z = 0; z < CHUNK_SIZE; z++) {
        // Pack Y values into bigint (64 voxels in Y)
        let columnMask = 0n;

        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          const voxel = chunk.voxels[x][y][z];
          if (voxel && voxel.type !== VoxelType.AIR) {
            // Set bit at position y to 1 if voxel is solid
            columnMask |= 1n << BigInt(y);
          }
        }

        mask[x][z] = columnMask;
      }
    }

    return mask;
  }

  // Step 2: Cull faces using bitwise operations
  // Generates visibility masks for each face direction
  private static cullFaces(
    occupancyMask: bigint[][],
    chunk: ChunkData
  ): FaceMask[] {
    const faceMasks: FaceMask[] = [];

    // Process each face direction
    for (let direction = 0; direction < 6; direction++) {
      const faceConfig = this.FACE_DIRECTIONS[direction];
      const faceMask = this.cullFacesForDirection(
        occupancyMask,
        chunk,
        faceConfig.axis,
        faceConfig.positive
      );

      faceMasks.push({
        direction,
        mask: faceMask.mask,
        width: faceMask.width,
        height: faceMask.height,
      });
    }

    return faceMasks;
  }

  // Cull faces for a specific direction using bitwise operations
  private static cullFacesForDirection(
    occupancyMask: bigint[][],
    chunk: ChunkData,
    axis: number,
    positive: boolean
  ): { mask: bigint[][]; width: number; height: number } {
    // Determine dimensions based on axis
    const [width, height] =
      axis === 0
        ? [CHUNK_SIZE, CHUNK_HEIGHT]
        : axis === 1
        ? [CHUNK_SIZE, CHUNK_SIZE]
        : [CHUNK_SIZE, CHUNK_HEIGHT];

    // Initialize 2D mask for this face
    const faceMask: bigint[][] = [];

    // Implement bitwise face culling based on axis and direction
    switch (axis) {
      case 0: // X-axis faces
        this.cullXFaces(occupancyMask, faceMask, positive);
        break;
      case 1: // Y-axis faces
        this.cullYFaces(occupancyMask, faceMask, positive);
        break;
      case 2: // Z-axis faces
        this.cullZFaces(occupancyMask, faceMask, positive);
        break;
    }

    return { mask: faceMask, width, height };
  }

  // Cull X-axis faces using bitwise operations
  private static cullXFaces(
    occupancyMask: bigint[][],
    faceMask: bigint[][],
    positive: boolean
  ): void {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      faceMask[z] = [];
      faceMask[z][0] = 0n;

      for (let x = 0; x < CHUNK_SIZE; x++) {
        const currentSlice = occupancyMask[x][z];

        // Get neighbor slice (adjacent voxel in X direction)
        let neighborSlice = 0n;
        if (positive) {
          // +X face: check x+1 neighbor
          if (x + 1 < CHUNK_SIZE) {
            neighborSlice = occupancyMask[x + 1][z];
          }
          // If we're at the edge, neighbor is air (0n)
        } else {
          // -X face: check x-1 neighbor
          if (x - 1 >= 0) {
            neighborSlice = occupancyMask[x - 1][z];
          }
          // If we're at the edge, neighbor is air (0n)
        }

        // Faces are exposed where current slice has voxels but neighbor doesn't
        const exposedFaces = currentSlice & ~neighborSlice;
        faceMask[z][0] |= exposedFaces;
      }
    }
  }

  // Cull Y-axis faces using bitwise operations (based on TanTanDev's optimized approach)
  private static cullYFaces(
    occupancyMask: bigint[][],
    faceMask: bigint[][],
    positive: boolean
  ): void {
    const faceType = positive ? "+Y (top)" : "-Y (bottom)";

    if (this.Y_FACE_DEBUG) {
      console.log(`${faceType} Face Culling:`);
    } else if (this.DEBUG_ENABLED) {
      console.log(
        `[cullYFaces] Processing ${faceType} faces`
      );
    }

    // Y-axis faces iterate over Z,X coordinates (matching reference implementation)
    for (let z = 0; z < CHUNK_SIZE; z++) {
      faceMask[z] = [];
      faceMask[z][0] = 0n;

      for (let x = 0; x < CHUNK_SIZE; x++) {
        const currentColumn = occupancyMask[x][z];

        if (currentColumn === 0n) continue; // Skip empty columns

        let faces = 0n;
        if (positive) {
          // +Y faces (top): col & !(col << 1) - find where solid has air above
          // This matches: col_face_masks[2 * axis + 1][z][x] = col & !(col >> 1);
          faces = currentColumn & ~(currentColumn << 1n);
          if (this.Y_FACE_DEBUG && currentColumn !== 0n) {
            console.log(
              `  (${x},${z}): col=${currentColumn
                .toString(2)
                .padStart(8, "0")} -> top=${faces
                .toString(2)
                .padStart(8, "0")} [${this.countSetBits(
                faces
              )} faces]`
            );
          } else if (this.DEBUG_ENABLED && faces !== 0n) {
            console.log(
              `[cullYFaces] +Y face at x=${x}, z=${z}: column=${currentColumn.toString(
                2
              )}, faces=${faces.toString(2)}`
            );
          }
        } else {
          // -Y faces (bottom): col & !(col >> 1) - find where solid has air below
          // This matches: col_face_masks[2 * axis + 0][z][x] = col & !(col << 1);
          faces = currentColumn & ~(currentColumn >> 1n);
          if (this.Y_FACE_DEBUG && currentColumn !== 0n) {
            console.log(
              `  (${x},${z}): col=${currentColumn
                .toString(2)
                .padStart(8, "0")} -> bot=${faces
                .toString(2)
                .padStart(8, "0")} [${this.countSetBits(
                faces
              )} faces]`
            );
          } else if (this.DEBUG_ENABLED && faces !== 0n) {
            console.log(
              `[cullYFaces] -Y face at x=${x}, z=${z}: column=${currentColumn.toString(
                2
              )}, faces=${faces.toString(2)}`
            );
          }
        }

        faceMask[z][0] |= faces;
      }
    }

    // Count total faces found
    let totalFaces = 0;
    for (let z = 0; z < CHUNK_SIZE; z++) {
      const mask = faceMask[z][0];
      totalFaces += this.countSetBits(mask);
    }
    if (this.Y_FACE_DEBUG) {
      console.log(
        `  Total ${faceType} faces: ${totalFaces}`
      );
    } else if (this.DEBUG_ENABLED) {
      console.log(
        `[cullYFaces] Found ${totalFaces} ${
          positive ? "top" : "bottom"
        } faces`
      );
    }
  }

  // Cull Z-axis faces using bitwise operations
  private static cullZFaces(
    occupancyMask: bigint[][],
    faceMask: bigint[][],
    positive: boolean
  ): void {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      faceMask[x] = [];
      faceMask[x][0] = 0n;

      for (let z = 0; z < CHUNK_SIZE; z++) {
        const currentSlice = occupancyMask[x][z];

        // Get neighbor slice (adjacent voxel in Z direction)
        let neighborSlice = 0n;
        if (positive) {
          // +Z face: check z+1 neighbor
          if (z + 1 < CHUNK_SIZE) {
            neighborSlice = occupancyMask[x][z + 1];
          }
          // If we're at the edge, neighbor is air (0n)
        } else {
          // -Z face: check z-1 neighbor
          if (z - 1 >= 0) {
            neighborSlice = occupancyMask[x][z - 1];
          }
          // If we're at the edge, neighbor is air (0n)
        }

        // Faces are exposed where current slice has voxels but neighbor doesn't
        const exposedFaces = currentSlice & ~neighborSlice;
        faceMask[x][0] |= exposedFaces;
      }
    }
  }

  // Step 3: Generate greedy quads from face masks
  private static generateQuads(
    faceMasks: FaceMask[],
    chunk: ChunkData
  ): QuadData[] {
    const allQuads: QuadData[] = [];

    for (const faceMask of faceMasks) {
      const quads =
        GreedyQuadGenerator.generateQuadsForFace(
          faceMask,
          chunk,
          faceMask.direction
        );
      allQuads.push(...quads);
    }

    return allQuads;
  }

  // Step 4: Build Three.js geometry from quads
  private static buildGeometry(
    quads: QuadData[]
  ): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();

    // Calculate total vertices needed (4 per quad, but using indices)
    const vertexCount = quads.length * 4;
    const indexCount = quads.length * 6; // 2 triangles per quad

    // Allocate arrays
    const positions = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 3);
    const indices = new Uint32Array(indexCount);

    // Fill arrays with quad data
    let vertexIndex = 0;
    let indexIndex = 0;

    for (const quad of quads) {
      // Add vertices
      for (let i = 0; i < 4; i++) {
        const vertex = quad.vertices[i];
        positions[vertexIndex * 3] = vertex.x;
        positions[vertexIndex * 3 + 1] = vertex.y;
        positions[vertexIndex * 3 + 2] = vertex.z;

        normals[vertexIndex * 3] = quad.normal.x;
        normals[vertexIndex * 3 + 1] = quad.normal.y;
        normals[vertexIndex * 3 + 2] = quad.normal.z;

        colors[vertexIndex * 3] = quad.color.r;
        colors[vertexIndex * 3 + 1] = quad.color.g;
        colors[vertexIndex * 3 + 2] = quad.color.b;

        vertexIndex++;
      }

      // Add indices for two triangles
      const baseIndex = vertexIndex - 4;
      indices[indexIndex++] = baseIndex;
      indices[indexIndex++] = baseIndex + 1;
      indices[indexIndex++] = baseIndex + 2;
      indices[indexIndex++] = baseIndex;
      indices[indexIndex++] = baseIndex + 2;
      indices[indexIndex++] = baseIndex + 3;
    }

    // Set attributes
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );
    geometry.setAttribute(
      "normal",
      new THREE.BufferAttribute(normals, 3)
    );
    geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(colors, 3)
    );
    geometry.setIndex(
      new THREE.BufferAttribute(indices, 1)
    );

    return geometry;
  }
  // Y-Face specific debug methods
  private static debugYFaceOccupancy(
    occupancyMask: bigint[][],
    chunk: ChunkData
  ): void {
    console.log("Occupancy (columns with voxels):");

    let totalVoxels = 0;
    let columnsWithVoxels = 0;

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const columnMask = occupancyMask[x][z];
        if (columnMask !== 0n) {
          columnsWithVoxels++;
          const voxelCount = this.countSetBits(columnMask);
          totalVoxels += voxelCount;
          console.log(
            `  (${x},${z}): ${columnMask
              .toString(2)
              .padStart(8, "0")} [${voxelCount} voxels]`
          );
        }
      }
    }

    console.log(
      `Total: ${totalVoxels} voxels in ${columnsWithVoxels} columns`
    );
  }

  private static debugYFaceQuads(
    quads: QuadData[],
    faceMasks: FaceMask[]
  ): void {
    const yFaceMasks = faceMasks.filter(
      (mask) => mask.direction === 2 || mask.direction === 3
    );
    const yQuads = quads.filter(
      (quad) => Math.abs(quad.normal.y) === 1
    );

    console.log("Y-Face Results:");
    console.log(
      `  +Y faces detected: ${this.countTotalFaces(
        faceMasks[2]
      )}`
    );
    console.log(
      `  -Y faces detected: ${this.countTotalFaces(
        faceMasks[3]
      )}`
    );
    console.log(
      `  +Y quads generated: ${
        yQuads.filter((q) => q.normal.y === 1).length
      }`
    );
    console.log(
      `  -Y quads generated: ${
        yQuads.filter((q) => q.normal.y === -1).length
      }`
    );

    if (yQuads.length > 0) {
      console.log("Y-Quad Details:");
      yQuads.forEach((quad, i) => {
        const dir = quad.normal.y === 1 ? "+Y" : "-Y";
        console.log(
          `  ${dir} quad ${i}: vertices at Y=${quad.vertices[0].y}`
        );
      });
    }
  }

  private static countTotalFaces(
    faceMask: FaceMask
  ): number {
    let total = 0;
    for (let u = 0; u < faceMask.mask.length; u++) {
      for (let v = 0; v < faceMask.mask[u].length; v++) {
        total += this.countSetBits(faceMask.mask[u][v]);
      }
    }
    return total;
  }

  // Debug helper methods
  private static debugOccupancyMask(
    occupancyMask: bigint[][],
    chunk: ChunkData
  ): void {
    console.log(
      `[debugOccupancyMask] Analyzing occupancy mask for chunk (${chunk.position.x}, ${chunk.position.z})`
    );

    let totalSolidVoxels = 0;
    let columnsWithVoxels = 0;

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const columnMask = occupancyMask[x][z];
        if (columnMask !== 0n) {
          columnsWithVoxels++;
          const voxelCount = this.countSetBits(columnMask);
          totalSolidVoxels += voxelCount;

          if (x < 3 && z < 3) {
            // Only log first few for brevity
            console.log(
              `[debugOccupancyMask] Column (${x},${z}): mask=${columnMask.toString(
                2
              )}, voxels=${voxelCount}`
            );
          }
        }
      }
    }

    console.log(
      `[debugOccupancyMask] Total solid voxels: ${totalSolidVoxels}, columns with voxels: ${columnsWithVoxels}`
    );
  }

  private static debugFaceMasks(
    faceMasks: FaceMask[],
    chunk: ChunkData
  ): void {
    console.log(
      `[debugFaceMasks] Analyzing face masks for chunk (${chunk.position.x}, ${chunk.position.z})`
    );

    const faceNames = ["+X", "-X", "+Y", "-Y", "+Z", "-Z"];

    for (let i = 0; i < faceMasks.length; i++) {
      const faceMask = faceMasks[i];
      let totalFaces = 0;

      for (let u = 0; u < faceMask.mask.length; u++) {
        for (let v = 0; v < faceMask.mask[u].length; v++) {
          totalFaces += this.countSetBits(
            faceMask.mask[u][v]
          );
        }
      }

      console.log(
        `[debugFaceMasks] ${faceNames[i]} faces: ${totalFaces} (width=${faceMask.width}, height=${faceMask.height})`
      );
    }
  }

  private static debugQuads(
    quads: QuadData[],
    chunk: ChunkData
  ): void {
    console.log(
      `[debugQuads] Generated ${quads.length} quads for chunk (${chunk.position.x}, ${chunk.position.z})`
    );

    const quadsByDirection = [0, 0, 0, 0, 0, 0]; // Count by face direction
    const faceNames = ["+X", "-X", "+Y", "-Y", "+Z", "-Z"];

    for (const quad of quads) {
      // Determine face direction from normal
      const normal = quad.normal;
      let direction = -1;

      if (normal.x === 1) direction = 0; // +X
      else if (normal.x === -1) direction = 1; // -X
      else if (normal.y === 1) direction = 2; // +Y
      else if (normal.y === -1) direction = 3; // -Y
      else if (normal.z === 1) direction = 4; // +Z
      else if (normal.z === -1) direction = 5; // -Z

      if (direction >= 0) {
        quadsByDirection[direction]++;
      }
    }

    for (let i = 0; i < 6; i++) {
      console.log(
        `[debugQuads] ${faceNames[i]} quads: ${quadsByDirection[i]}`
      );
    }
  }

  private static countSetBits(mask: bigint): number {
    let count = 0;
    let temp = mask;
    while (temp !== 0n) {
      count += Number(temp & 1n);
      temp >>= 1n;
    }
    return count;
  }
}

// TODO: Implement the following optimizations:
// 1. Neighbor chunk data for seamless cross-chunk meshing
// 2. Ambient occlusion calculation
// 3. Texture coordinate generation
// 4. LOD support with different mesh resolutions
// 5. Memory pooling for array allocations
// 6. Web Worker support for parallel chunk processing
