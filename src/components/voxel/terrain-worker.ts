// terrain-worker.ts - Web Worker for off-main-thread terrain generation
/* eslint-disable no-restricted-globals */

import { VoxelType, CHUNK_SIZE, CHUNK_HEIGHT, LODLevel } from './types';

// Simple Perlin noise implementation for worker thread
class WorkerPerlinNoise {
  private permutation: number[];

  constructor(seed: number = Math.random() * 1000) {
    // Create permutation table
    this.permutation = [];
    for (let i = 0; i < 256; i++) {
      this.permutation[i] = i;
    }

    // Shuffle based on seed
    const random = this.seededRandom(seed);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [this.permutation[i], this.permutation[j]] = [
        this.permutation[j],
        this.permutation[i],
      ];
    }

    // Duplicate permutation table
    for (let i = 0; i < 256; i++) {
      this.permutation[256 + i] = this.permutation[i];
    }
  }

  private seededRandom(seed: number) {
    return function () {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(t: number, a: number, b: number): number {
    return a + t * (b - a);
  }

  private grad(hash: number, x: number, y: number): number {
    const h = hash & 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return (
      ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v)
    );
  }

  noise2D(x: number, y: number): number {
    // Find unit square that contains point
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;

    // Find relative x, y of point in square
    x -= Math.floor(x);
    y -= Math.floor(y);

    // Compute fade curves for each of x, y
    const u = this.fade(x);
    const v = this.fade(y);

    // Hash coordinates of the 4 square corners
    const A = this.permutation[X] + Y;
    const B = this.permutation[X + 1] + Y;

    // And add blended results from 4 corners of square
    return this.lerp(
      v,
      this.lerp(
        u,
        this.grad(this.permutation[A], x, y),
        this.grad(this.permutation[B], x - 1, y)
      ),
      this.lerp(
        u,
        this.grad(this.permutation[A + 1], x, y - 1),
        this.grad(this.permutation[B + 1], x - 1, y - 1)
      )
    );
  }

  // Octave noise for more natural terrain
  octaveNoise2D(
    x: number,
    y: number,
    octaves: number = 4,
    persistence: number = 0.5
  ): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total +=
        this.noise2D(x * frequency, y * frequency) *
        amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }

    return total / maxValue;
  }
}

// Worker-specific terrain generator
class WorkerTerrainGenerator {
  private continentalNoise: WorkerPerlinNoise;
  private regionalNoise: WorkerPerlinNoise;
  private localNoise: WorkerPerlinNoise;
  private erosionNoise: WorkerPerlinNoise;
  private config: any;

  constructor(config: any) {
    this.config = config;
    
    // Use different seeds for each noise layer
    this.continentalNoise = new WorkerPerlinNoise(config.seed);
    this.regionalNoise = new WorkerPerlinNoise(config.seed + 1000);
    this.localNoise = new WorkerPerlinNoise(config.seed + 2000);
    this.erosionNoise = new WorkerPerlinNoise(config.seed + 3000);
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
  getVoxelAt(worldX: number, worldY: number, worldZ: number): VoxelType {
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


// Global terrain generator instance
let terrainGenerator: WorkerTerrainGenerator | null = null;

// Message handler for the worker
self.onmessage = function(event) {
  const { type, data } = event.data;

  switch (type) {
    case 'INIT_TERRAIN_GENERATOR':
      terrainGenerator = new WorkerTerrainGenerator(data.config);
      self.postMessage({ type: 'TERRAIN_GENERATOR_READY' });
      break;

    case 'GENERATE_CHUNK':
      if (!terrainGenerator) {
        self.postMessage({ 
          type: 'ERROR', 
          error: 'Terrain generator not initialized' 
        });
        return;
      }

      const { chunkX, chunkZ, lodLevel, lodScale, requestId } = data;
      
      try {
        const startTime = performance.now();
        const voxelData = generateChunkData(chunkX, chunkZ, lodLevel, lodScale);
        const endTime = performance.now();

        self.postMessage({
          type: 'CHUNK_GENERATED',
          data: {
            chunkX,
            chunkZ,
            lodLevel,
            lodScale,
            voxelData,
            requestId,
            generationTime: endTime - startTime
          }
        });
      } catch (error) {
        self.postMessage({
          type: 'ERROR',
          error: error instanceof Error ? error.message : 'Unknown error',
          requestId
        });
      }
      break;

    default:
      self.postMessage({ 
        type: 'ERROR', 
        error: `Unknown message type: ${type}` 
      });
  }
};

// Generate chunk data based on LOD level
function generateChunkData(chunkX: number, chunkZ: number, lodLevel: LODLevel, lodScale: number) {
  if (!terrainGenerator) {
    throw new Error('Terrain generator not initialized');
  }

  // Calculate effective chunk dimensions based on LOD scale
  const effectiveWidth = Math.ceil(CHUNK_SIZE / lodScale);
  const effectiveHeight = Math.ceil(CHUNK_HEIGHT / lodScale);
  
  const voxels: any = [];

  for (let x = 0; x < effectiveWidth; x++) {
    voxels[x] = [];
    for (let y = 0; y < effectiveHeight; y++) {
      voxels[x][y] = [];
      for (let z = 0; z < effectiveWidth; z++) {
        if (lodScale === 1) {
          // Full detail - generate normally
          const worldX = chunkX * CHUNK_SIZE + x;
          const worldZ = chunkZ * CHUNK_SIZE + z;
          const worldY = y;
          const voxelType = terrainGenerator.getVoxelAt(worldX, worldY, worldZ);
          voxels[x][y][z] = { type: voxelType };
        } else {
          // LOD - sample an area and get representative voxel
          const worldX = chunkX * CHUNK_SIZE + (x * lodScale);
          const worldZ = chunkZ * CHUNK_SIZE + (z * lodScale);
          const worldY = y * lodScale;
          
          const voxelType = terrainGenerator.sampleVoxelArea(worldX, worldY, worldZ, lodScale);
          voxels[x][y][z] = { type: voxelType };
        }
      }
    }
  }

  return voxels;
}

// Ready signal
self.postMessage({ type: 'WORKER_READY' });