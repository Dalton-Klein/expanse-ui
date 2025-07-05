import {
  useMemo,
  useCallback,
  useState,
  useEffect,
} from "react";
import {
  ChunkData,
  VoxelType,
  CHUNK_SIZE,
  CHUNK_HEIGHT,
  LODLevel,
  LODConfig,
} from "./types";
import {
  TerrainGenerator,
  DEFAULT_TERRAIN_CONFIG,
} from "./TerrainGenerator";

interface ChunkKey {
  x: number;
  z: number;
}

interface ChunkManagerConfig {
  renderDistance: number; // How many chunks to render in each direction
  lodConfig: LODConfig; // LOD configuration
}

// Helper to create chunk key string
const getChunkKey = (x: number, z: number): string =>
  `${x},${z}`;

// Helper to convert world position to chunk coordinates
export const worldToChunk = (
  worldX: number,
  worldZ: number
): ChunkKey => ({
  x: Math.floor(worldX / CHUNK_SIZE),
  z: Math.floor(worldZ / CHUNK_SIZE),
});

// Helper to calculate distance between two chunk coordinates
const chunkDistance = (
  chunk1: ChunkKey,
  chunk2: ChunkKey
): number => {
  const dx = chunk1.x - chunk2.x;
  const dz = chunk1.z - chunk2.z;
  return Math.sqrt(dx * dx + dz * dz); // Euclidean distance (circular pattern)
};

export class ChunkManager {
  private loadedChunks = new Map<string, ChunkData>();
  private terrainGenerator: TerrainGenerator;
  private config: ChunkManagerConfig;
  private lastLODUpdate = new Map<string, number>(); // Track last LOD update time per chunk
  private worker: Worker | null = null;
  private pendingChunks = new Map<string, number>(); // Track chunks being generated
  private pendingTimestamps = new Map<string, number>(); // Track when chunks were requested
  private requestIdCounter = 0;

  // Throttling properties
  private maxChunksPerFrame = 3; // Maximum chunks to generate per frame
  private frameTimeTarget = 16; // Target frame time in ms (60 FPS)
  private chunkQueue: Array<{
    chunkPos: ChunkKey;
    centerChunk: ChunkKey;
    priority: number;
  }> = [];
  private lastFrameTime = performance.now();
  private frameGenCount = 0;
  private criticalDistanceLogged = false;

  constructor(config: ChunkManagerConfig) {
    // Ensure minimum render distance of 5
    this.config = {
      ...config,
      renderDistance: Math.max(5, config.renderDistance)
    };
    this.terrainGenerator = new TerrainGenerator(
      DEFAULT_TERRAIN_CONFIG
    );
    this.initializeWorker();
  }

  private initializeWorker() {
    try {
      // Import SimpleTerrainWorker and create worker
      import("./SimpleTerrainWorker")
        .then(({ createTerrainWorker }) => {
          this.worker = createTerrainWorker();

          this.worker.onmessage =
            this.handleWorkerMessage.bind(this);
          this.worker.onerror =
            this.handleWorkerError.bind(this);

          // Initialize the worker with terrain configuration
          this.worker.postMessage({
            type: "INIT_TERRAIN_GENERATOR",
            data: {
              config: DEFAULT_TERRAIN_CONFIG,
            },
          });

          // Worker initialized silently
        })
        .catch((error) => {
          console.warn(
            "Failed to initialize terrain worker, falling back to main thread:",
            error
          );
          this.worker = null;
        });
    } catch (error) {
      console.warn(
        "Failed to initialize terrain worker, falling back to main thread:",
        error
      );
      this.worker = null;
    }
  }

  private handleWorkerMessage(event: MessageEvent) {
    const { type, data, error } = event.data;

    switch (type) {
      case "WORKER_READY":
        // Worker ready silently
        break;

      case "TERRAIN_GENERATOR_READY":
        // Terrain generator ready silently
        break;

      case "CHUNK_GENERATED":
        this.handleChunkGenerated(data);
        break;

      case "ERROR":
        console.error("Terrain worker error:", error);
        if (data?.requestId) {
          this.pendingChunks.delete(
            `${data.chunkX},${data.chunkZ}`
          );
        }
        break;

      default:
        console.warn("Unknown worker message type:", type);
    }
  }

  private handleWorkerError(error: ErrorEvent) {
    console.error("Terrain worker error:", error);
  }

