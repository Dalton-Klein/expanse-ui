// Voxel2 Core Type Definitions
// Clean, well-documented types for the new voxel system

// Basic voxel data structure
export interface Voxel {
  type: VoxelType;
  // TODO: Add material properties, lighting, etc. as needed
}
// Basic voxel types
export enum VoxelType {
  AIR = 0,
  STONE = 1,
  GRASS = 2,
  DIRT = 3,
  SAND = 4,
  WATER = 5,
}

// World configuration constants moved to TerrainConfig.ts
// Import CHUNK_SIZE, CHUNK_HEIGHT, VOXEL_SIZE from "../terrain/TerrainConfig"

// Basic 3D position
export interface Position3D {
  x: number;
  y: number;
  z: number;
}

// Chunk data structure (simplified for now)
export interface ChunkData {
  position: Position3D;
  voxels: Voxel[][][]; // [x][y][z]
  // TODO: Add metadata, generation status, etc.
}

// Rendering configuration
export interface RenderConfig {
  wireframe: boolean;
  showDebugInfo: boolean;
  terrainPattern: DebugPattern;
  // TODO: Add more rendering options
}

// Debug pattern types for testing
export enum DebugPattern {
  FLAT = "flat",
  CHECKERBOARD = "checkerboard",
  STEPPED = "stepped",
  // TODO: Add more test patterns
}

// Performance metrics
export interface PerformanceMetrics {
  fps: number;
  triangles: number;
  chunks: number;
  // TODO: Add more performance tracking
}

// Terrain generation algorithms
export enum GenerationAlgorithm {
  NOISE = "noise",
  DEBUG_PATTERN = "debug-pattern",
}

// LOD (Level of Detail) configuration
export interface LODConfig {
  enabled: boolean;
  level1Distance: number; // chunks - distance for LOD level 1
  level2Distance: number; // chunks - distance for LOD level 2
}

// Greedy meshing algorithms
export enum MeshingAlgorithm {
  NAIVE = "naive",
  BINARY_GREEDY = "binary-greedy",
}

// Greedy meshing configuration
export interface GreedyMeshingConfig {
  enabled: boolean;
  algorithm: MeshingAlgorithm; // which meshing algorithm to use
  crossChunkCulling: boolean; // enable face culling across chunk boundaries
}

// Terrain generation configuration
export interface GenerationConfig {
  algorithm: GenerationAlgorithm;
  debugPattern: DebugPattern; // used when algorithm is DEBUG_PATTERN
  seed: number; // seed for procedural generation
  // TODO: Add noise settings when noise generation is implemented
}

// Performance configuration
export interface PerformanceConfig {
  maxChunksPerFrame: number; // limit chunk processing per frame
  enableWorkers: boolean; // use web workers for chunk generation
}

// Debug configuration
export interface DebugConfig {
  showChunkBorders: boolean; // visualize chunk boundaries
  showLODColors: boolean; // color code chunks by LOD level
  enableNaiveComparison: boolean; // allow toggle between naive/optimized rendering
}

// Master terrain configuration - single source of truth for all terrain settings
export interface TerrainConfig {
  renderDistance: number; // render distance in chunks
  chunkSize: number; // voxels per chunk side
  chunkHeight: number; // voxels per chunk height
  voxelSize: number; // world units per voxel
  lod: LODConfig;
  greedyMeshing: GreedyMeshingConfig;
  generation: GenerationConfig;
  performance: PerformanceConfig;
  debug: DebugConfig;
}
