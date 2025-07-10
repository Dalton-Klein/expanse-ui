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
  // Generate test chunk with specified pattern
  public static generateChunks(
    config: TerrainConfig
  ): ChunkData[] {
    const chunks: ChunkData[] = [];
    const renderDistance = config.renderDistance;

    // Calculate chunk grid bounds
    // For render distance 2: creates 2x2 grid from (0,0) to (1,1)
    // For render distance 3: creates 3x3 grid from (0,0) to (2,2)
    const gridSize = renderDistance;
    for (let chunkX = 0; chunkX < gridSize; chunkX++) {
      for (let chunkZ = 0; chunkZ < gridSize; chunkZ++) {
        const position: Position3D = {
          x: chunkX * config.chunkSize,
          y: 0, // Y is always 0 for chunk positioning
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
        
        // Debug: Print chunk data for first chunk only
        if (chunkX === 0 && chunkZ === 0) {
          ChunkHelpers.debugPrintChunk(chunk, `${config.generation.algorithm === GenerationAlgorithm.NOISE ? 'Noise' : config.generation.debugPattern} Pattern`);
        }
        
        chunks.push(chunk);
      }
    }

    return chunks;
  }
}
