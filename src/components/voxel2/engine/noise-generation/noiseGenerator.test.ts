import { NoiseGenerator } from "./noiseGenerator";
import { ChunkHelpers } from "../chunk-generation/ChunkHelpers";
import {
  VoxelType,
  ChunkData,
  TerrainConfig,
  GenerationAlgorithm,
  MeshingAlgorithm,
  DebugPattern,
} from "../../types";
import { CHUNK_SIZE } from "../TerrainConfig";

describe("NoiseGenerator", () => {
  // Create a simple terrain config for testing
  const createTestConfig = (): TerrainConfig => ({
    renderDistance: 1,
    worldHeight: 120,
    chunkSize: 30,
    voxelSize: 1,
    lod: {
      enabled: false,
      level1Distance: 4,
      level2Distance: 6,
    },
    greedyMeshing: {
      enabled: true,
      algorithm: MeshingAlgorithm.BINARY_GREEDY,
      crossChunkCulling: true,
    },
    generation: {
      algorithm: GenerationAlgorithm.NOISE,
      debugPattern: DebugPattern.TINY,
      seed: 12345, // Fixed seed for consistent testing
      noise: {
        continental: {
          enabled: true,
          scale: 0.002,
          amplitude: 20, // Lower amplitude for more predictable results
          octaves: 1,
          persistence: 0.5,
        },
        regional: {
          enabled: false, // Disable for simpler testing
          scale: 0.011,
          amplitude: 0,
          octaves: 1,
          persistence: 0.6,
        },
        local: {
          enabled: false, // Disable for simpler testing
          scale: 0.08,
          amplitude: 0,
          octaves: 1,
          persistence: 0.4,
        },
        baseHeight: 10,
        mapSize: 1,
      },
    },
    performance: {
      maxChunksPerFrame: 2,
      enableWorkers: false,
    },
    debug: {
      showChunkBorders: false,
      showLODColors: false,
      enableNaiveComparison: true,
    },
  });

  // Helper function to check if padding areas have correct voxel types
  const checkPaddingArea = (
    chunk: ChunkData,
    paddingArea: "x0" | "x31" | "z0" | "z31",
    expectedType: VoxelType,
    testName: string
  ): void => {
    const CHUNK_SIZE_P = CHUNK_SIZE + 2;
    let violations: string[] = [];

    switch (paddingArea) {
      case "x0":
        // Check x=0 padding
        for (let y = 0; y < CHUNK_SIZE_P; y++) {
          for (let z = 0; z < CHUNK_SIZE_P; z++) {
            const voxel = ChunkHelpers.getVoxel(
              chunk,
              0,
              y,
              z
            );
            if (voxel && voxel.type !== expectedType) {
              violations.push(
                `x=0 at (0,${y},${z}): expected ${
                  VoxelType[expectedType]
                }, got ${VoxelType[voxel.type]}`
              );
            }
          }
        }
        break;
      case "x31":
        // Check x=31 padding
        for (let y = 0; y < CHUNK_SIZE_P; y++) {
          for (let z = 0; z < CHUNK_SIZE_P; z++) {
            const voxel = ChunkHelpers.getVoxel(
              chunk,
              31,
              y,
              z
            );
            if (voxel && voxel.type !== expectedType) {
              violations.push(
                `x=31 at (31,${y},${z}): expected ${
                  VoxelType[expectedType]
                }, got ${VoxelType[voxel.type]}`
              );
            }
          }
        }
        break;
      case "z0":
        // Check z=0 padding
        for (let x = 0; x < CHUNK_SIZE_P; x++) {
          for (let y = 0; y < CHUNK_SIZE_P; y++) {
            const voxel = ChunkHelpers.getVoxel(
              chunk,
              x,
              y,
              0
            );
            if (voxel && voxel.type !== expectedType) {
              violations.push(
                `z=0 at (${x},${y},0): expected ${
                  VoxelType[expectedType]
                }, got ${VoxelType[voxel.type]}`
              );
            }
          }
        }
        break;
      case "z31":
        // Check z=31 padding
        for (let x = 0; x < CHUNK_SIZE_P; x++) {
          for (let y = 0; y < CHUNK_SIZE_P; y++) {
            const voxel = ChunkHelpers.getVoxel(
              chunk,
              x,
              y,
              31
            );
            if (voxel && voxel.type !== expectedType) {
              violations.push(
                `z=31 at (${x},${y},31): expected ${
                  VoxelType[expectedType]
                }, got ${VoxelType[voxel.type]}`
              );
            }
          }
        }
        break;
    }

    if (violations.length > 0) {
      fail(
        `${testName} - ${paddingArea} padding violations (showing first 5):\n${violations
          .slice(0, 5)
          .join("\n")}`
      );
    }
  };

  // Helper function to count non-air voxels in padding area
  const countNonAirInPadding = (
    chunk: ChunkData,
    paddingArea: "x0" | "x31" | "z0" | "z31"
  ): number => {
    const CHUNK_SIZE_P = CHUNK_SIZE + 2;
    let count = 0;

    switch (paddingArea) {
      case "x0":
        for (let y = 0; y < CHUNK_SIZE_P; y++) {
          for (let z = 0; z < CHUNK_SIZE_P; z++) {
            const voxel = ChunkHelpers.getVoxel(
              chunk,
              0,
              y,
              z
            );
            if (voxel && voxel.type !== VoxelType.AIR)
              count++;
          }
        }
        break;
      case "x31":
        for (let y = 0; y < CHUNK_SIZE_P; y++) {
          for (let z = 0; z < CHUNK_SIZE_P; z++) {
            const voxel = ChunkHelpers.getVoxel(
              chunk,
              31,
              y,
              z
            );
            if (voxel && voxel.type !== VoxelType.AIR)
              count++;
          }
        }
        break;
      case "z0":
        for (let x = 0; x < CHUNK_SIZE_P; x++) {
          for (let y = 0; y < CHUNK_SIZE_P; y++) {
            const voxel = ChunkHelpers.getVoxel(
              chunk,
              x,
              y,
              0
            );
            if (voxel && voxel.type !== VoxelType.AIR)
              count++;
          }
        }
        break;
      case "z31":
        for (let x = 0; x < CHUNK_SIZE_P; x++) {
          for (let y = 0; y < CHUNK_SIZE_P; y++) {
            const voxel = ChunkHelpers.getVoxel(
              chunk,
              x,
              y,
              31
            );
            if (voxel && voxel.type !== VoxelType.AIR)
              count++;
          }
        }
        break;
    }

    return count;
  };

  beforeEach(() => {
    // Initialize noise generator with test seed
    NoiseGenerator.initialize(12345);
  });

  describe("West Edge Chunks (gridPosition.x === 0)", () => {
    it("should leave x=0 padding as air", () => {
      const config = createTestConfig();
      const chunk = NoiseGenerator.generateNoiseChunk(
        { x: 0, y: 0, z: 0 },
        config,
        { x: 0, z: 1 }, // West edge, not north edge
        2
      );

      // x=0 padding should be all air
      const nonAirCount = countNonAirInPadding(chunk, "x0");
      expect(nonAirCount).toBe(0);
    });

    it("should populate x=31 padding with terrain data", () => {
      const config = createTestConfig();
      const chunk = NoiseGenerator.generateNoiseChunk(
        { x: 0, y: 0, z: 0 },
        config,
        { x: 0, z: 1 }, // West edge, not north edge
        2
      );

      // x=31 padding should have some terrain data (unless all above landscape)
      const nonAirCount = countNonAirInPadding(
        chunk,
        "x31"
      );
      expect(nonAirCount).toBeGreaterThan(0);
    });

    it("should populate core chunk area with terrain data", () => {
      const config = createTestConfig();
      const chunk = NoiseGenerator.generateNoiseChunk(
        { x: 0, y: 0, z: 0 },
        config,
        { x: 0, z: 1 }, // West edge, not north edge
        2
      );

      // Check that core area (x=1-30, z=1-30) has terrain data
      let nonAirCount = 0;
      for (let x = 1; x <= 30; x++) {
        for (let z = 1; z <= 30; z++) {
          for (let y = 0; y < 32; y++) {
            const voxel = ChunkHelpers.getVoxel(
              chunk,
              x,
              y,
              z
            );
            if (voxel && voxel.type !== VoxelType.AIR) {
              nonAirCount++;
            }
          }
        }
      }
      expect(nonAirCount).toBeGreaterThan(0);
    });
  });

  describe("North Edge Chunks (gridPosition.z === 0)", () => {
    it("should leave z=0 padding as air", () => {
      const config = createTestConfig();
      const chunk = NoiseGenerator.generateNoiseChunk(
        { x: 0, y: 0, z: 0 },
        config,
        { x: 1, z: 0 }, // North edge, not west edge
        2
      );

      // z=0 padding should be all air
      const nonAirCount = countNonAirInPadding(chunk, "z0");
      expect(nonAirCount).toBe(0);
    });

    it("should populate z=31 padding with terrain data", () => {
      const config = createTestConfig();
      const chunk = NoiseGenerator.generateNoiseChunk(
        { x: 0, y: 0, z: 0 },
        config,
        { x: 1, z: 0 }, // North edge, not west edge
        2
      );

      // z=31 padding should have some terrain data (unless all above landscape)
      const nonAirCount = countNonAirInPadding(
        chunk,
        "z31"
      );
      expect(nonAirCount).toBeGreaterThan(0);
    });

    it("should populate core chunk area with terrain data", () => {
      const config = createTestConfig();
      const chunk = NoiseGenerator.generateNoiseChunk(
        { x: 0, y: 0, z: 0 },
        config,
        { x: 1, z: 0 }, // North edge, not west edge
        2
      );

      // Check that core area (x=1-30, z=1-30) has terrain data
      let nonAirCount = 0;
      for (let x = 1; x <= 30; x++) {
        for (let z = 1; z <= 30; z++) {
          for (let y = 0; y < 32; y++) {
            const voxel = ChunkHelpers.getVoxel(
              chunk,
              x,
              y,
              z
            );
            if (voxel && voxel.type !== VoxelType.AIR) {
              nonAirCount++;
            }
          }
        }
      }
      expect(nonAirCount).toBeGreaterThan(0);
    });
  });

  describe("Northwest Corner Chunk (gridPosition.x === 0 && gridPosition.z === 0)", () => {
    it("should leave both x=0 and z=0 padding as air", () => {
      const config = createTestConfig();
      const chunk = NoiseGenerator.generateNoiseChunk(
        { x: 0, y: 0, z: 0 },
        config,
        { x: 0, z: 0 }, // Northwest corner
        2
      );

      // Both x=0 and z=0 padding should be all air
      const x0NonAirCount = countNonAirInPadding(
        chunk,
        "x0"
      );
      const z0NonAirCount = countNonAirInPadding(
        chunk,
        "z0"
      );

      expect(x0NonAirCount).toBe(0);
      expect(z0NonAirCount).toBe(0);
    });

    it("should populate x=31 and z=31 padding with terrain data", () => {
      const config = createTestConfig();
      const chunk = NoiseGenerator.generateNoiseChunk(
        { x: 0, y: 0, z: 0 },
        config,
        { x: 0, z: 0 }, // Northwest corner
        2
      );

      // x=31 and z=31 padding should have some terrain data
      const x31NonAirCount = countNonAirInPadding(
        chunk,
        "x31"
      );
      const z31NonAirCount = countNonAirInPadding(
        chunk,
        "z31"
      );

      expect(x31NonAirCount).toBeGreaterThan(0);
      expect(z31NonAirCount).toBeGreaterThan(0);
    });
  });

  describe("Interior Chunks (gridPosition.x > 0 && gridPosition.z > 0)", () => {
    it("should populate all padding areas with terrain data", () => {
      const config = createTestConfig();
      const chunk = NoiseGenerator.generateNoiseChunk(
        { x: 30, y: 0, z: 30 },
        config,
        { x: 1, z: 1 }, // Interior chunk
        3
      );

      // All padding areas should have some terrain data (unless above landscape)
      const x0NonAirCount = countNonAirInPadding(
        chunk,
        "x0"
      );
      const x31NonAirCount = countNonAirInPadding(
        chunk,
        "x31"
      );
      const z0NonAirCount = countNonAirInPadding(
        chunk,
        "z0"
      );
      const z31NonAirCount = countNonAirInPadding(
        chunk,
        "z31"
      );

      expect(x0NonAirCount).toBeGreaterThan(0);
      expect(x31NonAirCount).toBeGreaterThan(0);
      expect(z0NonAirCount).toBeGreaterThan(0);
      expect(z31NonAirCount).toBeGreaterThan(0);
    });

    it("should populate core chunk area with terrain data", () => {
      const config = createTestConfig();
      const chunk = NoiseGenerator.generateNoiseChunk(
        { x: 30, y: 0, z: 30 },
        config,
        { x: 1, z: 1 }, // Interior chunk
        3
      );

      // Check that core area (x=1-30, z=1-30) has terrain data
      let nonAirCount = 0;
      for (let x = 1; x <= 30; x++) {
        for (let z = 1; z <= 30; z++) {
          for (let y = 0; y < 32; y++) {
            const voxel = ChunkHelpers.getVoxel(
              chunk,
              x,
              y,
              z
            );
            if (voxel && voxel.type !== VoxelType.AIR) {
              nonAirCount++;
            }
          }
        }
      }
      expect(nonAirCount).toBeGreaterThan(0);
    });
  });

  describe("Above Landscape Height", () => {
    it("should keep voxels above terrain height as air regardless of padding", () => {
      const config = createTestConfig();
      // Use a high Y position to test above landscape
      const chunk = NoiseGenerator.generateNoiseChunk(
        { x: 0, y: 90, z: 0 }, // High Y position
        config,
        { x: 1, z: 1 }, // Interior chunk
        2
      );

      // Count total non-air voxels - should be very few or zero at high altitude
      let nonAirCount = 0;
      for (let x = 0; x < 32; x++) {
        for (let z = 0; z < 32; z++) {
          for (let y = 0; y < 32; y++) {
            const voxel = ChunkHelpers.getVoxel(
              chunk,
              x,
              y,
              z
            );
            if (voxel && voxel.type !== VoxelType.AIR) {
              nonAirCount++;
            }
          }
        }
      }

      // At high altitude, most voxels should be air
      const totalVoxels = 32 * 32 * 32;
      const airPercentage =
        ((totalVoxels - nonAirCount) / totalVoxels) * 100;
      expect(airPercentage).toBeGreaterThan(90); // At least 90% should be air
    });
  });

  describe("Edge Detection Logic", () => {
    it("should correctly identify west edge chunks", () => {
      const config = createTestConfig();

      // Test multiple west edge positions
      const westEdgePositions = [
        { gridPos: { x: 0, z: 0 }, expected: "west edge" },
        { gridPos: { x: 0, z: 1 }, expected: "west edge" },
        { gridPos: { x: 0, z: 2 }, expected: "west edge" },
      ];

      westEdgePositions.forEach(({ gridPos, expected }) => {
        const chunk = NoiseGenerator.generateNoiseChunk(
          { x: gridPos.x * 30, y: 0, z: gridPos.z * 30 },
          config,
          gridPos,
          3
        );

        const x0NonAirCount = countNonAirInPadding(
          chunk,
          "x0"
        );
        expect(x0NonAirCount).toBe(0); // x=0 should be air for west edge
      });
    });

    it("should correctly identify north edge chunks", () => {
      const config = createTestConfig();

      // Test multiple north edge positions
      const northEdgePositions = [
        { gridPos: { x: 0, z: 0 }, expected: "north edge" },
        { gridPos: { x: 1, z: 0 }, expected: "north edge" },
        { gridPos: { x: 2, z: 0 }, expected: "north edge" },
      ];

      northEdgePositions.forEach(
        ({ gridPos, expected }) => {
          const chunk = NoiseGenerator.generateNoiseChunk(
            { x: gridPos.x * 30, y: 0, z: gridPos.z * 30 },
            config,
            gridPos,
            3
          );

          const z0NonAirCount = countNonAirInPadding(
            chunk,
            "z0"
          );
          expect(z0NonAirCount).toBe(0); // z=0 should be air for north edge
        }
      );
    });
  });
});
