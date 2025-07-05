import * as THREE from "three";
import { VoxelType, CHUNK_SIZE, CHUNK_HEIGHT } from "./types";

export interface Face {
  vertices: number[];
  indices: number[];
  color: THREE.Color;
  normal: THREE.Vector3;
}

export interface GreedyMeshData {
  vertices: Float32Array;
  indices: Uint16Array;
  colors: Float32Array;
  normals: Float32Array;
}

const voxelColors = {
  [VoxelType.AIR]: new THREE.Color(0x000000),
  [VoxelType.GRASS]: new THREE.Color(0x4ade80),
  [VoxelType.DIRT]: new THREE.Color(0x8b4513),
  [VoxelType.STONE]: new THREE.Color(0x808080),
  [VoxelType.SAND]: new THREE.Color(0xffd700),
  [VoxelType.WATER]: new THREE.Color(0x0000ff),
};

export class GreedyMesher {
  private voxels: VoxelType[][][];
  private chunkPosition: [number, number, number];

  constructor(voxels: VoxelType[][][], chunkPosition: [number, number, number]) {
    this.voxels = voxels;
    this.chunkPosition = chunkPosition;
  }

  // Check if a voxel is solid (not air)
  private isVoxelSolid(x: number, y: number, z: number): boolean {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
      return false; // Treat out of bounds as air
    }
    return this.voxels[x][y][z] !== VoxelType.AIR;
  }

  // Get voxel type safely
  private getVoxelType(x: number, y: number, z: number): VoxelType {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
      return VoxelType.AIR;
    }
    return this.voxels[x][y][z];
  }

  // Check if a face should be rendered (adjacent voxel is air or different type)
  private shouldRenderFace(x: number, y: number, z: number, adjacentX: number, adjacentY: number, adjacentZ: number): boolean {
    const currentVoxel = this.getVoxelType(x, y, z);
    const adjacentVoxel = this.getVoxelType(adjacentX, adjacentY, adjacentZ);
    
    // Render face if adjacent is air or we're at chunk boundary
    return adjacentVoxel === VoxelType.AIR || 
           adjacentX < 0 || adjacentX >= CHUNK_SIZE ||
           adjacentY < 0 || adjacentY >= CHUNK_HEIGHT ||
           adjacentZ < 0 || adjacentZ >= CHUNK_SIZE;
  }

  // Generate greedy mesh
  public generateMesh(): GreedyMeshData {
    const faces: Face[] = [];
    const visited = new Set<string>();

    // Define face directions
    const directions = [
      { dir: [1, 0, 0], name: 'right' },   // +X
      { dir: [-1, 0, 0], name: 'left' },   // -X
      { dir: [0, 1, 0], name: 'top' },     // +Y
      { dir: [0, -1, 0], name: 'bottom' }, // -Y
      { dir: [0, 0, 1], name: 'front' },   // +Z
      { dir: [0, 0, -1], name: 'back' }    // -Z
    ];

    // For each direction, create greedy quads
    for (const { dir, name } of directions) {
      const [dx, dy, dz] = dir;
      
      // Create a 2D mask for this direction
      const mask: (VoxelType | null)[][] = [];
      
      // Determine the two axes perpendicular to the direction
      let u, v, d; // u and v are the 2D axes, d is the depth axis
      let uSize, vSize, dSize;
      
      if (dx !== 0) { // X direction
        [u, v, d] = [1, 2, 0]; // Y, Z, X
        [uSize, vSize, dSize] = [CHUNK_HEIGHT, CHUNK_SIZE, CHUNK_SIZE];
      } else if (dy !== 0) { // Y direction
        [u, v, d] = [0, 2, 1]; // X, Z, Y
        [uSize, vSize, dSize] = [CHUNK_SIZE, CHUNK_SIZE, CHUNK_HEIGHT];
      } else { // Z direction
        [u, v, d] = [0, 1, 2]; // X, Y, Z
        [uSize, vSize, dSize] = [CHUNK_SIZE, CHUNK_HEIGHT, CHUNK_SIZE];
      }

      // Iterate through each slice along the direction
      for (let slice = 0; slice < dSize; slice++) {
        // Clear the mask
        for (let i = 0; i < uSize; i++) {
          mask[i] = new Array(vSize).fill(null);
        }

        // Fill the mask for this slice
        for (let i = 0; i < uSize; i++) {
          for (let j = 0; j < vSize; j++) {
            const pos = [0, 0, 0];
            pos[u] = i;
            pos[v] = j;
            pos[d] = slice;
            
            const [x, y, z] = pos;
            const adjacentPos = [x + dx, y + dy, z + dz];
            
            if (this.isVoxelSolid(x, y, z) && 
                this.shouldRenderFace(x, y, z, adjacentPos[0], adjacentPos[1], adjacentPos[2])) {
              mask[i][j] = this.getVoxelType(x, y, z);
            }
          }
        }

        // Generate quads from the mask using greedy algorithm
        for (let i = 0; i < uSize; i++) {
          for (let j = 0; j < vSize; ) {
            if (mask[i][j] !== null) {
              const voxelType = mask[i][j]!;
              
              // Compute width
              let width = 1;
              while (j + width < vSize && mask[i][j + width] === voxelType) {
                width++;
              }

              // Compute height
              let height = 1;
              let canExtend = true;
              while (i + height < uSize && canExtend) {
                for (let k = 0; k < width; k++) {
                  if (mask[i + height][j + k] !== voxelType) {
                    canExtend = false;
                    break;
                  }
                }
                if (canExtend) height++;
              }

              // Create the quad
              const quad = this.createQuad(i, j, slice, height, width, voxelType, u, v, d, dx > 0 || dy > 0 || dz > 0);
              faces.push(quad);

              // Clear the mask for the quad area
              for (let h = 0; h < height; h++) {
                for (let w = 0; w < width; w++) {
                  mask[i + h][j + w] = null;
                }
              }

              j += width;
            } else {
              j++;
            }
          }
        }
      }
    }

    return this.facesToBufferGeometry(faces);
  }

  private createQuad(
    i: number, j: number, slice: number,
    height: number, width: number,
    voxelType: VoxelType,
    u: number, v: number, d: number,
    flipWinding: boolean
  ): Face {
    const vertices = [];
    
    // Create 4 corners of the quad
    const corners = [
      [0, 0], [0, width], [height, width], [height, 0]
    ];

    for (const [h, w] of corners) {
      const corner = [0, 0, 0];
      corner[u] = i + h;
      corner[v] = j + w;
      corner[d] = slice;
      
      // Adjust face position based on direction
      if (flipWinding) {
        if (d === 0) corner[0] += 1; // +X face
        else if (d === 1) corner[1] += 1; // +Y face  
        else if (d === 2) corner[2] += 1; // +Z face
      }
      
      vertices.push(
        this.chunkPosition[0] * CHUNK_SIZE + corner[0],
        this.chunkPosition[1] * CHUNK_SIZE + corner[1],
        this.chunkPosition[2] * CHUNK_SIZE + corner[2]
      );
    }

    // Calculate normal based on direction and flip
    const normal = new THREE.Vector3();
    if (d === 0) normal.set(flipWinding ? 1 : -1, 0, 0);        // X faces
    else if (d === 1) normal.set(0, flipWinding ? 1 : -1, 0);   // Y faces
    else normal.set(0, 0, flipWinding ? 1 : -1);                // Z faces

    // Use correct winding order based on direction
    let indices;
    if (flipWinding) {
      indices = [0, 1, 2, 0, 2, 3]; // Counter-clockwise for positive faces
    } else {
      indices = [0, 3, 2, 0, 2, 1]; // Clockwise for negative faces
    }

    return {
      vertices,
      indices,
      color: voxelColors[voxelType],
      normal
    };
  }

  private facesToBufferGeometry(faces: Face[]): GreedyMeshData {
    const vertices: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];
    const normals: number[] = [];

    let vertexOffset = 0;

    for (const face of faces) {
      // Add vertices
      vertices.push(...face.vertices);

      // Add indices with offset
      for (const index of face.indices) {
        indices.push(vertexOffset + index);
      }

      // Add colors for each vertex
      for (let i = 0; i < 4; i++) {
        colors.push(face.color.r, face.color.g, face.color.b);
      }

      // Add normals for each vertex
      for (let i = 0; i < 4; i++) {
        normals.push(face.normal.x, face.normal.y, face.normal.z);
      }

      vertexOffset += 4;
    }

    return {
      vertices: new Float32Array(vertices),
      indices: new Uint16Array(indices),
      colors: new Float32Array(colors),
      normals: new Float32Array(normals)
    };
  }
}