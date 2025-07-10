import * as THREE from "three";
import {
  ChunkData,
  Position3D,
  VoxelType,
  TerrainResult,
  ChunkMeshResult,
} from "../../types";
import { CHUNK_SIZE } from "../TerrainConfig";
import { ChunkHelpers } from "../chunk-generation/ChunkHelpers";
import { ChunkGenerator } from "../chunk-generation/ChunkGenerator";

// Type for axis columns using native 32-bit integers
// Each axis stores columns in different arrangements (same as TanTanDev):
// axisCols[0] (Y-axis): [z][x] - column along Y at position (x,z)
// axisCols[1] (X-axis): [y][z] - column along X at position (y,z)
// axisCols[2] (Z-axis): [y][x] - column along Z at position (x,y)
type AxisColumns = number[][][];

// Type for block-type-separated columns for efficient processing
// blockTypeCols[blockType][axis][z][x] - binary columns for each block type
type BlockTypeColumns = Map<VoxelType, AxisColumns>;

// Greedy quad representing a merged rectangle of faces
interface GreedyQuad {
  blockType: VoxelType;
  faceDirection: number; // 0=+Y, 1=-Y, 2=+X, 3=-X, 4=+Z, 5=-Z
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
}

// GreedyMesher is a class that implements the greedy meshing algorithm and face culling
// It is based on TanTanDevs binary greedy meshing algorithm found here: https://github.com/TanTanDev/binary_greedy_mesher_demo
export class GreedyMesher {
  public static generateMeshForChunk(
    chunk: ChunkData
  ): ChunkMeshResult {
    const startTime = performance.now();

    let result: ChunkMeshResult = {
      geometry: new THREE.BufferGeometry(),
      triangleCount: 0,
      generationTime: 0,
    };

    // 1. Binary Encoding- Convert 3d array chunk data into binary columns separated by block type
    const blockTypeCols =
      this.encodeToBinaryByBlockType(chunk);

    // 2. Face Culling- Cull voxel faces based on adjacency to air, use bitwise operations to find face transitions
    const faceMasksByBlockType =
      this.generateFaceCullingMasksByBlockType(
        blockTypeCols
      );
    // 3. Greedy algorithm- For each 2D binary plane, apply the greedy algorithm
    const greedyQuads = this.generateGreedyQuads(
      faceMasksByBlockType
    );
    // 4. Generate Geometry (And Later Ambient Occlusion)- Convert greedy quads to vertices with proper winding order
    result = this.generateGeometry(greedyQuads);

    const endTime = performance.now();
    result.generationTime = endTime - startTime;

    return result;
  }

  /**
   * 1. Convert 3D voxel data into binary columns separated by block type
   * This eliminates the need for expensive grouping later
   * Based on TanTanDev's binary greedy meshing algorithm
   */
  private static encodeToBinaryByBlockType(
    chunk: ChunkData
  ): BlockTypeColumns {
    // With padding for neighbors: 30 + 2 = 32 (perfect for 32-bit integer operations native to JS)
    const CHUNK_SIZE_P = CHUNK_SIZE + 2; // 32

    const blockTypeCols = new Map<VoxelType, AxisColumns>();

    // Helper function to create empty axis columns
    const createEmptyAxisColumns = (): AxisColumns => [
      Array(CHUNK_SIZE_P)
        .fill(null)
        .map(() => new Array(CHUNK_SIZE_P).fill(0)),
      Array(CHUNK_SIZE_P)
        .fill(null)
        .map(() => new Array(CHUNK_SIZE_P).fill(0)),
      Array(CHUNK_SIZE_P)
        .fill(null)
        .map(() => new Array(CHUNK_SIZE_P).fill(0)),
    ];

    // Process the full 32x32x32 space (including neighbor padding)
    for (let x = 0; x < CHUNK_SIZE_P; x++) {
      for (let y = 0; y < CHUNK_SIZE_P; y++) {
        for (let z = 0; z < CHUNK_SIZE_P; z++) {
          const voxel = ChunkHelpers.getVoxel(
            chunk,
            x,
            y,
            z
          );
          if (voxel && voxel.type !== VoxelType.AIR) {
            // Ensure we have columns for this block type
            if (!blockTypeCols.has(voxel.type)) {
              blockTypeCols.set(
                voxel.type,
                createEmptyAxisColumns()
              );
            }

            const axisCols = blockTypeCols.get(voxel.type)!;
            // Set bit in all 3 axis representations following TanTanDev's pattern
            // Y-axis column at (x,z) - set bit at position y
            axisCols[0][z][x] |= 1 << y;

            // X-axis column at (y,z) - set bit at position x
            axisCols[1][y][z] |= 1 << x;

            // Z-axis column at (x,y) - set bit at position z
            axisCols[2][y][x] |= 1 << z;
          }
        }
      }
    }

    return blockTypeCols;
  }

