import {
  ChunkData,
  ChunkPosition,
  VoxelType,
  DebugPattern,
  TerrainConfig,
} from "../types";
import { CHUNK_SIZE, CHUNK_HEIGHT } from "../terrain/TerrainConfig";
import { ChunkDataUtils } from "../chunks/ChunkData";

/**
 * Debug terrain generator for testing and development
 * Creates predictable terrain patterns for debugging greedy meshing and LOD systems
 */
export class DebugTerrainGenerator {
  
  /**
   * Generate all chunks for debug terrain based on render distance
   * Creates a grid of chunks centered around world origin (0,0)
   */
  static generateDebugTerrain(config: TerrainConfig): ChunkData[] {
    const chunks: ChunkData[] = [];
    const renderDistance = config.renderDistance;
    
    // Calculate chunk grid bounds
    // For render distance 2: creates 2x2 grid from (0,0) to (1,1)
    // For render distance 3: creates 3x3 grid from (0,0) to (2,2)
    const gridSize = renderDistance;
    
    for (let chunkX = 0; chunkX < gridSize; chunkX++) {
      for (let chunkZ = 0; chunkZ < gridSize; chunkZ++) {
        const position: ChunkPosition = { x: chunkX, z: chunkZ };
        const chunk = DebugTerrainGenerator.generateDebugChunk(position, config);
        chunks.push(chunk);
      }
    }
    
    return chunks;
  }
  
  /**
   * Generate a single chunk with debug pattern
   */
  static generateDebugChunk(position: ChunkPosition, config: TerrainConfig): ChunkData {
    const chunk = ChunkDataUtils.createEmpty(position);
    
    switch (config.generation.debugPattern) {
      case DebugPattern.FLAT:
        DebugTerrainGenerator.generateFlatPattern(chunk, config);
        break;
      case DebugPattern.CHECKERBOARD:
        DebugTerrainGenerator.generateCheckerboardPattern(chunk, config);
        break;
      case DebugPattern.STEPPED:
        DebugTerrainGenerator.generateSteppedPattern(chunk, config);
        break;
      default:
        DebugTerrainGenerator.generateFlatPattern(chunk, config);
    }
    
    return chunk;
  }
  
  /**
   * Generate flat terrain pattern
   * All voxels at Y=1 with grass blocks
   */
  private static generateFlatPattern(chunk: ChunkData, config: TerrainConfig): void {
    const baseHeight = 1; // Y level for flat terrain
    
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        // Set grass block at base height
        ChunkDataUtils.setVoxel(chunk, x, baseHeight, z, { 
          type: VoxelType.GRASS 
        });
      }
    }
  }
  
  /**
   * Generate checkerboard pattern
   * Alternating grass and dirt blocks at Y=1
   */
  private static generateCheckerboardPattern(chunk: ChunkData, config: TerrainConfig): void {
    const baseHeight = 1;
    
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        // Create checkerboard pattern
        const isEven = (x + z) % 2 === 0;
        const voxelType = isEven ? VoxelType.GRASS : VoxelType.DIRT;
        
        ChunkDataUtils.setVoxel(chunk, x, baseHeight, z, { 
          type: voxelType 
        });
      }
    }
  }
  
  /**
   * Generate stepped pattern
   * Diagonal height variations with different materials
   */
  private static generateSteppedPattern(chunk: ChunkData, config: TerrainConfig): void {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        // Calculate world coordinates
        const worldX = chunk.position.x * CHUNK_SIZE + x;
        const worldZ = chunk.position.z * CHUNK_SIZE + z;
        
        // Create diagonal stepping pattern
        const diagonalIndex = worldX + worldZ;
        const stepHeight = 1 + (diagonalIndex % 4); // Heights 1-4
        
        // Choose material based on height
        let voxelType: VoxelType;
        switch (stepHeight) {
          case 1: voxelType = VoxelType.GRASS; break;
          case 2: voxelType = VoxelType.DIRT; break;
          case 3: voxelType = VoxelType.STONE; break;
          case 4: voxelType = VoxelType.SAND; break;
          default: voxelType = VoxelType.GRASS;
        }
        
        // Fill from Y=1 up to step height
        for (let y = 1; y <= stepHeight; y++) {
          ChunkDataUtils.setVoxel(chunk, x, y, z, { 
            type: voxelType 
          });
        }
      }
    }
  }
  
  /**
   * Get chunk positions for debug terrain grid
   */
  static getDebugChunkPositions(renderDistance: number): ChunkPosition[] {
    const positions: ChunkPosition[] = [];
    const gridSize = renderDistance;
    
    for (let chunkX = 0; chunkX < gridSize; chunkX++) {
      for (let chunkZ = 0; chunkZ < gridSize; chunkZ++) {
        positions.push({ x: chunkX, z: chunkZ });
      }
    }
    
    return positions;
  }
  
  /**
   * Calculate total number of chunks for debug terrain
   */
  static getDebugChunkCount(renderDistance: number): number {
    return renderDistance * renderDistance;
  }
}