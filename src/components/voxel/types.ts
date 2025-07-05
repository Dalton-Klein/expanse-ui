export enum VoxelType {
  AIR = 0,
  GRASS = 1,
  DIRT = 2,
  STONE = 3,
  SAND = 4,
  WATER = 5,
}

export interface Voxel {
  type: VoxelType;
}

export enum LODLevel {
  FULL = 1,    // Full detail (1x1x1)
  MEDIUM = 2,  // 4x4x4 areas combined into single voxels
  LOW = 3      // 8x8x8 areas combined into single voxels
}

export interface LODConfig {
  level1Distance: number;  // Distance where LOD switches from FULL to MEDIUM
  level2Distance: number;  // Distance where LOD switches from MEDIUM to LOW
  level1Scale: number;     // Voxel grouping scale for MEDIUM LOD (4x4x4)
  level2Scale: number;     // Voxel grouping scale for LOW LOD (8x8x8)
  hysteresis: number;      // Buffer distance to prevent LOD flickering (e.g., 1.5)
}

export interface ChunkData {
  position: [number, number, number];
  voxels: Voxel[][][];
  lodLevel: LODLevel;
  lodScale: number;  // How many original voxels each LOD voxel represents
}

export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 100; // Separate height for chunks
export const VOXEL_SIZE = 1;