  /**
   * 2. Generate face culling masks for all 6 face directions for each block type
   * A face is visible if there's a solid voxel with air on the adjacent side
   * This includes culling faces between adjacent voxels of the same type
   *
   * @param blockTypeCols Binary encoded voxel columns separated by block type
   * @returns Map of block types to their face masks: [+Y, -Y, +X, -X, +Z, -Z]
   */
  private static generateFaceCullingMasksByBlockType(
    blockTypeCols: BlockTypeColumns
  ): Map<VoxelType, AxisColumns[]> {
    const CHUNK_SIZE_P = CHUNK_SIZE + 2; // 32 (with padding for accurate culling)
    const faceMasksByBlockType = new Map<
      VoxelType,
      AxisColumns[]
    >();

    // First create a combined solid voxel mask for culling
    const solidAxisCols =
      this.createCombinedSolidMask(blockTypeCols);

    // Helper function to create empty face masks (30x30x30 for chunk area only)
    const createEmptyFaceMasks = (): AxisColumns[] => {
      const faceMasks: AxisColumns[] = [];
      for (let i = 0; i < 6; i++) {
        faceMasks.push([
          Array(CHUNK_SIZE)
            .fill(null)
            .map(() => new Array(CHUNK_SIZE).fill(0)),
          Array(CHUNK_SIZE)
            .fill(null)
            .map(() => new Array(CHUNK_SIZE).fill(0)),
          Array(CHUNK_SIZE)
            .fill(null)
            .map(() => new Array(CHUNK_SIZE).fill(0)),
        ]);
      }
      return faceMasks;
    };

    // Process each block type
    for (const [blockType, axisCols] of blockTypeCols) {
      const faceMasks = createEmptyFaceMasks();

      // Y-axis faces (+Y and -Y) - only process chunk area (indices 1-30)
      for (let z = 1; z <= CHUNK_SIZE; z++) {
        for (let x = 1; x <= CHUNK_SIZE; x++) {
          const thisTypeCol = axisCols[0][z][x]; // This block type
          const allSolidCol = solidAxisCols[0][z][x]; // All solid voxels

          // +Y faces: this block type with no solid voxel above
          faceMasks[0][0][z - 1][x - 1] =
            thisTypeCol & ~(allSolidCol >> 1);

          // -Y faces: this block type with no solid voxel below
          faceMasks[1][0][z - 1][x - 1] =
            thisTypeCol & ~(allSolidCol << 1);
        }
      }

      // X-axis faces (+X and -X) - only process chunk area (indices 1-30)
      for (let y = 1; y <= CHUNK_SIZE; y++) {
        for (let z = 1; z <= CHUNK_SIZE; z++) {
          const thisTypeCol = axisCols[1][y][z]; // This block type
          const allSolidCol = solidAxisCols[1][y][z]; // All solid voxels

          // +X faces: this block type with no solid voxel to the right
          faceMasks[2][1][y - 1][z - 1] =
            thisTypeCol & ~(allSolidCol >> 1);

          // -X faces: this block type with no solid voxel to the left
          faceMasks[3][1][y - 1][z - 1] =
            thisTypeCol & ~(allSolidCol << 1);
        }
      }

      // Z-axis faces (+Z and -Z) - only process chunk area (indices 1-30)
      for (let y = 1; y <= CHUNK_SIZE; y++) {
        for (let x = 1; x <= CHUNK_SIZE; x++) {
          const thisTypeCol = axisCols[2][y][x]; // This block type
          const allSolidCol = solidAxisCols[2][y][x]; // All solid voxels

          // +Z faces: this block type with no solid voxel in front
          faceMasks[4][2][y - 1][x - 1] =
            thisTypeCol & ~(allSolidCol >> 1);

          // -Z faces: this block type with no solid voxel behind
          faceMasks[5][2][y - 1][x - 1] =
            thisTypeCol & ~(allSolidCol << 1);
        }
      }

      faceMasksByBlockType.set(blockType, faceMasks);
    }

    // Debug: Print face masks in condensed format
    this.debugFaceMasks(faceMasksByBlockType);

    return faceMasksByBlockType;
  }

