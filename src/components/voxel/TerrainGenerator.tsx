import { PerlinNoise } from "./noise";
import { VoxelType } from "./types";

export interface TerrainConfig {
  seed: number;
  seaLevel: number;
  heightBias: number; // Overall height offset to reduce water coverage

  // Continental layer (very large scale features)
  continental: {
    scale: number;
    amplitude: number;
    influence: number;
    bias: number; // Bias toward positive values for more landmasses
  };

  // Regional layer (medium scale features)
  regional: {
    scale: number;
    amplitude: number;
    influence: number;
  };

  // Local layer (fine detail)
  local: {
    scale: number;
    amplitude: number;
    influence: number;
  };

  // Erosion layer (creates valleys and cliffs)
  erosion: {
    scale: number;
    threshold: number;
    intensity: number;
    blendDistance: number; // Distance over which erosion blends from full to none
  };
}

export class TerrainGenerator {
  private continentalNoise: PerlinNoise;
  private regionalNoise: PerlinNoise;
  private localNoise: PerlinNoise;
  private erosionNoise: PerlinNoise;
  private config: TerrainConfig;

  constructor(config: TerrainConfig) {
    this.config = config;

    // Use different seeds for each noise layer
    this.continentalNoise = new PerlinNoise(config.seed);
    this.regionalNoise = new PerlinNoise(
      config.seed + 1000
    );
    this.localNoise = new PerlinNoise(config.seed + 2000);
    this.erosionNoise = new PerlinNoise(config.seed + 3000);
  }

  // Generate height at world coordinates
  getHeightAt(worldX: number, worldZ: number): number {
    // Continental layer - large scale landmasses with bias toward positive values
    const continentalHeight =
      (this.continentalNoise.octaveNoise2D(
        worldX * this.config.continental.scale,
        worldZ * this.config.continental.scale,
        6, // More octaves for smoother large features
        0.6
      ) +
        this.config.continental.bias) *
      this.config.continental.amplitude;

    // Regional layer - hills, valleys, plateaus
    const regionalHeight =
      this.regionalNoise.octaveNoise2D(
        worldX * this.config.regional.scale,
        worldZ * this.config.regional.scale,
        4,
        0.5
      ) * this.config.regional.amplitude;

    // Local layer - surface detail and roughness
    const localHeight =
      this.localNoise.octaveNoise2D(
        worldX * this.config.local.scale,
        worldZ * this.config.local.scale,
        3,
        0.4
      ) * this.config.local.amplitude;

    // Erosion factor - creates dramatic valleys and cliffs
    const erosionFactor = this.erosionNoise.octaveNoise2D(
      worldX * this.config.erosion.scale,
      worldZ * this.config.erosion.scale,
      2,
      0.3
    );

    // Apply gradient-based erosion for smoother cliff transitions
    let erosionMultiplier = 1.0;

    if (erosionFactor < this.config.erosion.threshold) {
      // Full erosion in deep valleys
      erosionMultiplier =
        1.0 - this.config.erosion.intensity;
    } else if (
      erosionFactor <
      this.config.erosion.threshold +
        this.config.erosion.blendDistance
    ) {
      // Gradient transition zone - smooth falloff from full erosion to no erosion
      const blendFactor =
        (erosionFactor - this.config.erosion.threshold) /
        this.config.erosion.blendDistance;
      const smoothBlend =
        blendFactor * blendFactor * (3 - 2 * blendFactor); // Smooth hermite interpolation
      erosionMultiplier =
        1.0 -
        this.config.erosion.intensity * (1.0 - smoothBlend);
    }
    // Above threshold + blendDistance: no erosion (erosionMultiplier = 1.0)

    // Apply exponential scaling to continental height for more dramatic peaks
    const scaledContinentalHeight =
      continentalHeight > 0
        ? Math.pow(Math.abs(continentalHeight), 1.3) *
          Math.sign(continentalHeight)
        : continentalHeight;

    // Combine all layers with their influence weights
    const combinedHeight =
      scaledContinentalHeight *
        this.config.continental.influence +
      regionalHeight * this.config.regional.influence +
      localHeight * this.config.local.influence;

    // Apply erosion, add sea level, and apply height bias to reduce water coverage
    const finalHeight =
      this.config.seaLevel +
      combinedHeight * erosionMultiplier +
      this.config.heightBias;

    return Math.floor(finalHeight);
  }

