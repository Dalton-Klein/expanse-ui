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
   * @returns 32x32 height map (world Y coordinates)
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

        // Initialize height with base height
        let totalHeight = noiseConfig.baseHeight;

        // Continental layer (large-scale landmasses)
        if (noiseConfig.continental.enabled) {
          const continentalNoise =
            this.perlinNoise.octaveNoise2D(
              worldX * noiseConfig.continental.scale,
              worldZ * noiseConfig.continental.scale,
              noiseConfig.continental.octaves,
              noiseConfig.continental.persistence
            );
          totalHeight +=
            (continentalNoise + 0.2) *
            noiseConfig.continental.amplitude;
        }

        // Regional layer (hills and valleys)
        if (noiseConfig.regional.enabled) {
          const regionalNoise =
            this.perlinNoise.octaveNoise2D(
              worldX * noiseConfig.regional.scale,
              worldZ * noiseConfig.regional.scale,
              noiseConfig.regional.octaves,
              noiseConfig.regional.persistence
            );
          totalHeight +=
            (regionalNoise + 0.2) *
            noiseConfig.regional.amplitude;
        }

        // Local layer (surface detail)
        if (noiseConfig.local.enabled) {
          const localNoise = this.perlinNoise.octaveNoise2D(
            worldX * noiseConfig.local.scale,
            worldZ * noiseConfig.local.scale,
            noiseConfig.local.octaves,
            noiseConfig.local.persistence
          );
          totalHeight +=
            (localNoise + 0.2) *
            noiseConfig.local.amplitude;
        }

        // Convert to integer height
        const height = Math.floor(totalHeight);

        // Clamp height to world bounds (1 to worldHeight-1)
        heightMap[localZ][localX] = Math.max(
          1,
          Math.min(height, config.worldHeight - 1)
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
   * @param heightMap 32x32 height map (contains world Y coordinates)
   */
  private static populateChunkFromHeightMap(
    chunk: ChunkData,
    heightMap: number[][]
  ): void {
    const CHUNK_SIZE_P = CHUNK_SIZE + 2; // 32
    const chunkMinY = chunk.position.y; // World Y coordinate where this chunk starts
    const chunkMaxY = chunkMinY + CHUNK_SIZE - 1; // World Y coordinate where this chunk ends

    for (let x = 1; x <= CHUNK_SIZE; x++) {
      for (let z = 1; z <= CHUNK_SIZE; z++) {
        const terrainHeight = heightMap[z][x]; // Note: heightMap is [z][x], contains world Y coordinate

        // For each Y position in this chunk
        for (
          let localY = 1;
          localY <= CHUNK_SIZE;
          localY++
        ) {
          const worldY = chunkMinY + localY - 1; // Convert to world Y coordinate

          // Skip if this position is above the terrain
          if (worldY > terrainHeight) {
            continue; // Leave as air
          }

          // Determine voxel type based on depth from surface
          let voxelType: VoxelType;
          const surfaceDepth = terrainHeight - worldY;

          if (surfaceDepth === 0) {
            // Surface layer: grass
            voxelType = VoxelType.GRASS;
          } else if (surfaceDepth === 1) {
            // Second layer: grass (for thicker grass layer)
            voxelType = VoxelType.GRASS;
          } else if (surfaceDepth <= 2) {
            // Next 2 layers: dirt
            voxelType = VoxelType.DIRT;
          } else if (surfaceDepth <= 4) {
            // Next 2 layers: stone
            voxelType = VoxelType.STONE;
          } else {
            // Deep layers: stone
            voxelType = VoxelType.STONE;
          }

          ChunkHelpers.setVoxel(chunk, x, localY, z, {
            type: voxelType,
          });
        }
      }
    }
  }
}