  /**
   * Debug helper to print face masks in a condensed binary format
   */
  private static debugFaceMasks(
    faceMasksByBlockType: Map<VoxelType, AxisColumns[]>
  ): void {
    if (false) {
      console.log("=== X-AXIS FACE MASKS DEBUG ===");

      const faceNames = [
        "+Y",
        "-Y",
        "+X",
        "-X",
        "+Z",
        "-Z",
      ];

      for (const [
        blockType,
        faceMasks,
      ] of faceMasksByBlockType) {
        console.log(`\nBlock Type ${blockType}:`);

        // Only show X-axis faces (indices 2 and 3)
        for (let faceDir = 2; faceDir <= 3; faceDir++) {
          const faceName = faceNames[faceDir];
          const axisIndex = Math.floor(faceDir / 2);
          const faceMask = faceMasks[faceDir][axisIndex];

          console.log(`  ${faceName} faces:`);

          let hasData = false;
          for (let i = 0; i < CHUNK_SIZE; i++) {
            for (let j = 0; j < CHUNK_SIZE; j++) {
              const value = faceMask[i][j];
              if (value !== 0) {
                hasData = true;
                const binary = value
                  .toString(2)
                  .padStart(8, "0");
                console.log(
                  `    [${i},${j}]: ${binary} (${value})`
                );
              }
            }
          }

          if (!hasData) {
            console.log(`    (no faces)`);
          }
        }
      }
      console.log("=== END X-AXIS FACE MASKS ===");
    }
  }

  /**
   * Create a combined solid voxel mask for all block types
   * Used for face culling between adjacent voxels of any type
   */
  private static createCombinedSolidMask(
    blockTypeCols: BlockTypeColumns
  ): AxisColumns {
    const CHUNK_SIZE_P = CHUNK_SIZE + 2; // 32

    const solidAxisCols: AxisColumns = [
      Array(CHUNK_SIZE_P)
        .fill(null)
        .map(() => new Array(CHUNK_SIZE_P).fill(0)),
      Array(CHUNK_SIZE_P)
        .fill(null)
        .map(() => new Array(CHUNK_SIZE_P).fill(0)),
      Array(CHUNK_SIZE_P)
        .fill(null)
        .map(() => new Array(CHUNK_SIZE_P).fill(0)),
    ];

    // Combine all block types into a single solid mask
    for (const [blockType, axisCols] of blockTypeCols) {
      for (let axis = 0; axis < 3; axis++) {
        for (let i = 0; i < CHUNK_SIZE_P; i++) {
          for (let j = 0; j < CHUNK_SIZE_P; j++) {
            solidAxisCols[axis][i][j] |=
              axisCols[axis][i][j];
          }
        }
      }
    }

    return solidAxisCols;
  }

