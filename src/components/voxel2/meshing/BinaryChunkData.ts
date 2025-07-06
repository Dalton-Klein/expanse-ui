import { ChunkData, ChunkPosition, VoxelType } from "../types";
import { CHUNK_SIZE, CHUNK_HEIGHT } from "../terrain/TerrainConfig";

// Optimized chunk data structures for binary greedy meshing
// Uses compact representations and efficient access patterns

export interface BinaryChunkData {
  position: ChunkPosition;
  // Packed voxel data - each voxel type stored as 4 bits (supports up to 16 types)
  packedVoxels: Uint8Array;
  // Pre-computed occupancy masks for fast access - one bigint per X,Z column
  // Each bit in the bigint represents whether voxel at that Y position is solid
  occupancyColumns: bigint[][];
  // Neighbor chunk references for cross-chunk meshing
  neighbors: {
    posX?: BinaryChunkData;
    negX?: BinaryChunkData;
    posZ?: BinaryChunkData;
    negZ?: BinaryChunkData;
  };
}

export class BinaryChunkDataUtils {
  // Convert regular ChunkData to optimized BinaryChunkData
  static fromChunkData(chunk: ChunkData): BinaryChunkData {
    const voxelCount = CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE;
    const packedVoxels = new Uint8Array(Math.ceil(voxelCount / 2));
    const occupancyColumns: bigint[][] = [];
    
    // Pack voxels and compute occupancy masks
    for (let x = 0; x < CHUNK_SIZE; x++) {
      occupancyColumns[x] = [];
      
      for (let z = 0; z < CHUNK_SIZE; z++) {
        // Build occupancy mask for this x,z column (64 bits for 64 voxels)
        let columnMask = 0n;
        
        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          const voxel = chunk.voxels[x][y][z];
          const voxelType = voxel?.type || VoxelType.AIR;
          
          // Pack voxel type (4 bits per voxel)
          const linearIndex = x * CHUNK_HEIGHT * CHUNK_SIZE + y * CHUNK_SIZE + z;
          const byteIndex = Math.floor(linearIndex / 2);
          const isHighNibble = linearIndex % 2 === 1;
          
          if (isHighNibble) {
            packedVoxels[byteIndex] = (packedVoxels[byteIndex] & 0x0F) | (voxelType << 4);
          } else {
            packedVoxels[byteIndex] = (packedVoxels[byteIndex] & 0xF0) | voxelType;
          }
          
          // Set occupancy bit if voxel is solid
          if (voxelType !== VoxelType.AIR) {
            columnMask |= 1n << BigInt(y);
          }
        }
        
        occupancyColumns[x][z] = columnMask;
      }
    }
    
    return {
      position: chunk.position,
      packedVoxels,
      occupancyColumns,
      neighbors: {},
    };
  }
  
  // Get voxel type at position (unpacks from compact storage)
  static getVoxelType(data: BinaryChunkData, x: number, y: number, z: number): VoxelType {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
      return VoxelType.AIR;
    }
    
    const linearIndex = x * CHUNK_HEIGHT * CHUNK_SIZE + y * CHUNK_SIZE + z;
    const byteIndex = Math.floor(linearIndex / 2);
    const isHighNibble = linearIndex % 2 === 1;
    
    const byte = data.packedVoxels[byteIndex];
    return isHighNibble ? (byte >> 4) : (byte & 0x0F);
  }
  
  // Check if voxel is solid (fast path using pre-computed masks)
  static isVoxelSolid(data: BinaryChunkData, x: number, y: number, z: number): boolean {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
      return false;
    }
    
    const columnMask = data.occupancyColumns[x][z];
    return (columnMask & (1n << BigInt(y))) !== 0n;
  }
  
  // Get occupancy mask for a column (used in face culling)
  static getColumnMask(data: BinaryChunkData, x: number, z: number): bigint {
    if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) {
      return 0n;
    }
    
    return data.occupancyColumns[x][z] || 0n;
  }
  
  // Check if voxel is solid, including neighbor chunks
  static isVoxelSolidWithNeighbors(
    data: BinaryChunkData, 
    x: number, 
    y: number, 
    z: number
  ): boolean {
    // Check if position is in current chunk
    if (x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE) {
      return this.isVoxelSolid(data, x, y, z);
    }
    
    // Check neighbor chunks
    if (x < 0 && data.neighbors.negX) {
      return this.isVoxelSolid(data.neighbors.negX, CHUNK_SIZE + x, y, z);
    }
    if (x >= CHUNK_SIZE && data.neighbors.posX) {
      return this.isVoxelSolid(data.neighbors.posX, x - CHUNK_SIZE, y, z);
    }
    if (z < 0 && data.neighbors.negZ) {
      return this.isVoxelSolid(data.neighbors.negZ, x, y, CHUNK_SIZE + z);
    }
    if (z >= CHUNK_SIZE && data.neighbors.posZ) {
      return this.isVoxelSolid(data.neighbors.posZ, x, y, z - CHUNK_SIZE);
    }
    
    // No neighbor chunk available
    return false;
  }
  
  // Set neighbor chunks for cross-chunk meshing
  static setNeighbors(
    data: BinaryChunkData,
    neighbors: {
      posX?: BinaryChunkData;
      negX?: BinaryChunkData;
      posZ?: BinaryChunkData;
      negZ?: BinaryChunkData;
    }
  ): void {
    data.neighbors = neighbors;
  }
}

// Memory pool for reusing binary chunk data
export class BinaryChunkDataPool {
  private pool: BinaryChunkData[] = [];
  
  acquire(): BinaryChunkData {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    
    // Create new instance if pool is empty
    const voxelCount = CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE;
    const occupancyColumns: bigint[][] = [];
    
    // Initialize empty occupancy columns
    for (let x = 0; x < CHUNK_SIZE; x++) {
      occupancyColumns[x] = [];
      for (let z = 0; z < CHUNK_SIZE; z++) {
        occupancyColumns[x][z] = 0n;
      }
    }
    
    return {
      position: { x: 0, z: 0 },
      packedVoxels: new Uint8Array(Math.ceil(voxelCount / 2)),
      occupancyColumns,
      neighbors: {},
    };
  }
  
  release(data: BinaryChunkData): void {
    // Clear references
    data.neighbors = {};
    // Clear occupancy columns
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        data.occupancyColumns[x][z] = 0n;
      }
    }
    // Return to pool
    this.pool.push(data);
  }
}