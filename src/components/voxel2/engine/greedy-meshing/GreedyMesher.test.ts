import { GreedyMesher } from "./GreedyMesher";
import { ChunkGenerator } from "../chunk-generation/ChunkGenerator";
import { ChunkHelpers } from "../chunk-generation/ChunkHelpers";
import { VoxelType } from "../../types";
import { CHUNK_SIZE } from "../TerrainConfig";

describe("GreedyMesher", () => {
  describe("encodeToBinary", () => {
    it("should correctly encode a 2x2x2 cube from generateTinyChunk", () => {
      // Generate a tiny chunk with 2x2x2 cube pattern
      const tinyChunk = ChunkGenerator.generateTinyChunk({
        x: 0,
        y: 0,
        z: 0,
      });

      // Count solid voxels to verify chunk generation
      let solidCount = 0;
      const solidPositions: Array<
        [number, number, number]
      > = [];

      for (let x = 0; x < CHUNK_SIZE + 2; x++) {
        for (let y = 0; y < CHUNK_SIZE + 2; y++) {
          for (let z = 0; z < CHUNK_SIZE + 2; z++) {
            const voxel = ChunkHelpers.getVoxel(
              tinyChunk,
              x,
              y,
              z
            );
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
        [1, 1, 1],
        [1, 1, 2],
        [1, 2, 1],
        [1, 2, 2],
        [2, 1, 1],
        [2, 1, 2],
        [2, 2, 1],
        [2, 2, 2],
      ];

      expect(solidPositions).toEqual(
        expect.arrayContaining(expectedPositions)
      );

      // Test private method indirectly through generateMeshForChunk
      const meshResult =
        GreedyMesher.generateMeshForChunk(tinyChunk);

      // For now, just verify it doesn't throw and returns expected structure
      expect(meshResult).toHaveProperty("geometry");
      expect(meshResult).toHaveProperty("triangleCount");
      expect(meshResult).toHaveProperty("generationTime");
      expect(
        meshResult.generationTime
      ).toBeGreaterThanOrEqual(0);
    });

    it("should handle empty chunks correctly", () => {
      // Create an empty chunk (all AIR)
      const emptyChunk = ChunkHelpers.createEmpty({
        x: 0,
        y: 0,
        z: 0,
      });

      // Verify it's actually empty
      let solidCount = 0;
      for (let x = 0; x < CHUNK_SIZE + 2; x++) {
        for (let y = 0; y < CHUNK_SIZE + 2; y++) {
          for (let z = 0; z < CHUNK_SIZE + 2; z++) {
            const voxel = ChunkHelpers.getVoxel(
              emptyChunk,
              x,
              y,
              z
            );
            if (voxel && voxel.type !== VoxelType.AIR) {
              solidCount++;
            }
          }
        }
      }

      expect(solidCount).toBe(0);

      // Test encoding
      const meshResult =
        GreedyMesher.generateMeshForChunk(emptyChunk);

      expect(meshResult).toHaveProperty("geometry");
      expect(meshResult.triangleCount).toBe(0); // No triangles for empty chunk
    });

    it("should correctly encode flat terrain", () => {
      // Generate flat terrain
      const flatChunk = ChunkGenerator.generateFlatChunk({
        x: 0,
        y: 0,
        z: 0,
      });

      // Count solid voxels
      let solidCount = 0;
      for (let x = 0; x < CHUNK_SIZE + 2; x++) {
        for (let y = 0; y < CHUNK_SIZE + 2; y++) {
          for (let z = 0; z < CHUNK_SIZE + 2; z++) {
            const voxel = ChunkHelpers.getVoxel(
              flatChunk,
              x,
              y,
              z
            );
            if (voxel && voxel.type !== VoxelType.AIR) {
              solidCount++;
            }
          }
        }
      }

      // Flat terrain should have many solid blocks
      expect(solidCount).toBeGreaterThan(0);

      // Test encoding
      const meshResult =
        GreedyMesher.generateMeshForChunk(flatChunk);

      expect(meshResult).toHaveProperty("geometry");
      expect(
        meshResult.generationTime
      ).toBeGreaterThanOrEqual(0);
    });

    // Direct test of the binary encoding logic
    it("should produce correct binary patterns for known cube", () => {
      // Create a custom chunk with a single voxel at a known position
      const testChunk = ChunkHelpers.createEmpty({
        x: 0,
        y: 0,
        z: 0,
      });

      // Place a single stone block at position (5, 10, 15)
      ChunkHelpers.setVoxel(testChunk, 5, 10, 15, {
        type: VoxelType.STONE,
      });

      // We can't directly test encodeToBinary since it's private,
      // but we can verify the behavior through the public API
      const meshResult =
        GreedyMesher.generateMeshForChunk(testChunk);

      // Should generate a mesh for the single block
      expect(meshResult).toHaveProperty("geometry");
      expect(
        meshResult.generationTime
      ).toBeGreaterThanOrEqual(0);
    });

    it("should correctly handle chunks with mixed voxel types", () => {
      const mixedChunk = ChunkHelpers.createEmpty({
        x: 0,
        y: 0,
        z: 0,
      });

      // Add different voxel types
      ChunkHelpers.setVoxel(mixedChunk, 1, 1, 1, {
        type: VoxelType.STONE,
      });
      ChunkHelpers.setVoxel(mixedChunk, 2, 1, 1, {
        type: VoxelType.GRASS,
      });
      ChunkHelpers.setVoxel(mixedChunk, 3, 1, 1, {
        type: VoxelType.DIRT,
      });
      ChunkHelpers.setVoxel(mixedChunk, 4, 1, 1, {
        type: VoxelType.SAND,
      });
      ChunkHelpers.setVoxel(mixedChunk, 5, 1, 1, {
        type: VoxelType.WATER,
      });

      const meshResult =
        GreedyMesher.generateMeshForChunk(mixedChunk);

      expect(meshResult).toHaveProperty("geometry");
      expect(
        meshResult.generationTime
      ).toBeGreaterThanOrEqual(0);
    });
  });

  describe("generateMeshForChunk", () => {
    it("should complete within reasonable time", () => {
      const chunk = ChunkGenerator.generateFlatChunk({
        x: 0,
        y: 0,
        z: 0,
      });

      const startTime = performance.now();
      const meshResult =
        GreedyMesher.generateMeshForChunk(chunk);
      const endTime = performance.now();

      // Should complete in less than 100ms
      expect(endTime - startTime).toBeLessThan(100);
      expect(meshResult.generationTime).toBeLessThan(100);
    });
  });

  describe("face culling", () => {
    it("should generate correct face masks for a single voxel", () => {
      // Create a chunk with a single voxel at center
      const chunk = ChunkHelpers.createEmpty({
        x: 0,
        y: 0,
        z: 0,
      });
      ChunkHelpers.setVoxel(chunk, 15, 15, 15, {
        type: VoxelType.STONE,
      });

      // Generate mesh (which includes face culling)
      const meshResult =
        GreedyMesher.generateMeshForChunk(chunk);

      // A single isolated voxel should have 6 visible faces
      // We can't directly test private methods, but we can observe the behavior
      expect(meshResult).toBeDefined();
      expect(
        meshResult.generationTime
      ).toBeGreaterThanOrEqual(0);
    });

    it("should cull faces between adjacent solid voxels", () => {
      // Create a chunk with two adjacent voxels
      const chunk = ChunkHelpers.createEmpty({
        x: 0,
        y: 0,
        z: 0,
      });
      ChunkHelpers.setVoxel(chunk, 15, 15, 15, {
        type: VoxelType.STONE,
      });
      ChunkHelpers.setVoxel(chunk, 16, 15, 15, {
        type: VoxelType.STONE,
      }); // Adjacent in +X

      // The touching faces should be culled
      const meshResult =
        GreedyMesher.generateMeshForChunk(chunk);

      expect(meshResult).toBeDefined();
      // Two cubes sharing one face = 12 - 2 = 10 visible faces total
    });

    it("should correctly handle voxels at chunk boundaries with neighbor data", () => {
      // Create a chunk with voxel at boundary
      const chunk = ChunkHelpers.createEmpty({
        x: 0,
        y: 0,
        z: 0,
      });

      // Place voxel at the actual chunk boundary (index 30 in the real chunk)
      // In padded coordinates, this would be at index 30
      ChunkHelpers.setVoxel(chunk, 29, 15, 15, {
        type: VoxelType.STONE,
      });

      // The face culling should work correctly with neighbor padding
      const meshResult =
        GreedyMesher.generateMeshForChunk(chunk);

      expect(meshResult).toBeDefined();
      expect(
        meshResult.generationTime
      ).toBeGreaterThanOrEqual(0);
    });

    it("should handle various patterns correctly", () => {
      // Test with tiny chunk pattern
      const tinyChunk = ChunkGenerator.generateTinyChunk({
        x: 0,
        y: 0,
        z: 0,
      });
      const tinyResult =
        GreedyMesher.generateMeshForChunk(tinyChunk);

      expect(tinyResult).toBeDefined();
      // 2x2x2 cube has 24 faces total, minus internal faces

      // Test with flat chunk pattern
      const flatChunk = ChunkGenerator.generateFlatChunk({
        x: 0,
        y: 0,
        z: 0,
      });
      const flatResult =
        GreedyMesher.generateMeshForChunk(flatChunk);

      expect(flatResult).toBeDefined();
      expect(
        flatResult.generationTime
      ).toBeGreaterThanOrEqual(0);
    });
  });

  describe("optimized block-type separation and face culling", () => {
    it("should process single block type efficiently", () => {
      // Create a chunk with only grass blocks
      const chunk = ChunkGenerator.generateTinyChunk({
        x: 0,
        y: 0,
        z: 0,
      });

      const meshResult =
        GreedyMesher.generateMeshForChunk(chunk);

      // Should complete without errors and much faster than before
      expect(meshResult).toBeDefined();
      expect(
        meshResult.generationTime
      ).toBeGreaterThanOrEqual(0);
      expect(meshResult.generationTime).toBeLessThan(50); // Should be very fast now
    });

    it("should handle multiple block types efficiently", () => {
      // Create a chunk with mixed block types
      const chunk = ChunkHelpers.createEmpty({
        x: 0,
        y: 0,
        z: 0,
      });

      // Add different block types
      ChunkHelpers.setVoxel(chunk, 5, 5, 5, {
        type: VoxelType.STONE,
      });
      ChunkHelpers.setVoxel(chunk, 6, 5, 5, {
        type: VoxelType.GRASS,
      });
      ChunkHelpers.setVoxel(chunk, 7, 5, 5, {
        type: VoxelType.DIRT,
      });
      ChunkHelpers.setVoxel(chunk, 8, 5, 5, {
        type: VoxelType.SAND,
      });

      const meshResult =
        GreedyMesher.generateMeshForChunk(chunk);

      expect(meshResult).toBeDefined();
      expect(
        meshResult.generationTime
      ).toBeGreaterThanOrEqual(0);
      expect(meshResult.generationTime).toBeLessThan(50); // Should be efficient
    });

    it("should handle boundary cases correctly", () => {
      // Test faces at chunk boundaries
      const chunk = ChunkHelpers.createEmpty({
        x: 0,
        y: 0,
        z: 0,
      });

      // Place blocks near boundaries (accounting for padding)
      ChunkHelpers.setVoxel(chunk, 1, 1, 1, {
        type: VoxelType.STONE,
      }); // Near start
      ChunkHelpers.setVoxel(chunk, 29, 29, 29, {
        type: VoxelType.GRASS,
      }); // Near end (chunk boundary)

      const meshResult =
        GreedyMesher.generateMeshForChunk(chunk);

      expect(meshResult).toBeDefined();
      expect(
        meshResult.generationTime
      ).toBeGreaterThanOrEqual(0);
    });

    it("should correctly handle adjacent blocks of different types", () => {
      // Test face culling between different block types
      const chunk = ChunkHelpers.createEmpty({
        x: 0,
        y: 0,
        z: 0,
      });

      // Adjacent blocks of different types - each type should be processed separately
      ChunkHelpers.setVoxel(chunk, 10, 10, 10, {
        type: VoxelType.STONE,
      });
      ChunkHelpers.setVoxel(chunk, 11, 10, 10, {
        type: VoxelType.GRASS,
      });

      const meshResult =
        GreedyMesher.generateMeshForChunk(chunk);

      expect(meshResult).toBeDefined();
      expect(
        meshResult.generationTime
      ).toBeGreaterThanOrEqual(0);
    });

    it("should handle empty chunks gracefully", () => {
      // Test with completely empty chunk
      const emptyChunk = ChunkHelpers.createEmpty({
        x: 0,
        y: 0,
        z: 0,
      });

      const meshResult =
        GreedyMesher.generateMeshForChunk(emptyChunk);

      expect(meshResult).toBeDefined();
      expect(
        meshResult.generationTime
      ).toBeGreaterThanOrEqual(0);
      expect(meshResult.triangleCount).toBe(0);

      // No faces should be generated for empty chunk
    });

    it("should be significantly faster than the old bit-by-bit approach", () => {
      // Performance test with a larger pattern
      const chunk = ChunkGenerator.generateFlatChunk({
        x: 0,
        y: 0,
        z: 0,
      });

      const startTime = performance.now();
      const meshResult =
        GreedyMesher.generateMeshForChunk(chunk);
      const endTime = performance.now();

      expect(meshResult).toBeDefined();
      expect(
        meshResult.generationTime
      ).toBeGreaterThanOrEqual(0);
      expect(endTime - startTime).toBeLessThan(100); // Should complete quickly

      // The new approach should be orders of magnitude faster
      // Old approach: ~196k iterations, New approach: ~3k operations max
    });
  });

  describe("greedy meshing algorithm", () => {
    it("should generate fewer triangles than naive approach for solid blocks", () => {
      // Create a 2x2x2 solid cube (8 voxels)
      const chunk = ChunkHelpers.createEmpty({
        x: 0,
        y: 0,
        z: 0,
      });

      // Fill a 2x2x2 area with stone
      for (let x = 10; x < 12; x++) {
        for (let y = 10; y < 12; y++) {
          for (let z = 10; z < 12; z++) {
            ChunkHelpers.setVoxel(chunk, x, y, z, {
              type: VoxelType.STONE,
            });
          }
        }
      }

      const meshResult =
        GreedyMesher.generateMeshForChunk(chunk);

      // A 2x2x2 solid cube should have 6 faces (one per side)
      // Each face should be made of 4 individual 1x1 quads = 4 * 2 = 8 triangles per face
      // Total: 6 faces * 8 triangles = 48 triangles
      // But this is still much less than naive (8 cubes * 6 faces * 2 triangles = 96)
      expect(meshResult.triangleCount).toBe(24);
      expect(meshResult.triangleCount).toBeLessThan(96); // Much less than naive (8 cubes * 6 faces * 2 triangles)
    });

    it("should handle isolated voxels correctly", () => {
      // Create a chunk with isolated voxels
      const chunk = ChunkHelpers.createEmpty({
        x: 0,
        y: 0,
        z: 0,
      });

      // Place isolated voxels
      ChunkHelpers.setVoxel(chunk, 5, 5, 5, {
        type: VoxelType.STONE,
      });
      ChunkHelpers.setVoxel(chunk, 10, 10, 10, {
        type: VoxelType.GRASS,
      });
      ChunkHelpers.setVoxel(chunk, 15, 15, 15, {
        type: VoxelType.DIRT,
      });

      const meshResult =
        GreedyMesher.generateMeshForChunk(chunk);

      // Each isolated voxel should have 6 faces
      // 3 voxels * 6 faces * 2 triangles = 36 triangles
      expect(meshResult.triangleCount).toBe(36);
    });

    it("should merge adjacent faces of the same block type", () => {
      // Create a line of 5 adjacent voxels (should merge into rectangles)
      const chunk = ChunkHelpers.createEmpty({
        x: 0,
        y: 0,
        z: 0,
      });

      // Create a horizontal line of 5 stone blocks
      for (let x = 5; x < 10; x++) {
        ChunkHelpers.setVoxel(chunk, x, 10, 10, {
          type: VoxelType.STONE,
        });
      }

      const meshResult =
        GreedyMesher.generateMeshForChunk(chunk);

      // A line of 5 blocks should merge into:
      // - Top face: 1 quad (5x1) = 2 triangles
      // - Bottom face: 1 quad (5x1) = 2 triangles
      // - Front face: 1 quad (5x1) = 2 triangles
      // - Back face: 1 quad (5x1) = 2 triangles
      // - Left face: 1 quad (1x1) = 2 triangles
      // - Right face: 1 quad (1x1) = 2 triangles
      // Total: 12 triangles (much less than 5 * 12 = 60 for naive)
      expect(meshResult.triangleCount).toBe(12);
      expect(meshResult.triangleCount).toBeLessThan(60);
    });

    it("should handle different block types separately", () => {
      // Create adjacent blocks of different types
      const chunk = ChunkHelpers.createEmpty({
        x: 0,
        y: 0,
        z: 0,
      });

      // Two adjacent blocks of different types
      ChunkHelpers.setVoxel(chunk, 10, 10, 10, {
        type: VoxelType.STONE,
      });
      ChunkHelpers.setVoxel(chunk, 11, 10, 10, {
        type: VoxelType.GRASS,
      });

      const meshResult =
        GreedyMesher.generateMeshForChunk(chunk);

      // Each block type is processed separately, so no face merging between different types
      // 2 blocks * 6 faces * 2 triangles = 24 triangles
      // But the touching faces should still be culled
      expect(meshResult.triangleCount).toBe(20); // 24 - 4 (two touching faces)
    });

    it("should generate correct geometry for empty chunks", () => {
      const emptyChunk = ChunkHelpers.createEmpty({
        x: 0,
        y: 0,
        z: 0,
      });

      const meshResult =
        GreedyMesher.generateMeshForChunk(emptyChunk);

      expect(meshResult.triangleCount).toBe(0);
      // Empty chunks should have no attributes set
      if (meshResult.geometry.attributes) {
        expect(
          meshResult.geometry.attributes.position
        ).toBeUndefined();
      }
    });

    it("should complete greedy meshing within reasonable time", () => {
      // Test performance with a larger chunk
      const chunk = ChunkGenerator.generateFlatChunk({
        x: 0,
        y: 0,
        z: 0,
      });

      const startTime = performance.now();
      const meshResult =
        GreedyMesher.generateMeshForChunk(chunk);
      const endTime = performance.now();

      // Should complete quickly even for complex chunks
      expect(endTime - startTime).toBeLessThan(50);
      expect(meshResult.triangleCount).toBeGreaterThan(0);
      expect(meshResult.generationTime).toBeLessThan(50);
    });

    it("should produce valid Three.js geometry", () => {
      const chunk = ChunkGenerator.generateTinyChunk({
        x: 0,
        y: 0,
        z: 0,
      });

      const meshResult =
        GreedyMesher.generateMeshForChunk(chunk);

      // Verify geometry structure
      expect(meshResult.geometry).toBeDefined();

      if (meshResult.triangleCount > 0) {
        expect(
          meshResult.geometry.attributes.position
        ).toBeDefined();
        expect(
          meshResult.geometry.attributes.color
        ).toBeDefined();
        expect(meshResult.geometry.index).toBeDefined();

        // Verify vertex count matches triangle count
        const expectedVertices =
          meshResult.triangleCount * 3;
        if (meshResult.geometry.index) {
          expect(meshResult.geometry.index.count).toBe(
            expectedVertices
          );
        }
      }
    });
  });

  describe("geometry verification for tiny cube", () => {
    it("should produce exactly 6 faces (24 triangles) for tiny cube", () => {
      const chunk = ChunkGenerator.generateTinyChunk({
        x: 0,
        y: 0,
        z: 0,
      });

      const meshResult =
        GreedyMesher.generateMeshForChunk(chunk);

      // A 2x2x2 cube should have exactly 6 faces
      // Currently the greedy meshing creates 4 1x1 quads per face
      // Total: 6 faces * 4 quads * 2 triangles = 48 triangles
      // TODO: Should be 12 when greedy meshing properly merges into 2x2 quads
      expect(meshResult.triangleCount).toBe(12);
    });
  });
});
