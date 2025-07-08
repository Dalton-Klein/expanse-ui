import {
  ChunkData,
  VoxelType,
  DebugPattern,
  Position3D,
  TerrainConfig,
} from "../../types";
import { ChunkGenerator } from "./ChunkGenerator";

// This class is the parent for noise generation algorithms
// It takes in requests to build terrain, and then calls the appropriate algorithm based on the config
// It is designed to be extended for different noise generation techniques
// It calls chunk helper functions to generate chunks based on the requested pattern

export class TerrainGenerator {
  // Generate test chunk with specified pattern
  static generateChunks(
    config: TerrainConfig
  ): ChunkData[] {
    // TODO: Implement pattern generation
    switch (config.generation.debugPattern) {
      case DebugPattern.FLAT:
        return TerrainGenerator.generateFlat(config);
      case DebugPattern.CHECKERBOARD:
      // return TerrainGenerator.generateCheckerboard(
      //   position
      // );
      case DebugPattern.STEPPED:
      //return TerrainGenerator.generateStepped(position);
      default:
        return TerrainGenerator.generateFlat(config);
    }
  }

  // TODO: Implement flat terrain pattern
  private static generateFlat(
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
          y: 0, // Y is always 0 for debug terrain
          z: chunkZ * config.chunkSize,
        };
        const chunk =
          ChunkGenerator.generateFlatChunk(position);
        chunks.push(chunk);
      }
    }

    return chunks;
  }

  // TODO: Implement checkerboard pattern
  private static generateCheckerboard(
    position: Position3D
  ): ChunkData {
    // Alternating materials for face culling tests
    throw new Error(
      "TODO: Implement checkerboard pattern generation"
    );
  }

  // TODO: Implement stepped pattern
  private static generateStepped(
    position: Position3D
  ): ChunkData {
    // Height variations for complex geometry tests
    throw new Error(
      "TODO: Implement stepped pattern generation"
    );
  }

  // TODO: Add more patterns:
  // - Material transitions
  // - Random noise
  // - Edge cases
}

// TODO: Add pattern validation utilities
// TODO: Add pattern comparison tools
