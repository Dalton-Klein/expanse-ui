import {
  TerrainConfig,
  GenerationAlgorithm,
  DebugPattern,
  MeshingAlgorithm,
  NoiseConfig,
} from "../types";

// Default terrain configuration with sensible values for development and production
export const DEFAULT_TERRAIN_CONFIG: TerrainConfig = {
  // Core render distance - start conservative for debugging
  renderDistance: 1, // chunks
  worldHeight: 30, // Ideally a multiple of chunk size for simplicity
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
    algorithm: GenerationAlgorithm.DEBUG_PATTERN, // start with debug patterns
    debugPattern: DebugPattern.TINY, // default to tiny pattern
    seed: 12345, // consistent seed for testing
    noise: {
      scale: 0.02, // frequency of the noise
      amplitude: 10, // height variation
      baseHeight: 5, // minimum terrain height
      octaves: 4, // number of noise layers
      persistence: 0.5, // amplitude decay between octaves
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
      scale: 0.015, // larger features for production
      amplitude: 15, // more dramatic height variation
      baseHeight: 8, // higher base level
      octaves: 6, // more detail layers
      persistence: 0.6, // slightly more persistent detail
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
            ? { ...current.generation.noise, ...updates.generation.noise }
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
export const CHUNK_SIZE = DEFAULT_TERRAIN_CONFIG.chunkSize;
export const VOXEL_SIZE = DEFAULT_TERRAIN_CONFIG.voxelSize;