  private handleChunkGenerated(data: any) {
    const {
      chunkX,
      chunkZ,
      lodLevel,
      lodScale,
      voxelData,
      requestId,
      generationTime,
    } = data;
    const key = getChunkKey(chunkX, chunkZ);

    // Worker generation completed silently

    // Remove from pending chunks
    this.pendingChunks.delete(key);
    this.pendingTimestamps.delete(key);

    // Create chunk data
    const chunkData: ChunkData = {
      position: [chunkX, 0, chunkZ] as [
        number,
        number,
        number
      ],
      voxels: voxelData,
      lodLevel: lodLevel,
      lodScale: lodScale,
    };

    // Add to loaded chunks
    this.loadedChunks.set(key, chunkData);
  }

  // Determine LOD level based on distance from center (with optional current LOD for hysteresis)
  private getLODLevel(
    chunkPos: ChunkKey,
    centerChunk: ChunkKey,
    currentLOD?: LODLevel
  ): { level: LODLevel; scale: number } {
    const distance = chunkDistance(chunkPos, centerChunk);
    const { lodConfig } = this.config;
    const hysteresis = lodConfig.hysteresis || 1.5;

    // If we have a current LOD, apply hysteresis to prevent flickering
    if (currentLOD) {
      // For upgrading LOD (better quality), use normal thresholds
      // For downgrading LOD (worse quality), add hysteresis buffer

      if (currentLOD === LODLevel.FULL) {
        // Currently full detail - only downgrade if significantly beyond threshold
        if (
          distance <=
          lodConfig.level1Distance + hysteresis
        ) {
          return { level: LODLevel.FULL, scale: 1 };
        } else if (
          distance <=
          lodConfig.level2Distance + hysteresis
        ) {
          return {
            level: LODLevel.MEDIUM,
            scale: lodConfig.level1Scale,
          };
        } else {
          return {
            level: LODLevel.LOW,
            scale: lodConfig.level2Scale,
          };
        }
      } else if (currentLOD === LODLevel.MEDIUM) {
        // Currently medium detail
        if (distance <= lodConfig.level1Distance) {
          return { level: LODLevel.FULL, scale: 1 }; // Upgrade to full
        } else if (
          distance <=
          lodConfig.level2Distance + hysteresis
        ) {
          return {
            level: LODLevel.MEDIUM,
            scale: lodConfig.level1Scale,
          }; // Stay medium
        } else {
          return {
            level: LODLevel.LOW,
            scale: lodConfig.level2Scale,
          }; // Downgrade to low
        }
      } else {
        // Currently LOW
        // Currently low detail
        if (distance <= lodConfig.level1Distance) {
          return { level: LODLevel.FULL, scale: 1 }; // Upgrade to full
        } else if (distance <= lodConfig.level2Distance) {
          return {
            level: LODLevel.MEDIUM,
            scale: lodConfig.level1Scale,
          }; // Upgrade to medium
        } else {
          return {
            level: LODLevel.LOW,
            scale: lodConfig.level2Scale,
          }; // Stay low
        }
      }
    }

    // No current LOD - use normal thresholds
    if (distance <= lodConfig.level1Distance) {
      return { level: LODLevel.FULL, scale: 1 };
    } else if (distance <= lodConfig.level2Distance) {
      return {
        level: LODLevel.MEDIUM,
        scale: lodConfig.level1Scale,
      };
    } else {
      return {
        level: LODLevel.LOW,
        scale: lodConfig.level2Scale,
      };
    }
  }