  /**
   * 3. Apply greedy algorithm to each 2D binary plane to generate optimized quads
   * Expands rectangles first vertically (height), then horizontally (width)
   * Clears bits as they're merged to avoid duplicate processing
   *
   * @param faceMasksByBlockType Face culling masks for each block type and direction
   * @returns Array of greedy quads ready for geometry generation
   */
  private static generateGreedyQuads(
    faceMasksByBlockType: Map<VoxelType, AxisColumns[]>
  ): GreedyQuad[] {
    const quads: GreedyQuad[] = [];
    const faceNames = ["+Y", "-Y", "+X", "-X", "+Z", "-Z"];
    const quadCounts: number[] = [0, 0, 0, 0, 0, 0];

    // Process each block type separately
    for (const [
      blockType,
      faceMasks,
    ] of faceMasksByBlockType) {
      // Process each of the 6 face directions
      for (let faceDir = 0; faceDir < 6; faceDir++) {
        const faceMask = faceMasks[faceDir];
        const axisIndex = Math.floor(faceDir / 2); // 0=Y-axis, 1=X-axis, 2=Z-axis

        // Create a working copy of the face mask to clear bits as we process them
        const workingMask = this.cloneFaceMask(
          faceMask[axisIndex]
        );

        // Count total set bits before processing
        let totalBits = 0;
        for (let j = 0; j < CHUNK_SIZE; j++) {
          for (let i = 0; i < CHUNK_SIZE; i++) {
            if (workingMask[j][i] !== 0) {
              totalBits += this.countSetBits(
                workingMask[j][i]
              );
            }
          }
        }

        // Only log X-axis faces (+X and -X)
        const isXAxis = faceDir === 2 || faceDir === 3;

        // Apply greedy algorithm to this 2D plane
        const startQuadCount = quads.length;
        this.greedyMesh2D(
          workingMask,
          blockType,
          faceDir,
          quads
        );

        const newQuads = quads.length - startQuadCount;
        quadCounts[faceDir] += newQuads;
      }
    }
    return quads;
  }

  private static countSetBits(n: number): number {
    let count = 0;
    while (n) {
      count += n & 1;
      n >>>= 1;
    }
    return count;
  }

  /**
   * Find all contiguous bit groups in a 32-bit integer
   * Returns array of groups with start position and height
   */
  private static findContiguousBitGroups(
    value: number
  ): Array<{ start: number; height: number }> {
    const groups: Array<{ start: number; height: number }> =
      [];
    let currentStart = -1;
    let currentHeight = 0;

    for (let bit = 0; bit < 32; bit++) {
      if (value & (1 << bit)) {
        if (currentStart === -1) {
          // Start of a new group
          currentStart = bit;
          currentHeight = 1;
        } else {
          // Continue current group
          currentHeight++;
        }
      } else {
        if (currentStart !== -1) {
          // End of current group
          groups.push({
            start: currentStart,
            height: currentHeight,
          });
          currentStart = -1;
          currentHeight = 0;
        }
      }
    }

    // Don't forget the last group if it ends at bit 31
    if (currentStart !== -1) {
      groups.push({
        start: currentStart,
        height: currentHeight,
      });
    }

    return groups;
  }

