import {
  ChunkData,
  VoxelType,
  DebugPattern,
  Position3D,
  TerrainConfig,
  GenerationAlgorithm,
} from "../../types";
import { ChunkGenerator } from "./ChunkGenerator";
import { ChunkHelpers } from "./ChunkHelpers";
import { NoiseGenerator } from "../noise-generation/noiseGenerator";

// This class is the parent for noise generation algorithms
// It takes in requests to build terrain, and then calls the appropriate algorithm based on the config
// It is designed to be extended for different noise generation techniques
// It calls chunk helper functions to generate chunks based on the requested pattern

export class TerrainGenerator {
  // Generate chunks based on terrain configuration
  public static generateChunks(
    config: TerrainConfig
  ): ChunkData[] {
    const chunks: ChunkData[] = [];
    
    // Determine grid size based on generation algorithm
    let gridSize: number;
    if (config.generation.algorithm === GenerationAlgorithm.NOISE) {
      // Use map size from noise config for noise generation
      gridSize = config.generation.noise.mapSize;
    } else {
      // Use render distance for debug patterns (maintain existing behavior)
      gridSize = config.renderDistance;
    }

    // Generate NxN grid of chunks
    // For gridSize 1: creates 1x1 grid at (0,0)
    // For gridSize 5: creates 5x5 grid from (0,0) to (4,4)
    // For gridSize 20: creates 20x20 grid from (0,0) to (19,19)
    for (let chunkX = 0; chunkX < gridSize; chunkX++) {
      for (let chunkZ = 0; chunkZ < gridSize; chunkZ++) {
        const position: Position3D = {
          x: chunkX * config.chunkSize,
          y: 0, // Y is always 0 for chunk positioning (single layer for now)
          z: chunkZ * config.chunkSize,
        };
        
        let chunk: ChunkData;
        
        // Generate chunks based on selected algorithm
        if (config.generation.algorithm === GenerationAlgorithm.NOISE) {
          // Use noise generation
          chunk = NoiseGenerator.generateNoiseChunk(position, config);
        } else {
          // Use debug patterns
          switch (config.generation.debugPattern) {
            case DebugPattern.FLAT:
              chunk = ChunkGenerator.generateFlatChunk(position);
              break;
            case DebugPattern.TINY:
              chunk = ChunkGenerator.generateTinyChunk(position);
              break;
            case DebugPattern.CHECKERBOARD:
              chunk = ChunkGenerator.generateFlatChunk(position);
              break;
            case DebugPattern.STEPPED:
              chunk = ChunkGenerator.generateSteppedChunk(position);
              break;
            case DebugPattern.TWO_CUBES:
              chunk = ChunkGenerator.generateTwoCubesChunk(position);
              break;
            default:
              chunk = ChunkGenerator.generateFlatChunk(position);
          }
        }
        
        // Debug: Print chunk data and validate padding for first chunk only
        if (chunkX === 0 && chunkZ === 0) {
          const label = config.generation.algorithm === GenerationAlgorithm.NOISE 
            ? `Noise ${gridSize}x${gridSize}` 
            : config.generation.debugPattern;
          ChunkHelpers.validatePadding(chunk, `${label} Pattern`);
        }
        
        chunks.push(chunk);
      }
    }

    return chunks;
  }
}