  // Sample voxels for LOD with surface material priority
  private sampleVoxelArea(
    startX: number,
    startY: number,
    startZ: number,
    scale: number
  ): VoxelType {
    const voxelCounts = new Map<VoxelType, number>();
    const surfaceMaterials = new Map<VoxelType, number>();
    let totalSolid = 0;

    // Sample the area, giving priority to surface materials
    for (let x = startX; x < startX + scale; x++) {
      for (let y = startY; y < startY + scale; y++) {
        for (let z = startZ; z < startZ + scale; z++) {
          const voxelType =
            this.terrainGenerator.getVoxelAt(x, y, z);

          if (voxelType !== VoxelType.AIR) {
            totalSolid++;
            voxelCounts.set(
              voxelType,
              (voxelCounts.get(voxelType) || 0) + 1
            );

            // Check if this is a surface voxel (has air above it)
            const voxelAbove =
              this.terrainGenerator.getVoxelAt(x, y + 1, z);
            if (
              voxelAbove === VoxelType.AIR ||
              voxelAbove === VoxelType.WATER
            ) {
              surfaceMaterials.set(
                voxelType,
                (surfaceMaterials.get(voxelType) || 0) + 1
              );
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

  // Generate chunk data for given chunk coordinates with LOD
  private generateChunk(
    chunkX: number,
    chunkZ: number,
    centerChunk: ChunkKey
  ): ChunkData | null {
    const { level, scale } = this.getLODLevel(
      { x: chunkX, z: chunkZ },
      centerChunk
    );
    const key = getChunkKey(chunkX, chunkZ);

    // Use worker thread for generation or return null if worker unavailable/busy
    if (this.worker) {
      // If chunk is already pending, return null to avoid duplicate requests
      if (this.pendingChunks.has(key)) {
        return null;
      }

      const requestId = ++this.requestIdCounter;
      this.pendingChunks.set(key, requestId);
      this.pendingTimestamps.set(key, Date.now());

      this.worker.postMessage({
        type: "GENERATE_CHUNK",
        data: {
          chunkX,
          chunkZ,
          lodLevel: level,
          lodScale: scale,
          requestId,
        },
      });

      // Dispatched to worker silently

      // Create intelligent placeholder that predicts surface materials
      // This ensures proper face culling at LOD boundaries while waiting for worker
      const placeholderChunk =
        this.createIntelligentPlaceholder(
          chunkX,
          chunkZ,
          level,
          scale,
          centerChunk
        );
      return placeholderChunk;
    }

    // Only fallback to main thread if worker initialization completely failed
    console.warn(
      `Worker not available for chunk [${chunkX}, ${chunkZ}], using main thread fallback`
    );
    return this.generateChunkMainThread(
      chunkX,
      chunkZ,
      level,
      scale
    );
  }

  // Create intelligent placeholder chunk that predicts surface materials for LOD border continuity
  private createIntelligentPlaceholder(
    chunkX: number,
    chunkZ: number,
    level: LODLevel,
    scale: number,
    centerChunk: ChunkKey
  ): ChunkData {
    const effectiveWidth = Math.ceil(CHUNK_SIZE / scale);
    const effectiveHeight = Math.ceil(CHUNK_HEIGHT / scale);

    // Creating placeholder silently

    const voxels: any = [];

    // Quick surface prediction using sparse sampling
    const surfaceHeights = new Map<string, number>();
    const surfaceMaterials = new Map<string, VoxelType>();

    // Sample terrain height at sparse grid points (every 4 voxels for speed)
    const sampleStep = Math.max(1, Math.floor(scale * 2));
    for (let x = 0; x < effectiveWidth; x += sampleStep) {
      for (let z = 0; z < effectiveWidth; z += sampleStep) {
        const worldX = chunkX * CHUNK_SIZE + x * scale;
        const worldZ = chunkZ * CHUNK_SIZE + z * scale;

        // Quick terrain height prediction
        const terrainHeight =
          this.terrainGenerator.getHeightAt(worldX, worldZ);
        const key = `${x},${z}`;
        surfaceHeights.set(key, terrainHeight);

        // Quick surface material prediction (much faster than full biome calculation)
        let surfaceMaterial = VoxelType.GRASS;
        if (terrainHeight <= 15) {
          // seaLevel
          surfaceMaterial = VoxelType.SAND;
        } else if (terrainHeight > 60) {
          // high elevation
          surfaceMaterial = VoxelType.STONE;
        }
        surfaceMaterials.set(key, surfaceMaterial);
      }
    }

    // Build placeholder chunk with interpolated surface data
    for (let x = 0; x < effectiveWidth; x++) {
      voxels[x] = [];
      for (let y = 0; y < effectiveHeight; y++) {
        voxels[x][y] = [];
        for (let z = 0; z < effectiveWidth; z++) {
          const worldY = y * scale;

          // Find nearest sampled height and material
          const nearestSampleX =
            Math.floor(x / sampleStep) * sampleStep;
          const nearestSampleZ =
            Math.floor(z / sampleStep) * sampleStep;
          const sampleKey = `${nearestSampleX},${nearestSampleZ}`;

          const terrainHeight =
            surfaceHeights.get(sampleKey) || 30;
          const surfaceMaterial =
            surfaceMaterials.get(sampleKey) ||
            VoxelType.GRASS;

          // Simple height-based voxel assignment
          if (worldY >= terrainHeight) {
            if (worldY < 15 && worldY >= terrainHeight) {
              // seaLevel water
              voxels[x][y][z] = { type: VoxelType.WATER };
            } else {
              voxels[x][y][z] = { type: VoxelType.AIR };
            }
          } else if (worldY === terrainHeight - 1) {
            voxels[x][y][z] = { type: surfaceMaterial };
          } else if (worldY >= terrainHeight - 3) {
            voxels[x][y][z] = { type: VoxelType.DIRT };
          } else {
            voxels[x][y][z] = { type: VoxelType.STONE };
          }
        }
      }
    }

    return {
      position: [chunkX, 0, chunkZ] as [
        number,
        number,
        number
      ],
      voxels,
      lodLevel: level,
      lodScale: scale,
    };
  }

  // Main thread chunk generation (fallback)
  private generateChunkMainThread(
    chunkX: number,
    chunkZ: number,
    level: LODLevel,
    scale: number
  ): ChunkData {
    // Calculate effective chunk dimensions based on LOD scale
    const effectiveWidth = Math.ceil(CHUNK_SIZE / scale);
    const effectiveHeight = Math.ceil(CHUNK_HEIGHT / scale);

    // Generating on main thread silently

    const voxels: any = [];

    for (let x = 0; x < effectiveWidth; x++) {
      voxels[x] = [];
      for (let y = 0; y < effectiveHeight; y++) {
        voxels[x][y] = [];
        for (let z = 0; z < effectiveWidth; z++) {
          if (scale === 1) {
            // Full detail - generate normally
            const worldX = chunkX * CHUNK_SIZE + x;
            const worldZ = chunkZ * CHUNK_SIZE + z;
            const worldY = y;
            const voxelType =
              this.terrainGenerator.getVoxelAt(
                worldX,
                worldY,
                worldZ
              );
            voxels[x][y][z] = { type: voxelType };
          } else {
            // LOD - sample an area and get representative voxel
            const worldX = chunkX * CHUNK_SIZE + x * scale;
            const worldZ = chunkZ * CHUNK_SIZE + z * scale;
            const worldY = y * scale;

            const voxelType = this.sampleVoxelArea(
              worldX,
              worldY,
              worldZ,
              scale
            );
            voxels[x][y][z] = { type: voxelType };
          }
        }
      }
    }

    return {
      position: [chunkX, 0, chunkZ] as [
        number,
        number,
        number
      ],
      voxels,
      lodLevel: level,
      lodScale: scale,
    };
  }

  // Get chunks that should be loaded around the given center chunk
  private getRequiredChunks(
    centerChunk: ChunkKey
  ): ChunkKey[] {
    const required: ChunkKey[] = [];
    const { renderDistance } = this.config;

    for (
      let x = centerChunk.x - renderDistance;
      x <= centerChunk.x + renderDistance;
      x++
    ) {
      for (
        let z = centerChunk.z - renderDistance;
        z <= centerChunk.z + renderDistance;
        z++
      ) {
        const chunkPos = { x, z };
        if (
          chunkDistance(centerChunk, chunkPos) <=
          renderDistance
        ) {
          required.push(chunkPos);
        }
      }
    }

    return required;
  }

  // Update loaded chunks based on camera position with throttled loading
  updateChunks(
    cameraWorldX: number,
    cameraWorldZ: number
  ): ChunkData[] {
    const centerChunk = worldToChunk(
      cameraWorldX,
      cameraWorldZ
    );
    const requiredChunks =
      this.getRequiredChunks(centerChunk);
    const requiredChunkKeys = new Set(
      requiredChunks.map((c) => getChunkKey(c.x, c.z))
    );

    // Reset frame generation count for new frame
    this.frameGenCount = 0;
    const currentTime = performance.now();
    const frameTimeDelta = currentTime - this.lastFrameTime;
    this.lastFrameTime = currentTime;

    // Auto-adjust max chunks per frame based on performance
    if (frameTimeDelta > this.frameTimeTarget * 1.5) {
      this.maxChunksPerFrame = Math.max(
        1,
        this.maxChunksPerFrame - 1
      );
      // Performance adjustment silently
    } else if (
      frameTimeDelta < this.frameTimeTarget * 0.8 &&
      this.maxChunksPerFrame < 5
    ) {
      this.maxChunksPerFrame = Math.min(
        5,
        this.maxChunksPerFrame + 1
      );
    }

    // Remove chunks that are too far away
    const toRemove: string[] = [];
    for (const [key, chunk] of this.loadedChunks) {
      if (!requiredChunkKeys.has(key)) {
        toRemove.push(key);
      }
    }
    toRemove.forEach((key) => {
      // Unloading chunk silently
      this.loadedChunks.delete(key);
      // Remove from pending if unloading
      this.pendingChunks.delete(key);
      this.pendingTimestamps.delete(key);
    });

    // Build priority queue for chunk loading/regeneration
    this.chunkQueue = [];

    for (const chunkPos of requiredChunks) {
      const key = getChunkKey(chunkPos.x, chunkPos.z);
      const existingChunk = this.loadedChunks.get(key);
      const distance = chunkDistance(chunkPos, centerChunk);
      const priority = distance; // Lower distance = higher priority (lower number)

      if (existingChunk) {
        // Check if LOD level needs to change (using hysteresis)
        const requiredLODWithHysteresis = this.getLODLevel(
          chunkPos,
          centerChunk,
          existingChunk.lodLevel
        );

        if (
          existingChunk.lodLevel !==
            requiredLODWithHysteresis.level ||
          existingChunk.lodScale !==
            requiredLODWithHysteresis.scale
        ) {
          // Throttle regeneration - don't update the same chunk too frequently
          const now = Date.now();
          const lastUpdate =
            this.lastLODUpdate.get(key) || 0;
          const minUpdateInterval = 2000; // Increased to 2 seconds for better performance

          if (now - lastUpdate > minUpdateInterval) {
            this.chunkQueue.push({
              chunkPos,
              centerChunk,
              priority: priority + 100,
            }); // Lower priority for regeneration
          }
        }
      } else if (!this.pendingChunks.has(key)) {
        // Queue new chunk for loading
        this.chunkQueue.push({
          chunkPos,
          centerChunk,
          priority,
        });
      }
    }

    // Sort queue by priority (closest chunks first)
    this.chunkQueue.sort((a, b) => a.priority - b.priority);

    // Process chunk queue with frame time budget
    this.processChunkQueue();

    // Ensure critical chunks (close to player) are always loaded
    this.ensureCriticalChunksLoaded(centerChunk);

    return Array.from(this.loadedChunks.values());
  }

  // Process chunk generation queue with throttling
  private processChunkQueue(): void {
    const frameStartTime = performance.now();

    while (
      this.chunkQueue.length > 0 &&
      this.frameGenCount < this.maxChunksPerFrame
    ) {
      const frameElapsed =
        performance.now() - frameStartTime;

      // Stop if we're approaching frame time budget
      if (frameElapsed > this.frameTimeTarget * 0.8) {
        // Frame time budget reached - deferring chunks silently
        break;
      }

      const queueItem = this.chunkQueue.shift()!;
      const { chunkPos, centerChunk } = queueItem;
      const key = getChunkKey(chunkPos.x, chunkPos.z);

      // Skip if chunk was loaded by worker while in queue
      if (
        this.loadedChunks.has(key) &&
        !this.shouldRegenerateChunk(chunkPos, centerChunk)
      ) {
        continue;
      }

      // Clean up stale pending chunks (older than 10 seconds)
      this.cleanupStalePendingChunks();

      const chunkData = this.generateChunk(
        chunkPos.x,
        chunkPos.z,
        centerChunk
      );
      if (chunkData) {
        this.loadedChunks.set(key, chunkData);
        this.frameGenCount++;

        // Update LOD timestamp for regenerated chunks
        this.lastLODUpdate.set(key, Date.now());

        const distance = chunkDistance(chunkPos, centerChunk);
        console.log(
          `Generated chunk [${chunkPos.x}, ${chunkPos.z}] at distance ${distance.toFixed(1)} - LOD${chunkData.lodLevel} (scale ${chunkData.lodScale}) - queue remaining: ${this.chunkQueue.length}`
        );
      } else {
        // If generateChunk returned null (chunk pending), re-queue it for later
        this.chunkQueue.push({
          chunkPos,
          centerChunk,
          priority: queueItem.priority + 1000,
        }); // Lower priority
      }
    }

    // Process deferred chunks if we have time budget left
    if (
      this.chunkQueue.length > 0 &&
      this.frameGenCount === 0
    ) {
      // Try one more chunk even if we're at frame limit
      const queueItem = this.chunkQueue.shift()!;
      const { chunkPos, centerChunk } = queueItem;
      const key = getChunkKey(chunkPos.x, chunkPos.z);

      if (!this.loadedChunks.has(key)) {
        const chunkData = this.generateChunk(
          chunkPos.x,
          chunkPos.z,
          centerChunk
        );
        if (chunkData) {
          this.loadedChunks.set(key, chunkData);
          this.lastLODUpdate.set(key, Date.now());
        }
      }
    }

    // Frame generation stats logged silently
  }

  // Clean up chunks that have been pending for too long (worker may have failed)
  private cleanupStalePendingChunks(): void {
    const now = Date.now();
    const staleThreshold = 10000; // 10 seconds

    for (const [
      key,
      timestamp,
    ] of this.pendingTimestamps.entries()) {
      if (now - timestamp > staleThreshold) {
        // Cleaning up stale pending chunk silently
        this.pendingChunks.delete(key);
        this.pendingTimestamps.delete(key);
      }
    }
  }

  // Ensure critical chunks (within 25% of render distance) are always loaded
  private ensureCriticalChunksLoaded(
    centerChunk: ChunkKey
  ): void {
    const criticalDistance = Math.max(5, Math.floor(this.config.renderDistance * 0.25)); // 25% of render distance, minimum 5
    
    // Log critical distance calculation on first call
    if (!this.criticalDistanceLogged) {
      console.log(`Critical chunk distance: ${criticalDistance} (25% of render distance ${this.config.renderDistance}, min 5)`);
      console.log(`LOD Thresholds: Level 1 at ${this.config.lodConfig.level1Distance}, Level 2 at ${this.config.lodConfig.level2Distance}`);
      this.criticalDistanceLogged = true;
    }

    for (
      let x = centerChunk.x - criticalDistance;
      x <= centerChunk.x + criticalDistance;
      x++
    ) {
      for (
        let z = centerChunk.z - criticalDistance;
        z <= centerChunk.z + criticalDistance;
        z++
      ) {
        const key = getChunkKey(x, z);

        // If critical chunk is missing and not pending, force generate it
        if (
          !this.loadedChunks.has(key) &&
          !this.pendingChunks.has(key)
        ) {
          const distance = chunkDistance({ x, z }, centerChunk);
          const { level, scale } = this.getLODLevel({ x, z }, centerChunk);
          console.log(
            `Critical chunk missing: [${x}, ${z}] at distance ${distance.toFixed(1)}, generating LOD${level} (scale ${scale})`
          );
          const chunkData = this.generateChunk(
            x,
            z,
            centerChunk
          );
          if (chunkData) {
            this.loadedChunks.set(key, chunkData);
            this.lastLODUpdate.set(key, Date.now());
          }
        }
      }
    }
  }

  // Check if chunk should be regenerated due to LOD change
  private shouldRegenerateChunk(
    chunkPos: ChunkKey,
    centerChunk: ChunkKey
  ): boolean {
    const key = getChunkKey(chunkPos.x, chunkPos.z);
    const existingChunk = this.loadedChunks.get(key);
    if (!existingChunk) return false;

    const requiredLOD = this.getLODLevel(
      chunkPos,
      centerChunk,
      existingChunk.lodLevel
    );
    return (
      existingChunk.lodLevel !== requiredLOD.level ||
      existingChunk.lodScale !== requiredLOD.scale
    );
  }

  // Get currently loaded chunks
  getLoadedChunks(): ChunkData[] {
    return Array.from(this.loadedChunks.values());
  }

  // Get voxel data at world coordinates (can cross chunk boundaries, LOD-aware)
  getVoxelAt(
    worldX: number,
    worldY: number,
    worldZ: number
  ): VoxelType {
    const chunkX = Math.floor(worldX / CHUNK_SIZE);
    const chunkZ = Math.floor(worldZ / CHUNK_SIZE);
    const chunkKey = getChunkKey(chunkX, chunkZ);

    const chunk = this.loadedChunks.get(chunkKey);
    if (!chunk) {
      return VoxelType.AIR; // Assume air if chunk not loaded
    }

    const lodScale = chunk.lodScale || 1;
    const chunkWidth = Math.ceil(CHUNK_SIZE / lodScale);
    const chunkHeight = Math.ceil(CHUNK_HEIGHT / lodScale);

    // Convert world coordinates to LOD-local coordinates
    const localWorldX = worldX - chunkX * CHUNK_SIZE;
    const localWorldZ = worldZ - chunkZ * CHUNK_SIZE;

    const localX = Math.floor(localWorldX / lodScale);
    const localY = Math.floor(worldY / lodScale);
    const localZ = Math.floor(localWorldZ / lodScale);

    // Bounds check with LOD dimensions
    if (
      localX < 0 ||
      localX >= chunkWidth ||
      localY < 0 ||
      localY >= chunkHeight ||
      localZ < 0 ||
      localZ >= chunkWidth
    ) {
      return VoxelType.AIR;
    }

    // Ensure the voxel array exists at this position
    if (
      !chunk.voxels[localX] ||
      !chunk.voxels[localX][localY] ||
      !chunk.voxels[localX][localY][localZ]
    ) {
      return VoxelType.AIR;
    }

    return chunk.voxels[localX][localY][localZ].type;
  }

  // Get voxel with LOD compatibility check for face culling
  getVoxelAtWithLODCheck(
    worldX: number,
    worldY: number,
    worldZ: number,
    requestingChunkLOD: number
  ): VoxelType {
    const chunkX = Math.floor(worldX / CHUNK_SIZE);
    const chunkZ = Math.floor(worldZ / CHUNK_SIZE);
    const chunkKey = getChunkKey(chunkX, chunkZ);

    const chunk = this.loadedChunks.get(chunkKey);
    if (!chunk) {
      return VoxelType.AIR; // Assume air if chunk not loaded
    }

    const neighborLOD = chunk.lodScale || 1;

    // If LOD levels match, use normal lookup with face culling
    if (neighborLOD === requestingChunkLOD) {
      return this.getVoxelAt(worldX, worldY, worldZ);
    }

    // Different LOD levels - be conservative and don't cull faces
    // This ensures visual continuity at LOD boundaries
    return VoxelType.AIR;
  }

  // Get stats for debugging
  getStats() {
    return {
      loadedChunks: this.loadedChunks.size,
      renderDistance: this.config.renderDistance,
      pendingChunks: this.pendingChunks.size,
      workerActive: this.worker !== null,
    };
  }

  // Cleanup worker when component unmounts
  cleanup() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      console.log("Terrain worker terminated");
    }
  }
}

// React hook to use the chunk manager
export const useChunkManager = (
  config: ChunkManagerConfig
) => {
  const [chunkManager] = useState(
    () => new ChunkManager(config)
  );
  const [loadedChunks, setLoadedChunks] = useState<
    ChunkData[]
  >([]);
  const [, forceUpdate] = useState({});

  // Force re-render when worker completes chunks
  useEffect(() => {
    const originalHandleChunkGenerated =
      chunkManager["handleChunkGenerated"].bind(
        chunkManager
      );

    chunkManager["handleChunkGenerated"] = (data: any) => {
      originalHandleChunkGenerated(data);
      // Force re-render to show newly generated chunks
      forceUpdate({});
    };

    // Cleanup on unmount
    return () => {
      chunkManager.cleanup();
    };
  }, [chunkManager]);

  const updateChunks = useCallback(
    (cameraWorldX: number, cameraWorldZ: number) => {
      const chunks = chunkManager.updateChunks(
        cameraWorldX,
        cameraWorldZ
      );
      setLoadedChunks(chunks);
    },
    [chunkManager]
  );

  const getStats = useCallback(
    () => chunkManager.getStats(),
    [chunkManager]
  );

  const getVoxelAt = useCallback(
    (worldX: number, worldY: number, worldZ: number) => {
      return chunkManager.getVoxelAt(
        worldX,
        worldY,
        worldZ
      );
    },
    [chunkManager]
  );

  const getVoxelAtWithLODCheck = useCallback(
    (
      worldX: number,
      worldY: number,
      worldZ: number,
      requestingChunkLOD: number
    ) => {
      return chunkManager.getVoxelAtWithLODCheck(
        worldX,
        worldY,
        worldZ,
        requestingChunkLOD
      );
    },
    [chunkManager]
  );

  return {
    loadedChunks,
    updateChunks,
    getStats,
    getVoxelAt,
    getVoxelAtWithLODCheck,
  };
};
