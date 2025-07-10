import {
  ChunkData,
  Position3D,
  VoxelType,
  TerrainConfig,
} from "../../types";
import { ChunkHelpers } from "../chunk-generation/ChunkHelpers";
import { CHUNK_SIZE } from "../TerrainConfig";
import { PerlinNoise } from "./perlinNoise";

/**
 * NoiseGenerator creates procedural terrain using Perlin noise
 * Generates height maps and converts them to voxel data for the greedy meshing system
 */
export class NoiseGenerator {
  private static perlinNoise: PerlinNoise;

  /**
   * Initialize the noise generator with a specific seed
   */
  public static initialize(seed: number) {
    this.perlinNoise = new PerlinNoise(seed);
  }

  /**
   * Generate a single chunk using Perlin noise
   * Creates a 32x32 height map (including padding) and converts to voxel data
   *
   * @param position Chunk position in world coordinates
   * @param config Terrain configuration
   * @returns ChunkData compatible with greedy meshing system
   */
  public static generateNoiseChunk(
    position: Position3D,
    config: TerrainConfig
  ): ChunkData {
    // Ensure noise generator is initialized
    if (!this.perlinNoise) {
      this.initialize(config.generation.seed);
    }

    // Create empty chunk
    let chunk = ChunkHelpers.createEmpty(position);

    // Generate height map for the chunk including padding
    const heightMap = this.generateHeightMap(
      position,
      config
    );

    // Convert height map to voxel data
    this.populateChunkFromHeightMap(chunk, heightMap);

    return chunk;
  }

  /**
   * Generate a 32x32 height map for a chunk position
   * Includes padding for seamless chunk boundaries
   *
   * @param chunkPosition Chunk position in world coordinates
   * @param config Terrain configuration
   * @returns 32x32 height map (0-based heights)
   */
  private static generateHeightMap(
    chunkPosition: Position3D,
    config: TerrainConfig
  ): number[][] {
    const CHUNK_SIZE_P = CHUNK_SIZE + 2; // 32 (with padding)
    const heightMap: number[][] = [];

    // Get noise parameters from config
    const noiseConfig = config.generation.noise;

    // Generate height for each position including padding
    for (let localZ = 0; localZ < CHUNK_SIZE_P; localZ++) {
      heightMap[localZ] = [];
      for (
        let localX = 0;
        localX < CHUNK_SIZE_P;
        localX++
      ) {
        // Convert local chunk coordinates to world coordinates
        // Subtract 1 to account for padding (padding extends 1 block in each direction)
        const worldX = chunkPosition.x + localX - 1;
        const worldZ = chunkPosition.z + localZ - 1;

        // Sample Perlin noise at world coordinates
        const noiseValue = this.perlinNoise.octaveNoise2D(
          worldX * noiseConfig.scale,
          worldZ * noiseConfig.scale,
          noiseConfig.octaves,
          noiseConfig.persistence
        );

        // Convert noise (-1 to 1) to height (baseHeight to baseHeight + amplitude)
        const height = Math.floor(
          noiseConfig.baseHeight +
            (noiseValue + 1) * 0.5 * noiseConfig.amplitude
        );

        // Clamp height to reasonable bounds
        heightMap[localZ][localX] = Math.max(
          1,
          Math.min(height, CHUNK_SIZE - 1)
        );
      }
    }

    return heightMap;
  }

  /**
   * Populate chunk voxel data from a height map
   * Creates simple layered terrain: grass on top 2 layers, stone below
   *
   * @param chunk Chunk to populate
   * @param heightMap 32x32 height map
   */
  private static populateChunkFromHeightMap(
    chunk: ChunkData,
    heightMap: number[][]
  ): void {
    const CHUNK_SIZE_P = CHUNK_SIZE + 2; // 32

    for (let x = 1; x <= CHUNK_SIZE; x++) {
      for (let z = 1; z <= CHUNK_SIZE; z++) {
        const terrainHeight = heightMap[z][x]; // Note: heightMap is [z][x]
        // Fill column from Y=1 up to terrain height
        for (let y = 1; y <= terrainHeight; y++) {
          let voxelType: VoxelType;

          // Simple layering system
          const surfaceDepth = terrainHeight - y;
          if (surfaceDepth === 0) {
            // Surface layer: grass
            voxelType = VoxelType.GRASS;
          } else if (surfaceDepth === 1) {
            // Second layer: grass (for thicker grass layer)
            voxelType = VoxelType.GRASS;
          } else if (surfaceDepth <= 3) {
            // Next 2 layers: stone
            voxelType = VoxelType.STONE;
          } else {
            // Deep layers: stone
            voxelType = VoxelType.STONE;
          }

          ChunkHelpers.setVoxel(chunk, x, y, z, {
            type: voxelType,
          });
        }
      }
    }
  }
}