  /**
   * Apply greedy meshing algorithm to a single 2D binary plane
   * Based on TanTanDev's approach with rectangular expansion
   */
  private static greedyMesh2D(
    mask: number[][],
    blockType: VoxelType,
    faceDirection: number,
    quads: GreedyQuad[]
  ): void {
    const size = CHUNK_SIZE;
    const faceNames = ["+Y", "-Y", "+X", "-X", "+Z", "-Z"];
    const isXAxis =
      faceDirection === 2 || faceDirection === 3;

    // Scan through the 2D plane
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) {
        // Skip if this column has no bits set
        if (mask[j][i] === 0) continue;
        // Find all contiguous bit groups in this column
        const bitGroups = this.findContiguousBitGroups(
          mask[j][i]
        );

        // Process each contiguous group separately
        const quadsToCreate: Array<{
          startPos: number;
          width: number;
          height: number;
          depth: number;
        }> = [];

        for (const group of bitGroups) {
          const startPos = group.start;
          const height = group.height;
          let width = 1;
          let depth = 1;

          // Try to expand in the i direction (width) while maintaining height
          for (let w = i + 1; w < size; w++) {
            let canExpand = true;

            // Check if we can expand to this column with the same height
            for (let h = 0; h < height; h++) {
              if (!(mask[j][w] & (1 << (startPos + h)))) {
                canExpand = false;
                break;
              }
            }

            if (canExpand) {
              width++;
            } else {
              break;
            }
          }

          // Now try to expand in the j direction (depth) while maintaining width and height
          for (let d = j + 1; d < size; d++) {
            let canExpand = true;

            // Check if this entire row has the same pattern
            for (let w = 0; w < width; w++) {
              for (let h = 0; h < height; h++) {
                if (
                  !(mask[d][i + w] & (1 << (startPos + h)))
                ) {
                  canExpand = false;
                  break;
                }
              }
              if (!canExpand) break;
            }

            if (canExpand) {
              depth++;
            } else {
              break;
            }
          }

          quadsToCreate.push({
            startPos,
            width,
            height,
            depth,
          });
        }

        // Now create all quads and clear bits for this position
        for (const quadInfo of quadsToCreate) {
          const { startPos, width, height, depth } =
            quadInfo;

          // Create a quad for this rectangle
          let quadWidth, quadHeight;

          // For Y-axis faces (top/bottom), mask is [z][x], so width=x, depth=z
          // For X-axis faces (left/right), mask is [y][z], so width=z, depth=y
          // For Z-axis faces (front/back), mask is [y][x], so width=x, depth=y
          const axisIndex = Math.floor(faceDirection / 2);
          if (axisIndex === 0) {
            // Y-axis
            quadWidth = width;
            quadHeight = depth;
          } else if (axisIndex === 1) {
            // X-axis
            quadWidth = width;
            quadHeight = depth;
          } else {
            // Z-axis
            quadWidth = width;
            quadHeight = depth;
          }

          const quad = this.createQuadFromMask(
            blockType,
            faceDirection,
            i,
            j,
            startPos,
            quadWidth,
            quadHeight
          );
          quads.push(quad);

          // Clear the bits we just processed to avoid duplicates
          for (let d = 0; d < depth; d++) {
            for (let w = 0; w < width; w++) {
              const beforeClear = mask[j + d][i + w];
              for (let h = 0; h < height; h++) {
                mask[j + d][i + w] &= ~(
                  1 <<
                  (startPos + h)
                );
              }
            }
          }
        }
      }
    }
  }

  /**
   * Find the first set bit in a 32-bit integer
   */
  private static findFirstSetBit(value: number): number {
    for (let i = 0; i < 32; i++) {
      if (value & (1 << i)) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Create a quad from mask coordinates, converting to world coordinates
   */
  private static createQuadFromMask(
    blockType: VoxelType,
    faceDirection: number,
    maskI: number,
    maskJ: number,
    maskPos: number,
    width: number,
    height: number
  ): GreedyQuad {
    // Convert mask coordinates back to world coordinates based on face direction
    // Face directions: 0=+Y, 1=-Y, 2=+X, 3=-X, 4=+Z, 5=-Z
    let x: number, y: number, z: number;

    switch (faceDirection) {
      case 0: // +Y faces: mask[z][x], position=y
      case 1: // -Y faces: mask[z][x], position=y
        x = maskI;
        y = maskPos;
        z = maskJ;
        break;
      case 2: // +X faces: mask[y][z], position=x
      case 3: // -X faces: mask[y][z], position=x
        x = maskPos;
        y = maskJ;
        z = maskI;
        break;
      case 4: // +Z faces: mask[y][x], position=z
      case 5: // -Z faces: mask[y][x], position=z
        x = maskI;
        y = maskJ;
        z = maskPos;
        break;
      default:
        throw new Error(
          `Invalid face direction: ${faceDirection}`
        );
    }

    return {
      blockType,
      faceDirection,
      x,
      y,
      z,
      width,
      height,
    };
  }

  /**
   * Create a deep copy of a 2D face mask for processing
   */
  private static cloneFaceMask(
    mask: number[][]
  ): number[][] {
    return mask.map((row) => [...row]);
  }

  /**
   * 4. Generate Three.js geometry from greedy quads
   * Converts optimized quads to vertices with proper winding order
   */
  private static generateGeometry(
    quads: GreedyQuad[]
  ): ChunkMeshResult {
    const vertices: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];

    let vertexIndex = 0;

    for (const quad of quads) {
      // Generate vertices for this quad based on face direction
      const quadVertices = this.generateQuadVertices(quad);
      // Add vertices
      vertices.push(...quadVertices);

      // Add indices for two triangles (quad = 2 triangles)
      indices.push(
        vertexIndex,
        vertexIndex + 1,
        vertexIndex + 2,
        vertexIndex,
        vertexIndex + 2,
        vertexIndex + 3
      );
      vertexIndex += 4;

      // Add colors for each vertex
      const color = this.getBlockTypeColor(quad.blockType);
      for (let i = 0; i < 4; i++) {
        colors.push(color.r, color.g, color.b);
      }
    }

    // Create Three.js geometry
    const geometry = new THREE.BufferGeometry();

    if (vertices.length > 0) {
      const positionAttribute =
        new THREE.Float32BufferAttribute(vertices, 3);
      const colorAttribute =
        new THREE.Float32BufferAttribute(colors, 3);

      geometry.setAttribute("position", positionAttribute);
      geometry.setAttribute("color", colorAttribute);
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
    }

    return {
      geometry,
      triangleCount: indices.length / 3,
      generationTime: 0, // Will be set by caller
    };
  }

  /**
   * Generate the 4 vertices for a quad based on its face direction
   */
  private static generateQuadVertices(
    quad: GreedyQuad
  ): number[] {
    const { x, y, z, width, height, faceDirection } = quad;
    const vertices: number[] = [];

    // Define quad vertices based on face direction with proper winding order
    switch (faceDirection) {
      case 0: // +Y face (top)
        vertices.push(
          x,
          y,
          z, // Bottom-left
          x,
          y,
          z + height, // Top-left
          x + width,
          y,
          z + height, // Top-right
          x + width,
          y,
          z // Bottom-right
        );
        break;
      case 1: // -Y face (bottom)
        vertices.push(
          x,
          y - 1,
          z + height, // Top-left
          x,
          y - 1,
          z, // Bottom-left
          x + width,
          y - 1,
          z, // Bottom-right
          x + width,
          y - 1,
          z + height // Top-right
        );
        break;
      case 2: // +X face (right)
        vertices.push(
          x,
          y,
          z, // Bottom-left
          x,
          y + height,
          z, // Top-left
          x,
          y + height,
          z + width, // Top-right
          x,
          y,
          z + width // Bottom-right
        );
        break;
      case 3: // -X face (left)
        vertices.push(
          x - 1,
          y + height,
          z, // Top-left
          x - 1,
          y,
          z, // Bottom-left
          x - 1,
          y,
          z + width, // Bottom-right
          x - 1,
          y + height,
          z + width // Top-right
        );
        break;
      case 4: // +Z face (front)
        vertices.push(
          x,
          y,
          z, // Bottom-left
          x + width,
          y,
          z, // Bottom-right
          x + width,
          y + height,
          z, // Top-right
          x,
          y + height,
          z // Top-left
        );
        break;
      case 5: // -Z face (back)
        vertices.push(
          x + width,
          y,
          z - 1, // Bottom-left
          x,
          y,
          z - 1, // Bottom-right
          x,
          y + height,
          z - 1, // Top-right
          x + width,
          y + height,
          z - 1 // Top-left
        );
        break;
    }

    return vertices;
  }

  /**
   * Get color for a block type
   */
  private static getBlockTypeColor(blockType: VoxelType): {
    r: number;
    g: number;
    b: number;
  } {
    switch (blockType) {
      case VoxelType.STONE:
        return { r: 0.5, g: 0.5, b: 0.5 };
      case VoxelType.GRASS:
        return { r: 0.0, g: 0.8, b: 0.0 };
      case VoxelType.DIRT:
        return { r: 0.6, g: 0.4, b: 0.2 };
      case VoxelType.SAND:
        return { r: 1.0, g: 1.0, b: 0.6 };
      case VoxelType.WATER:
        return { r: 0.0, g: 0.4, b: 0.8 };
      default:
        return { r: 1.0, g: 0.0, b: 1.0 }; // Magenta for unknown types
    }
  }

  private static customGreedyQuadGenerator(
    faceMasksByBlockType: Map<VoxelType, AxisColumns[]>
  ): GreedyQuad[] {
    const quads: GreedyQuad[] = [];
    return quads;
  }
}
