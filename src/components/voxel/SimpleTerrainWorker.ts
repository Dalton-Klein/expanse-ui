// SimpleTerrainWorker.ts - Simplified worker implementation without module imports

export function createTerrainWorker() {
  const workerCode = `
// Worker thread code as a string
const VoxelType = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  WATER: 5,
};

const LODLevel = {
  FULL: 1,
  MEDIUM: 2,
  LOW: 3
};

const CHUNK_SIZE = 16;
const CHUNK_HEIGHT = 100;

// Simple Perlin noise implementation
class WorkerPerlinNoise {
  constructor(seed = Math.random() * 1000) {
    this.permutation = [];
    for (let i = 0; i < 256; i++) {
      this.permutation[i] = i;
    }

    const random = this.seededRandom(seed);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [this.permutation[i], this.permutation[j]] = [
        this.permutation[j],
        this.permutation[i],
      ];
    }

    for (let i = 0; i < 256; i++) {
      this.permutation[256 + i] = this.permutation[i];
    }
  }

  seededRandom(seed) {
    return function () {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
  }

  fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  lerp(t, a, b) {
    return a + t * (b - a);
  }

  grad(hash, x, y) {
    const h = hash & 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  noise2D(x, y) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    const u = this.fade(x);
    const v = this.fade(y);
    const A = this.permutation[X] + Y;
    const B = this.permutation[X + 1] + Y;
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

  octaveNoise2D(x, y, octaves = 4, persistence = 0.5) {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += this.noise2D(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }

    return total / maxValue;
  }
}

// Simplified terrain generator
class WorkerTerrainGenerator {
  constructor(config) {
    this.config = config;
    this.continentalNoise = new WorkerPerlinNoise(config.seed);
    this.regionalNoise = new WorkerPerlinNoise(config.seed + 1000);
    this.localNoise = new WorkerPerlinNoise(config.seed + 2000);
    this.erosionNoise = new WorkerPerlinNoise(config.seed + 3000);
  }

  getHeightAt(worldX, worldZ) {
    const continentalHeight = (this.continentalNoise.octaveNoise2D(
      worldX * this.config.continental.scale,
      worldZ * this.config.continental.scale,
      6, 0.6
    ) + this.config.continental.bias) * this.config.continental.amplitude;

    const regionalHeight = this.regionalNoise.octaveNoise2D(
      worldX * this.config.regional.scale,
      worldZ * this.config.regional.scale,
      4, 0.5
    ) * this.config.regional.amplitude;

    const localHeight = this.localNoise.octaveNoise2D(
      worldX * this.config.local.scale,
      worldZ * this.config.local.scale,
      3, 0.4
    ) * this.config.local.amplitude;

    const erosionFactor = this.erosionNoise.octaveNoise2D(
      worldX * this.config.erosion.scale,
      worldZ * this.config.erosion.scale,
      2, 0.3
    );

    let erosionMultiplier = 1.0;
    if (erosionFactor < this.config.erosion.threshold) {
      erosionMultiplier = 1.0 - this.config.erosion.intensity;
    } else if (erosionFactor < this.config.erosion.threshold + this.config.erosion.blendDistance) {
      const blendFactor = (erosionFactor - this.config.erosion.threshold) / this.config.erosion.blendDistance;
      const smoothBlend = blendFactor * blendFactor * (3 - 2 * blendFactor);
      erosionMultiplier = 1.0 - this.config.erosion.intensity * (1.0 - smoothBlend);
    }

    const scaledContinentalHeight = continentalHeight > 0
      ? Math.pow(Math.abs(continentalHeight), 1.3) * Math.sign(continentalHeight)
      : continentalHeight;

    const combinedHeight = scaledContinentalHeight * this.config.continental.influence +
      regionalHeight * this.config.regional.influence +
      localHeight * this.config.local.influence;

    const finalHeight = this.config.seaLevel +
      combinedHeight * erosionMultiplier +
      this.config.heightBias;

    return Math.floor(finalHeight);
  }

  getVoxelAt(worldX, worldY, worldZ) {
    const terrainHeight = this.getHeightAt(worldX, worldZ);
    
    if (worldY >= terrainHeight) {
      if (worldY < this.config.seaLevel && worldY >= terrainHeight) {
        return VoxelType.WATER;
      }
      return VoxelType.AIR;
    }

    if (worldY === terrainHeight - 1) {
      if (terrainHeight > this.config.seaLevel + 45) return VoxelType.STONE;
      if (terrainHeight > this.config.seaLevel + 35) return VoxelType.STONE;
      if (terrainHeight <= this.config.seaLevel + 5) return VoxelType.SAND;
      return VoxelType.GRASS;
    }

    if (worldY >= terrainHeight - 5) {
      return VoxelType.DIRT;
    }

    return VoxelType.STONE;
  }

  sampleVoxelArea(startX, startY, startZ, scale) {
    const voxelCounts = new Map();
    const surfaceMaterials = new Map();
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

    // Fallback to most common solid voxel type
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

let terrainGenerator = null;

function generateChunkData(chunkX, chunkZ, lodLevel, lodScale) {
  if (!terrainGenerator) {
    throw new Error('Terrain generator not initialized');
  }

  const effectiveWidth = Math.ceil(CHUNK_SIZE / lodScale);
  const effectiveHeight = Math.ceil(CHUNK_HEIGHT / lodScale);
  const voxels = [];

  for (let x = 0; x < effectiveWidth; x++) {
    voxels[x] = [];
    for (let y = 0; y < effectiveHeight; y++) {
      voxels[x][y] = [];
      for (let z = 0; z < effectiveWidth; z++) {
        if (lodScale === 1) {
          const worldX = chunkX * CHUNK_SIZE + x;
          const worldZ = chunkZ * CHUNK_SIZE + z;
          const worldY = y;
          const voxelType = terrainGenerator.getVoxelAt(worldX, worldY, worldZ);
          voxels[x][y][z] = { type: voxelType };
        } else {
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

self.onmessage = function(event) {
  const { type, data } = event.data;

  switch (type) {
    case 'INIT_TERRAIN_GENERATOR':
      terrainGenerator = new WorkerTerrainGenerator(data.config);
      self.postMessage({ type: 'TERRAIN_GENERATOR_READY' });
      break;

    case 'GENERATE_CHUNK':
      if (!terrainGenerator) {
        self.postMessage({ type: 'ERROR', error: 'Terrain generator not initialized' });
        return;
      }

      const { chunkX, chunkZ, lodLevel, lodScale, requestId } = data;
      
      try {
        const startTime = performance.now();
        const voxelData = generateChunkData(chunkX, chunkZ, lodLevel, lodScale);
        const endTime = performance.now();

        self.postMessage({
          type: 'CHUNK_GENERATED',
          data: { chunkX, chunkZ, lodLevel, lodScale, voxelData, requestId, generationTime: endTime - startTime }
        });
      } catch (error) {
        self.postMessage({
          type: 'ERROR',
          error: error.message || 'Unknown error',
          requestId
        });
      }
      break;

    default:
      self.postMessage({ type: 'ERROR', error: 'Unknown message type: ' + type });
  }
};

self.postMessage({ type: 'WORKER_READY' });
`;

  const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(workerBlob));
}