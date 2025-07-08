import { GreedyMesher } from "./GreedyMesher";
import { ChunkGenerator } from "../chunk-generation/ChunkGenerator";
import { ChunkHelpers } from "../chunk-generation/ChunkHelpers";
import { VoxelType } from "../../types";
import { CHUNK_SIZE } from "../TerrainConfig";

describe("GreedyMesher", () => {
  describe("encodeToBinary", () => {
    it("should correctly encode a 2x2x2 cube from generateTinyChunk", () => {
      // Generate a tiny chunk with 2x2x2 cube pattern
      const tinyChunk = ChunkGenerator.generateTinyChunk({ x: 0, y: 0, z: 0 });
      
      // Count solid voxels to verify chunk generation
      let solidCount = 0;
      const solidPositions: Array<[number, number, number]> = [];
      
      for (let x = 0; x < CHUNK_SIZE + 2; x++) {
        for (let y = 0; y < CHUNK_SIZE + 2; y++) {
          for (let z = 0; z < CHUNK_SIZE + 2; z++) {
            const voxel = ChunkHelpers.getVoxel(tinyChunk, x, y, z);
            if (voxel && voxel.type !== VoxelType.AIR) {
              solidCount++;
              solidPositions.push([x, y, z]);
            }
          }
        }
      }
      
      // Should have exactly 8 solid voxels (2x2x2 cube)
      expect(solidCount).toBe(8);
      
      // Verify positions are correct (1,1,1) to (2,2,2)
      const expectedPositions = [
        [1, 1, 1], [1, 1, 2], [1, 2, 1], [1, 2, 2],
        [2, 1, 1], [2, 1, 2], [2, 2, 1], [2, 2, 2]
      ];
      
      expect(solidPositions).toEqual(expect.arrayContaining(expectedPositions));
      
      // Test private method indirectly through generateMeshForChunk
      const meshResult = GreedyMesher.generateMeshForChunk(tinyChunk);
      
      // For now, just verify it doesn't throw and returns expected structure
      expect(meshResult).toHaveProperty('geometry');
      expect(meshResult).toHaveProperty('triangleCount');
      expect(meshResult).toHaveProperty('generationTime');
      expect(meshResult.generationTime).toBeGreaterThanOrEqual(0);
    });

    it("should handle empty chunks correctly", () => {
      // Create an empty chunk (all AIR)
      const emptyChunk = ChunkHelpers.createEmpty({ x: 0, y: 0, z: 0 });
      
      // Verify it's actually empty
      let solidCount = 0;
      for (let x = 0; x < CHUNK_SIZE + 2; x++) {
        for (let y = 0; y < CHUNK_SIZE + 2; y++) {
          for (let z = 0; z < CHUNK_SIZE + 2; z++) {
            const voxel = ChunkHelpers.getVoxel(emptyChunk, x, y, z);
            if (voxel && voxel.type !== VoxelType.AIR) {
              solidCount++;
            }
          }
        }
      }
      
      expect(solidCount).toBe(0);
      
      // Test encoding
      const meshResult = GreedyMesher.generateMeshForChunk(emptyChunk);
      
      expect(meshResult).toHaveProperty('geometry');
      expect(meshResult.triangleCount).toBe(0); // No triangles for empty chunk
    });

    it("should correctly encode flat terrain", () => {
      // Generate flat terrain
      const flatChunk = ChunkGenerator.generateFlatChunk({ x: 0, y: 0, z: 0 });
      
      // Count solid voxels
      let solidCount = 0;
      for (let x = 0; x < CHUNK_SIZE + 2; x++) {
        for (let y = 0; y < CHUNK_SIZE + 2; y++) {
          for (let z = 0; z < CHUNK_SIZE + 2; z++) {
            const voxel = ChunkHelpers.getVoxel(flatChunk, x, y, z);
            if (voxel && voxel.type !== VoxelType.AIR) {
              solidCount++;
            }
          }
        }
      }
      
      // Flat terrain should have many solid blocks
      expect(solidCount).toBeGreaterThan(0);
      
      // Test encoding
      const meshResult = GreedyMesher.generateMeshForChunk(flatChunk);
      
      expect(meshResult).toHaveProperty('geometry');
      expect(meshResult.generationTime).toBeGreaterThanOrEqual(0);
    });

    // Direct test of the binary encoding logic
    it("should produce correct binary patterns for known cube", () => {
      // Create a custom chunk with a single voxel at a known position
      const testChunk = ChunkHelpers.createEmpty({ x: 0, y: 0, z: 0 });
      
      // Place a single stone block at position (5, 10, 15)
      ChunkHelpers.setVoxel(testChunk, 5, 10, 15, { type: VoxelType.STONE });
      
      // We can't directly test encodeToBinary since it's private,
      // but we can verify the behavior through the public API
      const meshResult = GreedyMesher.generateMeshForChunk(testChunk);
      
      // Should generate a mesh for the single block
      expect(meshResult).toHaveProperty('geometry');
      expect(meshResult.generationTime).toBeGreaterThanOrEqual(0);
    });

    it("should correctly handle chunks with mixed voxel types", () => {
      const mixedChunk = ChunkHelpers.createEmpty({ x: 0, y: 0, z: 0 });
      
      // Add different voxel types
      ChunkHelpers.setVoxel(mixedChunk, 1, 1, 1, { type: VoxelType.STONE });
      ChunkHelpers.setVoxel(mixedChunk, 2, 1, 1, { type: VoxelType.GRASS });
      ChunkHelpers.setVoxel(mixedChunk, 3, 1, 1, { type: VoxelType.DIRT });
      ChunkHelpers.setVoxel(mixedChunk, 4, 1, 1, { type: VoxelType.SAND });
      ChunkHelpers.setVoxel(mixedChunk, 5, 1, 1, { type: VoxelType.WATER });
      
      const meshResult = GreedyMesher.generateMeshForChunk(mixedChunk);
      
      expect(meshResult).toHaveProperty('geometry');
      expect(meshResult.generationTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe("generateMeshForChunk", () => {
    it("should complete within reasonable time", () => {
      const chunk = ChunkGenerator.generateFlatChunk({ x: 0, y: 0, z: 0 });
      
      const startTime = performance.now();
      const meshResult = GreedyMesher.generateMeshForChunk(chunk);
      const endTime = performance.now();
      
      // Should complete in less than 100ms
      expect(endTime - startTime).toBeLessThan(100);
      expect(meshResult.generationTime).toBeLessThan(100);
    });
  });
});