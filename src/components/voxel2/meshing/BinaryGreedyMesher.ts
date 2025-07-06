import * as THREE from "three";
import { ChunkData, VoxelType } from "../types";
import { CHUNK_SIZE, CHUNK_HEIGHT } from "../terrain/TerrainConfig";
import { BitMaskUtils } from "./BitMaskUtils";
import { GreedyQuadGenerator, QuadData } from "./GreedyQuadGenerator";

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
    { axis: 0, positive: true },  // +X (Right)
    { axis: 0, positive: false }, // -X (Left)
    { axis: 1, positive: true },  // +Y (Top)
    { axis: 1, positive: false }, // -Y (Bottom)
    { axis: 2, positive: true },  // +Z (Front)
    { axis: 2, positive: false }, // -Z (Back)
  ];

  // Main entry point for mesh generation
  static generateMesh(chunk: ChunkData): BinaryMeshResult {
    const startTime = performance.now();
    
    // Step 1: Create binary occupancy mask
    const occupancyMask = this.createOccupancyMask(chunk);
    
    // Step 2: Cull faces using bitwise operations
    const faceMasks = this.cullFaces(occupancyMask, chunk);
    
    // Step 3: Generate greedy quads from face masks
    const quads = this.generateQuads(faceMasks, chunk);
    
    // Step 4: Build Three.js geometry from quads
    const geometry = this.buildGeometry(quads);
    
    const endTime = performance.now();
    
    return {
      geometry,
      triangleCount: quads.length * 2, // Each quad = 2 triangles
      generationTimeMs: endTime - startTime,
    };
  }

  // Step 1: Create binary occupancy mask
  // Each bit represents whether a voxel is solid (1) or air (0)
  private static createOccupancyMask(chunk: ChunkData): bigint[][] {
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
  private static cullFaces(occupancyMask: bigint[][], chunk: ChunkData): FaceMask[] {
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
  ): { mask: bigint[][], width: number, height: number } {
    // Determine dimensions based on axis
    const [width, height] = axis === 0 ? [CHUNK_SIZE, CHUNK_HEIGHT] :
                           axis === 1 ? [CHUNK_SIZE, CHUNK_SIZE] :
                                        [CHUNK_SIZE, CHUNK_HEIGHT];
    
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
  private static cullXFaces(occupancyMask: bigint[][], faceMask: bigint[][], positive: boolean): void {
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

  // Cull Y-axis faces using bitwise operations
  private static cullYFaces(occupancyMask: bigint[][], faceMask: bigint[][], positive: boolean): void {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      faceMask[x] = [];
      faceMask[x][0] = 0n;
      
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const currentColumn = occupancyMask[x][z];
        
        if (positive) {
          // +Y face: check if voxel above is air
          // Shift current column up by 1 bit to get "voxel above" mask
          const voxelAbove = currentColumn << 1n;
          // Faces are exposed where current has voxels but above doesn't
          const exposedFaces = currentColumn & ~voxelAbove;
          // Also expose top face of highest voxel (bit 63)
          const topFace = currentColumn & (1n << 63n);
          faceMask[x][0] |= exposedFaces | topFace;
        } else {
          // -Y face: check if voxel below is air
          // Shift current column down by 1 bit to get "voxel below" mask
          const voxelBelow = currentColumn >> 1n;
          // Faces are exposed where current has voxels but below doesn't
          const exposedFaces = currentColumn & ~voxelBelow;
          // Also expose bottom face of lowest voxel (bit 0)
          const bottomFace = currentColumn & 1n;
          faceMask[x][0] |= exposedFaces | bottomFace;
        }
      }
    }
  }

  // Cull Z-axis faces using bitwise operations
  private static cullZFaces(occupancyMask: bigint[][], faceMask: bigint[][], positive: boolean): void {
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
  private static generateQuads(faceMasks: FaceMask[], chunk: ChunkData): QuadData[] {
    const allQuads: QuadData[] = [];
    
    for (const faceMask of faceMasks) {
      const quads = GreedyQuadGenerator.generateQuadsForFace(
        faceMask,
        chunk,
        faceMask.direction
      );
      allQuads.push(...quads);
    }
    
    return allQuads;
  }

  // Step 4: Build Three.js geometry from quads
  private static buildGeometry(quads: QuadData[]): THREE.BufferGeometry {
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
      const baseIndex = (vertexIndex - 4);
      indices[indexIndex++] = baseIndex;
      indices[indexIndex++] = baseIndex + 1;
      indices[indexIndex++] = baseIndex + 2;
      indices[indexIndex++] = baseIndex;
      indices[indexIndex++] = baseIndex + 2;
      indices[indexIndex++] = baseIndex + 3;
    }
    
    // Set attributes
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    
    return geometry;
  }
}

// TODO: Implement the following optimizations:
// 1. Neighbor chunk data for seamless cross-chunk meshing
// 2. Ambient occlusion calculation
// 3. Texture coordinate generation
// 4. LOD support with different mesh resolutions
// 5. Memory pooling for array allocations
// 6. Web Worker support for parallel chunk processing