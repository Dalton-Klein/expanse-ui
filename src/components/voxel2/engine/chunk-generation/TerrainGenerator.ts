import {
  ChunkData,
  DebugPattern,
  Position3D,
  TerrainConfig,
  GenerationAlgorithm,
} from "../../types";
import { ChunkGenerator } from "./ChunkGenerator";
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
    if (
      config.generation.algorithm ===
      GenerationAlgorithm.NOISE
    ) {
      // Use map size from noise config for noise generation
      gridSize = config.generation.noise.mapSize;
    } else {
      // Use render distance for debug patterns (maintain existing behavior)
      gridSize = config.renderDistance;
    }

    // Calculate number of vertical chunks needed
    const verticalChunks = Math.ceil(
      config.worldHeight / config.chunkSize
    );
    console.log(
      `[TerrainGenerator] Generating ${gridSize}x${verticalChunks}x${gridSize} chunks (worldHeight: ${config.worldHeight}, chunkSize: ${config.chunkSize})`
    );

    // Generate 3D grid of chunks (X, Y, Z)
    for (let chunkX = 0; chunkX < gridSize; chunkX++) {
      for (
        let chunkY = 0;
        chunkY < verticalChunks;
        chunkY++
      ) {
        for (let chunkZ = 0; chunkZ < gridSize; chunkZ++) {
          const position: Position3D = {
            x: chunkX * config.chunkSize,
            y: chunkY * config.chunkSize, // Y position now varies (0, 30, 60, etc.)
            z: chunkZ * config.chunkSize,
          };

          let chunk: ChunkData;

          // Generate chunks based on selected algorithm
          if (
            config.generation.algorithm ===
            GenerationAlgorithm.NOISE
          ) {
            // Use noise generation
            chunk = NoiseGenerator.generateNoiseChunk(
              position,
              config,
              { x: chunkX, z: chunkZ },
              gridSize
            );
          } else {
            // Use debug patterns
            switch (config.generation.debugPattern) {
              case DebugPattern.FLAT:
                chunk =
                  ChunkGenerator.generateFlatChunk(
                    position
                  );
                break;
              case DebugPattern.TINY:
                chunk =
                  ChunkGenerator.generateTinyChunk(
                    position
                  );
                break;
              case DebugPattern.CHECKERBOARD:
                chunk =
                  ChunkGenerator.generateFlatChunk(
                    position
                  );
                break;
              case DebugPattern.STEPPED:
                chunk =
                  ChunkGenerator.generateSteppedChunk(
                    position
                  );
                break;
              case DebugPattern.TWO_CUBES:
                chunk =
                  ChunkGenerator.generateTwoCubesChunk(
                    position
                  );
                break;
              default:
                chunk =
                  ChunkGenerator.generateFlatChunk(
                    position
                  );
            }
          }

          // Debug: Print chunk data and validate padding for first chunk only
          if (
            chunkX === 0 &&
            chunkY === 0 &&
            chunkZ === 0
          ) {
            // const label =
            //   config.generation.algorithm ===
            //   GenerationAlgorithm.NOISE
            //     ? `Noise ${gridSize}x${verticalChunks}x${gridSize}`
            //     : config.generation.debugPattern;
            //ChunkHelpers.validatePadding(chunk, `${label} Pattern`);
          }

          chunks.push(chunk);
        }
      }
    }

    console.log(
      `[TerrainGenerator] Generated ${chunks.length} chunks total`
    );
    return chunks;
  }
}
