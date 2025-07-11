import {
  ChunkData,
  Position3D,
  VoxelType,
  TerrainConfig,
} from "../../types";
import { ChunkHelpers } from "../chunk-generation/ChunkHelpers";
import {
  CHUNK_SIZE,
  WORLD_HEIGHT,
  WORLD_SEED,
} from "../TerrainConfig";
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
   * @param gridPosition Chunk position in the grid (for edge detection)
   * @param gridSize Total size of the chunk grid
   * @returns ChunkData compatible with greedy meshing system
   */
  public static generateNoiseChunk(
    position: Position3D,
    config: TerrainConfig,
    gridPosition: { x: number; y: number; z: number } = {
      x: 0,
      y: 0,
      z: 0,
    },
    gridSize: number = 1
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
    // Debug: Print terrain height at center position
    if (position.x === 0 && position.z === 0) {
      console.log(
        `[DEBUG] Chunk Y=${position.y}: Terrain height at (16,16) = ${heightMap[16][16]}`
      );
    }

    // Convert height map to voxel data
    this.populateChunkFromHeightMap(
      chunk,
      heightMap,
      gridPosition,
      gridSize
    );

    // Debug: Print specific voxel types after population
    if (position.x === 0 && position.z === 0) {
      if (position.y === 0) {
        // Bottom chunk: check local y=30-32
        console.log(
          `[DEBUG] Bottom chunk voxels at x=16, z=16:`
        );
        for (let y = 29; y <= 31; y++) {
          const voxel = ChunkHelpers.getVoxel(
            chunk,
            16,
            y,
            16
          );
          console.log(
            `  Local y=${y}: ${voxel?.type || "null"}`
          );
        }
      } else if (position.y === 30) {
        // Second chunk: check local y=1-3
        console.log(
          `[DEBUG] Second chunk voxels at x=16, z=16:`
        );
        for (let y = 0; y <= 2; y++) {
          const voxel = ChunkHelpers.getVoxel(
            chunk,
            16,
            y,
            16
          );
          console.log(
            `  Local y=${y}: ${voxel?.type || "null"}`
          );
        }
      }
    }

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
   * Calculate slope at a given position in the height map
   * Returns the maximum height difference to adjacent positions
   *
   * @param heightMap 32x32 height map
   * @param x X coordinate in height map
   * @param z Z coordinate in height map
   * @returns Maximum height difference to neighbors
   */
  private static calculateSlope(
    heightMap: number[][],
    x: number,
    z: number
  ): number {
    const centerHeight = heightMap[z][x];
    const northHeight =
      heightMap[z - 1]?.[x] ?? centerHeight;
    const southHeight =
      heightMap[z + 1]?.[x] ?? centerHeight;
    const westHeight =
      heightMap[z]?.[x - 1] ?? centerHeight;
    const eastHeight =
      heightMap[z]?.[x + 1] ?? centerHeight;

    // Return maximum height difference in any direction
    return Math.max(
      Math.abs(centerHeight - northHeight),
      Math.abs(centerHeight - southHeight),
      Math.abs(centerHeight - westHeight),
      Math.abs(centerHeight - eastHeight)
    );
  }

  /**
   * Populate chunk voxel data from a height map
   * Creates simple layered terrain: grass on top 2 layers, stone below
   * Uses slope detection to place stone on steep surfaces
   *
   * @param chunk Chunk to populate
   * @param heightMap 32x32 height map (contains world Y coordinates)
   * @param gridPosition Chunk position in the grid (for edge detection)
   * @param gridSize Total size of the chunk grid
   */
  private static populateChunkFromHeightMap(
    chunk: ChunkData,
    heightMap: number[][],
    gridPosition: { x: number; y: number; z: number },
    gridSize: number
  ): void {
    const CHUNK_SIZE_P = CHUNK_SIZE + 2; // 32
    const chunkMinY = chunk.position.y; // World Y coordinate where this chunk starts

    // Determine which edges don't have neighbors
    const isWestEdge = gridPosition.x === 0;
    const isNorthEdge = gridPosition.z === 0;
    const isBottomEdge = gridPosition.y === 0;

    for (let x = 0; x < CHUNK_SIZE_P; x++) {
      for (let z = 0; z < CHUNK_SIZE_P; z++) {
        // Skip padding areas that don't have neighbors
        if (
          (isWestEdge && x === 0) ||
          (isNorthEdge && z === 0)
        ) {
          continue; // Leave as air
        }
        const terrainHeight = heightMap[z][x]; // Note: heightMap is [z][x], contains world Y coordinate

        // Calculate slope for this position (once per column)
        const slope = this.calculateSlope(heightMap, x, z);
        const isSteepSlope = slope >= 3; // Steep if height difference is 2+ blocks

        // For each Y position in this chunk (including padding)
        for (
          let localY = 0;
          localY < CHUNK_SIZE_P;
          localY++
        ) {
          const worldY = chunkMinY + localY - 1; // Convert to world Y coordinate
          if (isBottomEdge && localY === 0) {
            continue; // Leave as air
          }
          // Define sea level (25% of world height)
          const seaLevel = WORLD_HEIGHT * 0.25;

          // Handle water generation first
          if (
            worldY <= seaLevel &&
            worldY > terrainHeight
          ) {
            // Fill air spaces below sea level with water
            ChunkHelpers.setVoxel(chunk, x, localY, z, {
              type: VoxelType.WATER,
            });
            continue;
          }

          // Skip if this position is above the terrain
          if (worldY > terrainHeight) {
            continue; // Leave as air
          }

          // Determine voxel type based on depth from surface, slope, and altitude
          let voxelType: VoxelType;
          const surfaceDepth = terrainHeight - worldY;

          // Calculate world coordinates for snow generation (must match height map coordinate calculation)
          const worldX = chunk.position.x + x - 1;
          const worldZ = chunk.position.z + z - 1;

          // Calculate elevation percentage for snow generation
          const elevationPercent = worldY / WORLD_HEIGHT;

          // Snow rules based on elevation
          let hasSnow = false;
          if (elevationPercent >= 0.96) {
            // 100% snow above 96% of world height
            hasSnow = true;
          } else if (elevationPercent >= 0.93) {
            // 100% snow above 93% of world height
            hasSnow =
              NoiseGenerator.calcPseudoRandomProbability(
                worldX,
                worldY,
                worldZ
              ) < 0.75;
          } else if (elevationPercent >= 0.9) {
            // 50% chance of snow between 90-95% of world height
            // Use deterministic pseudo-random based on world position for consistency
            hasSnow =
              NoiseGenerator.calcPseudoRandomProbability(
                worldX,
                worldY,
                worldZ
              ) < 0.5;
          }

          // Sand rules for low-altitude areas (deserts/beaches)
          let hasSand = false;
          if (
            elevationPercent < 0.26 &&
            surfaceDepth <= 3
          ) {
            // Sand in low-altitude areas for top 4 layers
            hasSand = true;
          } else if (
            elevationPercent < 0.28 &&
            surfaceDepth <= 3
          ) {
            // Sand in low-altitude areas for top 4 layers
            hasSand =
              NoiseGenerator.calcPseudoRandomProbability(
                worldX,
                worldY,
                worldZ
              ) < 0.75;
          } else if (
            elevationPercent < 0.3 &&
            surfaceDepth <= 3
          ) {
            // Sand in low-altitude areas for top 4 layers
            hasSand =
              NoiseGenerator.calcPseudoRandomProbability(
                worldX,
                worldY,
                worldZ
              ) < 0.5;
          }

          if (surfaceDepth === 0) {
            // Surface layer: Priority: Snow > Sand > Slope-based materials
            if (hasSnow) {
              voxelType = VoxelType.SNOW;
            } else if (hasSand) {
              voxelType = VoxelType.SAND;
            } else {
              voxelType = isSteepSlope
                ? VoxelType.STONE
                : VoxelType.GRASS;
            }
          } else if (surfaceDepth === 1) {
            // Second layer: Priority: Snow > Sand > Slope-based materials
            if (hasSnow) {
              voxelType = VoxelType.SNOW;
            } else if (hasSand) {
              voxelType = VoxelType.SAND;
            } else {
              voxelType = isSteepSlope
                ? VoxelType.STONE
                : VoxelType.GRASS;
            }
          } else if (surfaceDepth === 2) {
            // Third layer: Sand can still appear here
            if (hasSnow) {
              voxelType = VoxelType.SNOW;
            } else if (hasSand) {
              voxelType = VoxelType.SAND;
            } else {
              voxelType = VoxelType.DIRT;
            }
          } else if (surfaceDepth === 3) {
            // Fourth layer: Sand can still appear here
            if (hasSnow) {
              voxelType = VoxelType.SNOW;
            } else if (hasSand) {
              voxelType = VoxelType.SAND;
            } else {
              voxelType = VoxelType.DIRT;
            }
          } else if (surfaceDepth <= 6) {
            // Deeper layers: stone
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

  public static calcPseudoRandomProbability(
    x: number,
    y: number,
    z: number
  ) {
    const randomSeed =
      (x * 2785255) ^
      (y * 83492791) ^
      (z * 354453) ^
      (WORLD_SEED * 858584);
    return Math.abs(Math.sin(randomSeed)) % 1;
  }
}
