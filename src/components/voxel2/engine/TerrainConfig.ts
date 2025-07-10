import {
  TerrainConfig,
  GenerationAlgorithm,
  DebugPattern,
  MeshingAlgorithm,
  LayeredNoiseConfig,
  NoiseLayer,
} from "../types";

// Default terrain configuration with sensible values for development and production
export const DEFAULT_TERRAIN_CONFIG: TerrainConfig = {
  // Core render distance - start conservative for debugging
  renderDistance: 1, // chunks
  worldHeight: 120, // Ideally a multiple of chunk size for simplicity
  // Fundamental chunk configuration
  chunkSize: 30, // voxels per chunk side
  voxelSize: 1, // world units per voxel

  // LOD system configuration
  lod: {
    enabled: false, // disabled initially for debugging
    level1Distance: 4, // chunks - transition to LOD 1
    level2Distance: 6, // chunks - transition to LOD 2
  },

  // Greedy meshing configuration
  greedyMeshing: {
    enabled: true, // start with greedy meshing enabled
    algorithm: MeshingAlgorithm.BINARY_GREEDY, // use binary greedy by default
    crossChunkCulling: true, // enable cross-chunk face culling
  },

  // Terrain generation configuration
  generation: {
    algorithm: GenerationAlgorithm.NOISE, // start with debug patterns
    debugPattern: DebugPattern.TINY, // default to tiny pattern
    seed: 12345, // consistent seed for testing
    noise: {
      continental: {
        enabled: true,
        scale: 0.002, // Very large features for landmasses
        amplitude: 130, // Major elevation changes
        octaves: 2, // Simple, broad shapes
        persistence: 0.5,
      },
      regional: {
        enabled: true,
        scale: 0.011, // Medium features for hills and valleys
        amplitude: 80, // Moderate elevation changes
        octaves: 3, // More detail than continental
        persistence: 0.6,
      },
      local: {
        enabled: true,
        scale: 0.08, // Fine details for surface roughness
        amplitude: 5, // Small elevation changes
        octaves: 2, // High detail
        persistence: 0.4,
      },
      baseHeight: 10, // minimum terrain height
      mapSize: 1, // default to single chunk (1x1 grid)
    },
  },

  // Performance configuration
  performance: {
    maxChunksPerFrame: 2, // conservative chunk processing limit
    enableWorkers: false, // disabled initially for easier debugging
  },

  // Debug configuration
  debug: {
    showChunkBorders: false, // chunk border visualization
    showLODColors: false, // LOD level color coding
    enableNaiveComparison: true, // allow naive vs optimized comparison
  },
};

// Production-optimized terrain configuration
export const PRODUCTION_TERRAIN_CONFIG: TerrainConfig = {
  renderDistance: 16,
  chunkSize: 30,
  worldHeight: 240, // should be a multiple of chunk size for simplicity
  voxelSize: 1,

  lod: {
    enabled: true,
    level1Distance: 8,
    level2Distance: 12,
  },

  greedyMeshing: {
    enabled: true,
    algorithm: MeshingAlgorithm.BINARY_GREEDY,
    crossChunkCulling: true,
  },

  generation: {
    algorithm: GenerationAlgorithm.NOISE,
    debugPattern: DebugPattern.FLAT, // unused in noise mode
    seed: Math.floor(Math.random() * 1000000),
    noise: {
      continental: {
        enabled: true,
        scale: 0.0005, // Massive landmasses for production
        amplitude: 80, // Major continental features
        octaves: 2, // Simple, broad shapes
        persistence: 0.5,
      },
      regional: {
        enabled: true,
        scale: 0.005, // Mountain ranges and valleys
        amplitude: 40, // Significant elevation changes
        octaves: 4, // More detail for production
        persistence: 0.65,
      },
      local: {
        enabled: true,
        scale: 0.03, // Surface detail
        amplitude: 12, // Moderate surface variation
        octaves: 6, // High detail for production
        persistence: 0.45,
      },
      baseHeight: 10, // higher base level
      mapSize: 10, // larger map for production
    },
  },

  performance: {
    maxChunksPerFrame: 4,
    enableWorkers: true,
  },

  debug: {
    showChunkBorders: false,
    showLODColors: false,
    enableNaiveComparison: false,
  },
};

