import { ChunkGenerator } from "./ChunkGenerator";
import { ChunkHelpers } from "./ChunkHelpers";
import { VoxelType } from "../../types";
import { CHUNK_SIZE } from "../TerrainConfig";

describe("ChunkGenerator", () => {
  describe("generateTinyChunk", () => {
    it("should create exactly 8 solid voxels in a 2x2x2 pattern", () => {
      const chunk = ChunkGenerator.generateTinyChunk({ x: 0, y: 0, z: 0 });
      
      // Count solid voxels
      let solidCount = 0;
      const solidPositions: Array<[number, number, number]> = [];
      
      for (let x = 0; x < CHUNK_SIZE + 2; x++) {
        for (let y = 0; y < CHUNK_SIZE + 2; y++) {
          for (let z = 0; z < CHUNK_SIZE + 2; z++) {
            const voxel = ChunkHelpers.getVoxel(chunk, x, y, z);
            if (voxel && voxel.type !== VoxelType.AIR) {
              solidCount++;
              solidPositions.push([x, y, z]);
            }
          }
        }
      }
      
      expect(solidCount).toBe(8);
      
      // Verify positions form a 2x2x2 cube at (1,1,1) to (2,2,2)
      const expectedPositions = [
        [1, 1, 1], [1, 1, 2], [1, 2, 1], [1, 2, 2],
        [2, 1, 1], [2, 1, 2], [2, 2, 1], [2, 2, 2]
      ];
      
      expect(solidPositions).toEqual(expect.arrayContaining(expectedPositions));
      expect(solidPositions.length).toBe(expectedPositions.length);
    });

    it("should create grass blocks", () => {
      const chunk = ChunkGenerator.generateTinyChunk({ x: 0, y: 0, z: 0 });
      
      // Check that the solid blocks are grass
      const voxel = ChunkHelpers.getVoxel(chunk, 1, 1, 1);
      expect(voxel).not.toBeNull();
      expect(voxel?.type).toBe(VoxelType.GRASS);
    });

    it("should respect chunk position", () => {
      const chunkPos = { x: 5, y: 10, z: 15 };
      const chunk = ChunkGenerator.generateTinyChunk(chunkPos);
      
      expect(chunk.position).toEqual(chunkPos);
    });
  });

  describe("generateFlatChunk", () => {
    it("should create a flat platform of grass blocks", () => {
      const chunk = ChunkGenerator.generateFlatChunk({ x: 0, y: 0, z: 0 });
      
      let solidCount = 0;
      let grassCount = 0;
      
      for (let x = 0; x < CHUNK_SIZE + 2; x++) {
        for (let y = 0; y < CHUNK_SIZE + 2; y++) {
          for (let z = 0; z < CHUNK_SIZE + 2; z++) {
            const voxel = ChunkHelpers.getVoxel(chunk, x, y, z);
            if (voxel && voxel.type !== VoxelType.AIR) {
              solidCount++;
              if (voxel.type === VoxelType.GRASS) {
                grassCount++;
              }
            }
          }
        }
      }
      
      // Should have many solid blocks
      expect(solidCount).toBeGreaterThan(100);
      // All solid blocks should be grass
      expect(grassCount).toBe(solidCount);
    });

    it("should create blocks up to height 8", () => {
      const chunk = ChunkGenerator.generateFlatChunk({ x: 0, y: 0, z: 0 });
      
      // Check that blocks exist at Y=1 through Y=8
      for (let y = 1; y <= 8; y++) {
        const voxel = ChunkHelpers.getVoxel(chunk, 5, y, 5);
        expect(voxel).not.toBeNull();
        expect(voxel?.type).toBe(VoxelType.GRASS);
      }
      
      // Check that Y=9 and above is air
      const voxelAbove = ChunkHelpers.getVoxel(chunk, 5, 9, 5);
      expect(voxelAbove?.type).toBe(VoxelType.AIR);
    });

    it("should not create blocks at chunk borders (x=0, z=0)", () => {
      const chunk = ChunkGenerator.generateFlatChunk({ x: 0, y: 0, z: 0 });
      
      // Check borders are air
      for (let i = 0; i < CHUNK_SIZE + 2; i++) {
        // X border
        const xBorder = ChunkHelpers.getVoxel(chunk, 0, 5, i);
        expect(xBorder?.type).toBe(VoxelType.AIR);
        
        // Z border
        const zBorder = ChunkHelpers.getVoxel(chunk, i, 5, 0);
        expect(zBorder?.type).toBe(VoxelType.AIR);
        
        // Y border
        const yBorder = ChunkHelpers.getVoxel(chunk, i, 0, 5);
        expect(yBorder?.type).toBe(VoxelType.AIR);
      }
    });
  });

  describe("Performance", () => {
    it("should generate chunks quickly", () => {
      const startTime = performance.now();
      
      // Generate 10 chunks
      for (let i = 0; i < 10; i++) {
        ChunkGenerator.generateFlatChunk({ x: i, y: 0, z: 0 });
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should generate 10 chunks in less than 50ms
      expect(duration).toBeLessThan(50);
    });
  });
});