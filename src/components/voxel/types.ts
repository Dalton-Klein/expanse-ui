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

export interface ChunkData {
  position: [number, number, number];
  voxels: Voxel[][][];
}

export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 64; // Separate height for chunks
export const VOXEL_SIZE = 1;