// Utility functions for terrain configuration management

/**
 * Validates a terrain configuration for consistency and reasonable values
 */
export function validateTerrainConfig(
  config: TerrainConfig
): string[] {
  const errors: string[] = [];

  // Validate render distance
  if (
    config.renderDistance < 1 ||
    config.renderDistance > 32
  ) {
    errors.push(
      "Render distance must be between 1 and 32 chunks"
    );
  }

  // Validate LOD distances
  if (config.lod.enabled) {
    if (
      config.lod.level1Distance >= config.lod.level2Distance
    ) {
      errors.push(
        "LOD level 1 distance must be less than level 2 distance"
      );
    }
    if (
      config.lod.level2Distance >= config.renderDistance
    ) {
      errors.push(
        "LOD level 2 distance must be less than render distance"
      );
    }
  }

  // Validate performance settings
  if (
    config.performance.maxChunksPerFrame < 1 ||
    config.performance.maxChunksPerFrame > 10
  ) {
    errors.push(
      "Max chunks per frame must be between 1 and 10"
    );
  }

  return errors;
}

/**
 * Creates a deep copy of a terrain configuration
 */
export function cloneTerrainConfig(
  config: TerrainConfig
): TerrainConfig {
  return {
    renderDistance: config.renderDistance,
    worldHeight: config.worldHeight,
    chunkSize: config.chunkSize,
    voxelSize: config.voxelSize,
    lod: { ...config.lod },
    greedyMeshing: { ...config.greedyMeshing },
    generation: { ...config.generation },
    performance: { ...config.performance },
    debug: { ...config.debug },
  };
}

/**
 * Merges partial terrain configuration updates with existing configuration
 */
export function updateTerrainConfig(
  current: TerrainConfig,
  updates: Partial<TerrainConfig>
): TerrainConfig {
  return {
    ...current,
    ...updates,
    // Handle nested objects properly
    lod: updates.lod
      ? { ...current.lod, ...updates.lod }
      : current.lod,
    greedyMeshing: updates.greedyMeshing
      ? {
          ...current.greedyMeshing,
          ...updates.greedyMeshing,
        }
      : current.greedyMeshing,
    generation: updates.generation
      ? {
          ...current.generation,
          ...updates.generation,
          noise: updates.generation.noise
            ? {
                ...current.generation.noise,
                ...updates.generation.noise,
              }
            : current.generation.noise,
        }
      : current.generation,
    performance: updates.performance
      ? { ...current.performance, ...updates.performance }
      : current.performance,
    debug: updates.debug
      ? { ...current.debug, ...updates.debug }
      : current.debug,
  };
}

/**
 * Gets a human-readable description of the current terrain configuration
 */
export function getTerrainConfigSummary(
  config: TerrainConfig
): string {
  const parts = [
    `Render Distance: ${config.renderDistance} chunks`,
    `LOD: ${config.lod.enabled ? "Enabled" : "Disabled"}`,
    `Greedy Meshing: ${
      config.greedyMeshing.enabled ? "Enabled" : "Disabled"
    }`,
    `Generation: ${config.generation.algorithm}`,
    `Workers: ${
      config.performance.enableWorkers
        ? "Enabled"
        : "Disabled"
    }`,
  ];

  if (
    config.generation.algorithm ===
    GenerationAlgorithm.DEBUG_PATTERN
  ) {
    parts.push(
      `Pattern: ${config.generation.debugPattern}`
    );
  }

  return parts.join(", ");
}

// Export performance constants for optimized access
// These are derived from the default config for compile-time optimization
export const WORLD_SEED =
  DEFAULT_TERRAIN_CONFIG.generation.seed;
export const CHUNK_SIZE = DEFAULT_TERRAIN_CONFIG.chunkSize;
export const VOXEL_SIZE = DEFAULT_TERRAIN_CONFIG.voxelSize;
export const WORLD_HEIGHT =
  DEFAULT_TERRAIN_CONFIG.worldHeight;