  // Determine biome based on height and continental noise
  getBiomeAt(
    worldX: number,
    worldZ: number,
    height: number
  ): {
    surfaceType: VoxelType;
    subsurfaceType: VoxelType;
    stoneDepth: number;
  } {
    // Get continental value to determine general biome (with bias applied)
    const continentalValue =
      this.continentalNoise.octaveNoise2D(
        worldX * this.config.continental.scale,
        worldZ * this.config.continental.scale,
        3,
        0.6
      ) + this.config.continental.bias;

    // Ocean biome
    if (height <= this.config.seaLevel) {
      return {
        surfaceType: VoxelType.SAND,
        subsurfaceType: VoxelType.SAND,
        stoneDepth: 2,
      };
    }

    // Beach biome (just above sea level)
    if (height <= this.config.seaLevel + 5) {
      return {
        surfaceType: VoxelType.SAND,
        subsurfaceType: VoxelType.SAND,
        stoneDepth: 4,
      };
    }

    // High mountain biome (very high elevation)
    if (height > this.config.seaLevel + 45) {
      return {
        surfaceType: VoxelType.STONE,
        subsurfaceType: VoxelType.STONE,
        stoneDepth: 1,
      };
    }

    // Mountain foothills (medium-high elevation)
    if (height > this.config.seaLevel + 35) {
      return {
        surfaceType: VoxelType.STONE,
        subsurfaceType: VoxelType.DIRT,
        stoneDepth: 2,
      };
    }

    // Highland vs lowland based on continental noise and regional features
    const regionalValue = this.regionalNoise.octaveNoise2D(
      worldX * this.config.regional.scale,
      worldZ * this.config.regional.scale,
      2,
      0.5
    );

    // Varied terrain based on multiple noise layers
    if (continentalValue > 0.3 && regionalValue > 0.1) {
      // Rocky highland terrain
      return {
        surfaceType: VoxelType.STONE,
        subsurfaceType: VoxelType.DIRT,
        stoneDepth: 3,
      };
    } else if (continentalValue > 0.1) {
      // Highland grassland
      return {
        surfaceType: VoxelType.GRASS,
        subsurfaceType: VoxelType.DIRT,
        stoneDepth: 5,
      };
    } else if (continentalValue < -0.2) {
      // Lowland with more sand
      return {
        surfaceType: VoxelType.SAND,
        subsurfaceType: VoxelType.DIRT,
        stoneDepth: 8,
      };
    } else {
      // Standard plains
      return {
        surfaceType: VoxelType.GRASS,
        subsurfaceType: VoxelType.DIRT,
        stoneDepth: 6,
      };
    }
  }

  // Generate voxel type at specific world coordinates
  getVoxelAt(
    worldX: number,
    worldY: number,
    worldZ: number
  ): VoxelType {
    const terrainHeight = this.getHeightAt(worldX, worldZ);

    // Air above terrain
    if (worldY >= terrainHeight) {
      // Water at sea level
      if (
        worldY < this.config.seaLevel &&
        worldY >= terrainHeight
      ) {
        return VoxelType.WATER;
      }
      return VoxelType.AIR;
    }

    // Get biome information
    const biome = this.getBiomeAt(
      worldX,
      worldZ,
      terrainHeight
    );

    // Surface layer
    if (worldY === terrainHeight - 1) {
      return biome.surfaceType;
    }

    // Subsurface layers
    if (worldY >= terrainHeight - biome.stoneDepth) {
      return biome.subsurfaceType;
    }

    // Deep stone
    return VoxelType.STONE;
  }

  // Sample voxels for LOD with surface material priority
  sampleVoxelArea(startX: number, startY: number, startZ: number, scale: number): VoxelType {
    const voxelCounts = new Map<VoxelType, number>();
    const surfaceMaterials = new Map<VoxelType, number>();
    let totalSolid = 0;

    // Sample the area, giving priority to surface materials
    for (let x = startX; x < startX + scale; x++) {
      for (let y = startY; y < startY + scale; y++) {
        for (let z = startZ; z < startZ + scale; z++) {
          const voxelType = this.getVoxelAt(x, y, z);
          
          if (voxelType !== VoxelType.AIR) {
            totalSolid++;
            voxelCounts.set(voxelType, (voxelCounts.get(voxelType) || 0) + 1);
            
            // Check if this is a surface voxel (has air above it)
            const voxelAbove = this.getVoxelAt(x, y + 1, z);
            if (voxelAbove === VoxelType.AIR || voxelAbove === VoxelType.WATER) {
              surfaceMaterials.set(voxelType, (surfaceMaterials.get(voxelType) || 0) + 1);
            }
          }
        }
      }
    }

    // If less than 50% of the area is solid, return AIR
    const totalVoxels = scale * scale * scale;
    if (totalSolid < totalVoxels * 0.5) {
      return VoxelType.AIR;
    }

    // Prioritize surface materials if they exist
    if (surfaceMaterials.size > 0) {
      let mostCommonSurfaceType = VoxelType.GRASS;
      let maxSurfaceCount = 0;
      for (const [type, count] of surfaceMaterials) {
        if (count > maxSurfaceCount) {
          maxSurfaceCount = count;
          mostCommonSurfaceType = type;
        }
      }
      return mostCommonSurfaceType;
    }

    // Return the most common solid voxel type
    let mostCommonType = VoxelType.STONE;
    let maxCount = 0;
    for (const [type, count] of voxelCounts) {
      if (count > maxCount) {
        maxCount = count;
        mostCommonType = type;
      }
    }

    return mostCommonType;
  }
}

// Extreme terrain configuration for full 100-block height utilization with reduced water coverage
export const DEFAULT_TERRAIN_CONFIG: TerrainConfig = {
  seed: 6969,
  seaLevel: 15, // Lower sea level for maximum height range
  heightBias: 6, // Push terrain upward to reduce water coverage

  continental: {
    scale: 0.0005, // Larger continental features
    amplitude: 70, // Dramatically increased amplitude
    influence: 0.8, // Overwhelming influence for extreme elevation
    bias: 0.2, // Bias toward positive values for more landmasses
  },

  regional: {
    scale: 0.005, // Larger regional features
    amplitude: 200, // Reduced to prevent interference
    influence: 0.12, // Minimal influence
  },

  local: {
    scale: 0.045, // Detail layer
    amplitude: 90, // Minimal surface variation
    influence: 0.02, // Very minimal influence
  },

  erosion: {
    scale: 0.01, // Coarser erosion pattern
    threshold: -0.3, // More selective erosion (only very low areas)
    intensity: 0.2, // Gentler erosion to preserve more land
    blendDistance: 0.1, // Smooth transition distance for natural cliff edges
  },
};
