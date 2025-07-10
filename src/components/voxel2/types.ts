import * as THREE from "three";

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
  SNOW = 6,
}

// Basic 3D position
export interface Position3D {
  x: number;
  y: number;
  z: number;
}

// ChunkData is a structure that is used to capture the structure of a chunk from noise
// It is later converted into binary before greedy methods and culling are applied
export interface ChunkData {
  position: Position3D;
  voxels: Voxel[][][]; // [x][y][z]
  // TODO: Add metadata, generation status, etc.
}

// ChunkMeshResult is the result of meshing a chunk, it contains the generated geometry
// and performance metrics for that chunk
export interface ChunkMeshResult {
  geometry: THREE.BufferGeometry;
  triangleCount: number;
  generationTime: number; // in milliseconds
}

export interface TerrainResult {
  generationTime: number;
  triangles: number;
  chunks: ChunkData[];
  // TODO: Add more performance tracking
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
  TINY = "tiny",
  FLAT = "flat",
  CHECKERBOARD = "checkerboard",
  STEPPED = "stepped",
  TWO_CUBES = "two-cubes",
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

// Individual noise layer configuration
export interface NoiseLayer {
  enabled: boolean; // whether this layer is active
  scale: number; // frequency of the noise (smaller = larger features)
  amplitude: number; // height contribution
  octaves: number; // number of noise layers
  persistence: number; // amplitude decay between octaves
}

// Layered noise generation configuration
export interface LayeredNoiseConfig {
  continental: NoiseLayer; // Large-scale landmasses and ocean basins
  regional: NoiseLayer; // Hills, valleys, and plateaus
  local: NoiseLayer; // Surface detail and roughness
  baseHeight: number; // minimum terrain height
  mapSize: number; // number of chunks in X and Z directions (NxN grid)
}

// Terrain generation configuration
export interface GenerationConfig {
  algorithm: GenerationAlgorithm;
  debugPattern: DebugPattern; // used when algorithm is DEBUG_PATTERN
  seed: number; // seed for procedural generation
  noise: LayeredNoiseConfig; // layered noise generation settings
}

// Performance metrics for debug panel
export interface PerformanceMetrics {
  fps: number;
  triangles: number;
  chunks: number;
  avgGenerationTime: number; // average milliseconds per chunk
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
  worldHeight: number; // height of the world in voxels, ideally a multiple of chunk size
  chunkSize: number; // voxels per chunk side
  voxelSize: number; // world units per voxel
  lod: LODConfig;
  greedyMeshing: GreedyMeshingConfig;
  generation: GenerationConfig;
  performance: PerformanceConfig;
  debug: DebugConfig;
}
