import { ChunkHelpers } from "./ChunkHelpers";
import { VoxelType, ChunkData } from "../../types";
import { CHUNK_SIZE } from "../TerrainConfig";

describe("ChunkHelpers", () => {
  describe("createEmpty", () => {
    it("should create a chunk filled with air", () => {
      const chunkPos = { x: 0, y: 0, z: 0 };
      const chunk = ChunkHelpers.createEmpty(chunkPos);
      
      expect(chunk.position).toEqual(chunkPos);
      expect(chunk.voxels).toBeDefined();
      
      // Check dimensions
      expect(chunk.voxels.length).toBe(CHUNK_SIZE + 2); // 32
      expect(chunk.voxels[0].length).toBe(CHUNK_SIZE + 2);
      expect(chunk.voxels[0][0].length).toBe(CHUNK_SIZE + 2);
    });

    it("should initialize all voxels as AIR", () => {
      const chunk = ChunkHelpers.createEmpty({ x: 0, y: 0, z: 0 });
      
      let airCount = 0;
      for (let x = 0; x < CHUNK_SIZE + 2; x++) {
        for (let y = 0; y < CHUNK_SIZE + 2; y++) {
          for (let z = 0; z < CHUNK_SIZE + 2; z++) {
            const voxel = ChunkHelpers.getVoxel(chunk, x, y, z);
            if (voxel && voxel.type === VoxelType.AIR) {
              airCount++;
            }
          }
        }
      }
      
      // All voxels should be air
      const totalVoxels = (CHUNK_SIZE + 2) ** 3;
      expect(airCount).toBe(totalVoxels);
    });

    it("should set correct chunk position", () => {
      const positions = [
        { x: 0, y: 0, z: 0 },
        { x: -5, y: 10, z: 15 },
        { x: 100, y: -50, z: 200 }
      ];
      
      positions.forEach(pos => {
        const chunk = ChunkHelpers.createEmpty(pos);
        expect(chunk.position).toEqual(pos);
      });
    });
  });

  describe("getVoxel", () => {
    let chunk: ChunkData;
    
    beforeEach(() => {
      chunk = ChunkHelpers.createEmpty({ x: 0, y: 0, z: 0 });
    });

    it("should return voxel at valid coordinates", () => {
      const voxel = ChunkHelpers.getVoxel(chunk, 5, 10, 15);
      expect(voxel).not.toBeNull();
      expect(voxel?.type).toBe(VoxelType.AIR);
    });

    it("should return null for out of bounds coordinates", () => {
      // Negative coordinates
      expect(ChunkHelpers.getVoxel(chunk, -1, 0, 0)).toBeNull();
      expect(ChunkHelpers.getVoxel(chunk, 0, -1, 0)).toBeNull();
      expect(ChunkHelpers.getVoxel(chunk, 0, 0, -1)).toBeNull();
      
      // Beyond chunk size
      const size = CHUNK_SIZE + 2;
      expect(ChunkHelpers.getVoxel(chunk, size, 0, 0)).toBeNull();
      expect(ChunkHelpers.getVoxel(chunk, 0, size, 0)).toBeNull();
      expect(ChunkHelpers.getVoxel(chunk, 0, 0, size)).toBeNull();
    });

    it("should handle edge cases correctly", () => {
      const maxIndex = CHUNK_SIZE + 1; // 31
      
      // Should work at max valid index
      expect(ChunkHelpers.getVoxel(chunk, maxIndex, maxIndex, maxIndex)).not.toBeNull();
      
      // Should fail at max + 1
      expect(ChunkHelpers.getVoxel(chunk, maxIndex + 1, 0, 0)).toBeNull();
    });
  });

  describe("setVoxel", () => {
    let chunk: ChunkData;
    
    beforeEach(() => {
      chunk = ChunkHelpers.createEmpty({ x: 0, y: 0, z: 0 });
    });

    it("should set voxel at valid coordinates", () => {
      const stoneVoxel = { type: VoxelType.STONE };
      const result = ChunkHelpers.setVoxel(chunk, 5, 10, 15, stoneVoxel);
      
      expect(result).toBe(true);
      
      const retrieved = ChunkHelpers.getVoxel(chunk, 5, 10, 15);
      expect(retrieved).toEqual(stoneVoxel);
    });

    it("should return false for out of bounds coordinates", () => {
      const voxel = { type: VoxelType.GRASS };
      
      // Note: setVoxel uses CHUNK_SIZE (30) as bounds, not CHUNK_SIZE + 2
      expect(ChunkHelpers.setVoxel(chunk, -1, 0, 0, voxel)).toBe(false);
      expect(ChunkHelpers.setVoxel(chunk, CHUNK_SIZE, 0, 0, voxel)).toBe(false);
      expect(ChunkHelpers.setVoxel(chunk, 0, CHUNK_SIZE, 0, voxel)).toBe(false);
    });

    it("should support all voxel types", () => {
      const types = [
        VoxelType.AIR,
        VoxelType.STONE,
        VoxelType.GRASS,
        VoxelType.DIRT,
        VoxelType.SAND,
        VoxelType.WATER
      ];
      
      types.forEach((type, index) => {
        const voxel = { type };
        ChunkHelpers.setVoxel(chunk, index, 0, 0, voxel);
        
        const retrieved = ChunkHelpers.getVoxel(chunk, index, 0, 0);
        expect(retrieved?.type).toBe(type);
      });
    });
  });

  describe("getChunkEndPosFromStartPos", () => {
    it("should calculate correct end position", () => {
      const testCases = [
        { start: { x: 0, y: 0, z: 0 }, end: { x: 29, y: 29, z: 29 } },
        { start: { x: 1, y: 2, z: 3 }, end: { x: 30, y: 31, z: 32 } },
        { start: { x: -10, y: -20, z: -30 }, end: { x: 19, y: 9, z: -1 } }
      ];
      
      testCases.forEach(({ start, end }) => {
        const result = ChunkHelpers.getChunkEndPosFromStartPos(start);
        expect(result).toEqual(end);
      });
    });

    it("should handle negative coordinates", () => {
      const start = { x: -100, y: -200, z: -300 };
      const end = ChunkHelpers.getChunkEndPosFromStartPos(start);
      
      expect(end.x).toBe(start.x + CHUNK_SIZE - 1);
      expect(end.y).toBe(start.y + CHUNK_SIZE - 1);
      expect(end.z).toBe(start.z + CHUNK_SIZE - 1);
    });
  });

  describe("Integration", () => {
    it("should work correctly with padded chunks", () => {
      const chunk = ChunkHelpers.createEmpty({ x: 0, y: 0, z: 0 });
      
      // Set voxels in the main area (not padding)
      for (let x = 1; x <= CHUNK_SIZE; x++) {
        for (let y = 1; y <= CHUNK_SIZE; y++) {
          for (let z = 1; z <= CHUNK_SIZE; z++) {
            // setVoxel uses 0-based indexing up to CHUNK_SIZE-1
            if (x < CHUNK_SIZE && y < CHUNK_SIZE && z < CHUNK_SIZE) {
              ChunkHelpers.setVoxel(chunk, x, y, z, { type: VoxelType.STONE });
            }
          }
        }
      }
      
      // Verify padding areas remain air
      expect(ChunkHelpers.getVoxel(chunk, 0, 5, 5)?.type).toBe(VoxelType.AIR);
      expect(ChunkHelpers.getVoxel(chunk, 31, 5, 5)?.type).toBe(VoxelType.AIR);
    });
  });
});