import * as THREE from "three";
import {
  ChunkData,
  Position3D,
  VoxelType,
  TerrainResult,
  ChunkMeshResult,
} from "../../types";
import { CHUNK_SIZE, CHUNK_HEIGHT } from "../TerrainConfig";
import { ChunkHelpers } from "../chunk-generation/ChunkHelpers";

// GreedyMesher is a class that implements the greedy meshing algorithm and face culling
// It is based on TanTanDevs binary greedy meshing algorithm found here: https://github.com/TanTanDev/binary_greedy_mesher_demo
export class GreedyMesher {
  public static generateMeshForChunk(
    chunk: ChunkData
  ): ChunkMeshResult {
    let result: ChunkMeshResult = {
      geometry: new THREE.BufferGeometry(),
      triangleCount: 0,
      generationTime: 0,
    };
    // 1. Binary Encoding- Convert 3d array chunk data into binary columns
    // 2. Face Culling- Cull voxel faces based on adjacency to air, use bitwise operations to find face transitions
    //    - Generate 6 face masks (one for each direction: +X, -X, +Y, -Y, +Z, -Z)
    // 3. Group Faces By Block Type (And Later Ambient Occlusion)- Create 2D binary planes for each unique combination
    //    - Store as data[axis][block_hash][y_level] = 32x32 binary plane
    // 4. Greedy algorithm- For each 2D binary plane, apply the greedy algorithm
    //    - Expand rectangles first vertically (height), then horizontally (width)
    //    - Clear bits as they're merged to avoid duplicate processing
    // 5. Generate Geometry (And Later Ambient Occlusion)- Convert greedy quads to vertices with proper winding order
    return result;
  }
}
