import * as THREE from "three";
import {
  ChunkData,
  VoxelType,
  ChunkMeshResult,
  RenderConfig,
} from "../../types";
import { CHUNK_SIZE } from "../TerrainConfig";
import { ChunkHelpers } from "../chunk-generation/ChunkHelpers";
import { getRGB } from "../rendering/MaterialSystem";

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
    chunk: ChunkData,
    renderConfig?: RenderConfig
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
    // 4. Generate Geometry with Ambient Occlusion- Convert greedy quads to vertices with proper winding order
    result = this.generateGeometry(greedyQuads, chunk, renderConfig);

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
          // CRITICAL BUG FIX: Apply chunk mask to prevent phantom faces outside chunk boundaries
          // 
          // The Problem: Face culling operates on 32-bit data (bits 0-31) that includes padding,
          // but face masks should only contain chunk data (bits 1-30). Without masking, bit 0 
          // (padding position) can be set in face masks, causing phantom faces to be rendered 
          // 1 voxel below the chunk boundary when there's solid neighboring data.
          //
          // The Solution: Mask result to exclude padding bits (0 and 31) while preserving 
          // the padding data for correct neighbor-aware face culling operations.
          const chunkMask = 0x7FFFFFFE; // 01111111111111111111111111111110 (bits 1-30 only)
          faceMasks[1][0][z - 1][x - 1] =
            (thisTypeCol & ~(allSolidCol << 1)) & chunkMask;
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
          // CRITICAL BUG FIX: Apply chunk mask to prevent phantom faces outside chunk boundaries
          // Same issue as -Y faces but for X-axis: padding bits must be excluded from face masks
          const chunkMaskX = 0x7FFFFFFE; // 01111111111111111111111111111110 (bits 1-30 only)
          faceMasks[3][1][y - 1][z - 1] =
            (thisTypeCol & ~(allSolidCol << 1)) & chunkMaskX;
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
          // CRITICAL BUG FIX: Apply chunk mask to prevent phantom faces outside chunk boundaries
          // Same issue as -Y faces but for Z-axis: padding bits must be excluded from face masks
          const chunkMaskZ = 0x7FFFFFFE; // 01111111111111111111111111111110 (bits 1-30 only)
          faceMasks[5][2][y - 1][x - 1] =
            (thisTypeCol & ~(allSolidCol << 1)) & chunkMaskZ;
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
      console.log("=== Y-AXIS FACE MASKS DEBUG ===");

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

        // Only show X-axis faces (indices 0 and 1)
        for (let faceDir = 1; faceDir <= 1; faceDir++) {
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
      console.log("=== END Y-AXIS FACE MASKS ===");
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
    for (const [, axisCols] of blockTypeCols) {
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
    //faceNames = ["+Y", "-Y", "+X", "-X", "+Z", "-Z"];
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
    // faceNames = ["+Y", "-Y", "+X", "-X", "+Z", "-Z"];

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
   * 4. Generate Three.js geometry from greedy quads with ambient occlusion
   * Converts optimized quads to vertices with proper winding order and AO
   */
  private static generateGeometry(
    quads: GreedyQuad[],
    chunk: ChunkData,
    renderConfig?: RenderConfig
  ): ChunkMeshResult {
    const vertices: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];
    const uvs: number[] = [];
    const blockTypes: number[] = []; // Block type attribute for shader

    let vertexIndex = 0;
    
    // Texture repeat counting for debug patterns
    let totalTextureRepeats = 0;
    const quadDetails: string[] = [];

    for (const quad of quads) {
      // Generate vertices and AO values for this quad based on face direction
      const enableAO = renderConfig?.ambientOcclusion !== false; // Default to true if not specified
      const { vertices: quadVertices, aoValues, uvCoords } = this.generateQuadVertices(quad, chunk, enableAO);
      
      // Count texture repeats for this quad (for debug patterns)
      const quadTextureRepeats = quad.width * quad.height;
      totalTextureRepeats += quadTextureRepeats;
      quadDetails.push(`Face${quad.faceDirection}:${quad.width}x${quad.height}=${quadTextureRepeats}`);
      
      // Add vertices
      vertices.push(...quadVertices);
      
      // Add local UV coordinates (0 to width/height for repetition)
      uvs.push(...uvCoords);
      
      // Add block type for each vertex (shader needs this for atlas lookup)
      for (let i = 0; i < 4; i++) {
        blockTypes.push(quad.blockType);
      }

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

      // Add colors for each vertex with AO applied
      const baseColor = this.getBlockTypeColor(quad.blockType);
      for (let i = 0; i < 4; i++) {
        const aoFactor = enableAO ? aoValues[i] : 1.0; // No AO if disabled
        colors.push(
          baseColor.r * aoFactor,
          baseColor.g * aoFactor,
          baseColor.b * aoFactor
        );
      }
    }

    // Create Three.js geometry
    const geometry = new THREE.BufferGeometry();

    if (vertices.length > 0) {
      const positionAttribute =
        new THREE.Float32BufferAttribute(vertices, 3);
      const colorAttribute =
        new THREE.Float32BufferAttribute(colors, 3);
      const uvAttribute =
        new THREE.Float32BufferAttribute(uvs, 2);
      const blockTypeAttribute =
        new THREE.Float32BufferAttribute(blockTypes, 1);

      geometry.setAttribute("position", positionAttribute);
      geometry.setAttribute("color", colorAttribute);
      geometry.setAttribute("uv", uvAttribute);
      geometry.setAttribute("blockType", blockTypeAttribute);
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
    }
    
    // Log texture repeat count for debug patterns (only for small chunks)
    if (quads.length <= 10) { // Only log for small debug patterns
      console.log(`[GreedyMesher] Texture Repeat Count:`, {
        totalQuads: quads.length,
        totalTextureRepeats: totalTextureRepeats,
        quadBreakdown: quadDetails.join(', '),
        expectedFor2x2x2: '6 faces × 4 repeats = 24 total'
      });
    }

    return {
      geometry,
      triangleCount: indices.length / 3,
      generationTime: 0, // Will be set by caller
    };
  }

  /**
   * Calculate ambient occlusion for a vertex by sampling neighboring voxels
   * Returns AO intensity: 0.0 = full occlusion, 1.0 = no occlusion
   */
  private static calculateCornerAO(
    x: number,
    y: number, 
    z: number,
    chunk: ChunkData,
    currentBlockType?: VoxelType
  ): number {
    // Get the voxel at the vertex position to determine context
    const centerVoxel = ChunkHelpers.getVoxel(chunk, Math.floor(x), Math.floor(y), Math.floor(z));
    const contextBlockType = currentBlockType || (centerVoxel ? centerVoxel.type : VoxelType.AIR);
    
    // Special handling for water surfaces - minimal AO to prevent ocean artifacts
    if (contextBlockType === VoxelType.WATER) {
      return this.calculateWaterAO(x, y, z, chunk);
    }
    
    // Corner sampling pattern for better edge detection
    let occlusionWeight = 0;
    let totalWeight = 0;
    
    // Use 3x3 corner sampling pattern instead of 6-directional for better corner detection
    const cornerOffsets = [
      [-0.5, -0.5, -0.5], [-0.5, -0.5, 0.5], [-0.5, 0.5, -0.5], [-0.5, 0.5, 0.5],
      [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5]
    ];
    
    for (const [dx, dy, dz] of cornerOffsets) {
      const sampleX = Math.floor(x + dx);
      const sampleY = Math.floor(y + dy);
      const sampleZ = Math.floor(z + dz);
      
      // Clamp coordinates to chunk boundaries instead of skipping
      // This prevents bright highlights along chunk seams
      const clampedX = Math.max(1, Math.min(30, sampleX));
      const clampedY = Math.max(1, Math.min(30, sampleY));
      const clampedZ = Math.max(1, Math.min(30, sampleZ));
      
      const voxel = ChunkHelpers.getVoxel(chunk, clampedX, clampedY, clampedZ);
      const sampleType = voxel ? voxel.type : VoxelType.AIR;
      
      if (sampleType !== VoxelType.AIR) {
        // Calculate occlusion weight based on block type compatibility
        const weight = this.getOcclusionWeight(contextBlockType, sampleType);
        occlusionWeight += weight * 0.3; // Stronger per-sample impact for visible AO
      }
      totalWeight += 1;
    }
    
    // Calculate AO intensity with block-type specific adjustments
    const occlusionRatio = totalWeight > 0 ? occlusionWeight / totalWeight : 0;
    let aoIntensity = Math.max(0.3, 1.0 - occlusionRatio * 1.2);
    
    // Additional reduction for terrain blocks to prevent over-darkening
    const terrainTypes = [VoxelType.DIRT, VoxelType.GRASS, VoxelType.SAND];
    if (terrainTypes.includes(contextBlockType)) {
      aoIntensity = Math.max(0.4, aoIntensity);
    }
    
    return aoIntensity;
  }
  
  /**
   * Specialized AO calculation for water surfaces to minimize artifacts
   */
  private static calculateWaterAO(x: number, y: number, z: number, chunk: ChunkData): number {
    // Very light AO sampling for water to prevent ocean artifacts
    let occlusionCount = 0;
    let totalSamples = 0;
    
    // Only check immediate horizontal neighbors for water AO
    const waterOffsets = [
      [-1, 0, 0], [1, 0, 0], [0, 0, -1], [0, 0, 1]
    ];
    
    for (const [dx, dy, dz] of waterOffsets) {
      const sampleX = Math.floor(x + dx);
      const sampleY = Math.floor(y + dy);
      const sampleZ = Math.floor(z + dz);
      
      // Clamp coordinates for water AO to maintain consistency
      const clampedX = Math.max(1, Math.min(30, sampleX));
      const clampedY = Math.max(1, Math.min(30, sampleY));
      const clampedZ = Math.max(1, Math.min(30, sampleZ));
      
      const voxel = ChunkHelpers.getVoxel(chunk, clampedX, clampedY, clampedZ);
      const sampleType = voxel ? voxel.type : VoxelType.AIR;
      
      if (sampleType === VoxelType.STONE) {
        occlusionCount += 1; // Only solid stone creates significant water occlusion
      }
      totalSamples += 1;
    }
    
    // Very minimal AO effect for water
    const occlusionRatio = totalSamples > 0 ? occlusionCount / totalSamples : 0;
    return Math.max(0.85, 1.0 - occlusionRatio * 0.15); // Very light AO for water
  }
  
  /**
   * Calculate occlusion weight between two block types
   * Returns how much the neighbor block should occlude the current block
   */
  private static getOcclusionWeight(currentType: VoxelType, neighborType: VoxelType): number {
    // Minimal self-occlusion for water blocks (reduces ocean artifacts)
    if (currentType === VoxelType.WATER && neighborType === VoxelType.WATER) {
      return 0.1; // Very minimal occlusion between water blocks
    }
    
    // Water against terrain - moderate occlusion
    if (currentType === VoxelType.WATER && neighborType !== VoxelType.WATER) {
      return 0.4;
    }
    
    // Strong occlusion between similar terrain types
    const terrainTypes = [VoxelType.DIRT, VoxelType.GRASS, VoxelType.SAND];
    if (terrainTypes.includes(currentType) && terrainTypes.includes(neighborType)) {
      return 0.8; // Strong occlusion between terrain blocks
    }
    
    // Maximum occlusion for solid terrain blocks
    if (neighborType === VoxelType.STONE) {
      return 1.0;
    }
    
    // Default strong occlusion
    return 0.9;
  }

  /**
   * Generate the 4 vertices for a quad based on its face direction
   * Returns object with vertices, AO values, and UV coordinates
   */
  private static generateQuadVertices(
    quad: GreedyQuad,
    chunk: ChunkData,
    enableAO: boolean = true
  ): { vertices: number[]; aoValues: number[]; uvCoords: number[] } {
    const { x, y, z, width, height, faceDirection } = quad;
    const vertices: number[] = [];
    const aoValues: number[] = [];
    const uvCoords: number[] = [];
    
    // Generate local UV coordinates for shader-based repetition
    // These extend beyond 0-1 range to create repetition pattern
    // The shader will use fract() to repeat within atlas bounds
    const u1 = 0;
    const u2 = height;  // For 1x3 quad, this will be 3.0 (swapped)
    const v1 = 0;
    const v2 = width;   // For 1x3 quad, this will be 1.0 (swapped)

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
        
        // Calculate AO for each vertex
        if (enableAO) {
          aoValues.push(
            this.calculateCornerAO(x, y, z, chunk, quad.blockType),
            this.calculateCornerAO(x, y, z + height, chunk, quad.blockType),
            this.calculateCornerAO(x + width, y, z + height, chunk, quad.blockType),
            this.calculateCornerAO(x + width, y, z, chunk, quad.blockType)
          );
        } else {
          aoValues.push(1.0, 1.0, 1.0, 1.0);
        }
        
        // Add UV coordinates with texture repetition for greedy meshing
        uvCoords.push(
          u1, v1, // Bottom-left
          u1, v2, // Top-left
          u2, v2, // Top-right
          u2, v1  // Bottom-right
        );
        
        // Debug logging for local UV coordinates
        if (width > 1 || height > 1) {
          console.log(`[GreedyMesher] Local UV Debug for ${width}x${height} quad:`, {
            blockType: quad.blockType,
            face: faceDirection,
            width, height,
            localUVs: { u1, u2, v1, v2 }
          });
        }
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
        
        if (enableAO) {
          aoValues.push(
            this.calculateCornerAO(x, y - 1, z + height, chunk, quad.blockType),
            this.calculateCornerAO(x, y - 1, z, chunk, quad.blockType),
            this.calculateCornerAO(x + width, y - 1, z, chunk, quad.blockType),
            this.calculateCornerAO(x + width, y - 1, z + height, chunk, quad.blockType)
          );
        } else {
          aoValues.push(1.0, 1.0, 1.0, 1.0);
        }
        
        // Add UV coordinates with texture repetition for greedy meshing
        uvCoords.push(
          u1, v2, // Top-left
          u1, v1, // Bottom-left
          u2, v1, // Bottom-right
          u2, v2  // Top-right
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
        
        if (enableAO) {
          aoValues.push(
            this.calculateCornerAO(x, y, z, chunk, quad.blockType),
            this.calculateCornerAO(x, y + height, z, chunk, quad.blockType),
            this.calculateCornerAO(x, y + height, z + width, chunk, quad.blockType),
            this.calculateCornerAO(x, y, z + width, chunk, quad.blockType)
          );
        } else {
          aoValues.push(1.0, 1.0, 1.0, 1.0);
        }
        
        // Add UV coordinates with texture repetition for greedy meshing
        uvCoords.push(
          u1, v1, // Bottom-left
          u1, v2, // Top-left
          u2, v2, // Top-right
          u2, v1  // Bottom-right
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
        
        if (enableAO) {
          aoValues.push(
            this.calculateCornerAO(x - 1, y + height, z, chunk, quad.blockType),
            this.calculateCornerAO(x - 1, y, z, chunk, quad.blockType),
            this.calculateCornerAO(x - 1, y, z + width, chunk, quad.blockType),
            this.calculateCornerAO(x - 1, y + height, z + width, chunk, quad.blockType)
          );
        } else {
          aoValues.push(1.0, 1.0, 1.0, 1.0);
        }
        
        // Add UV coordinates with texture repetition for greedy meshing
        uvCoords.push(
          u1, v2, // Top-left
          u1, v1, // Bottom-left
          u2, v1, // Bottom-right
          u2, v2  // Top-right
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
        
        if (enableAO) {
          aoValues.push(
            this.calculateCornerAO(x, y, z, chunk, quad.blockType),
            this.calculateCornerAO(x + width, y, z, chunk, quad.blockType),
            this.calculateCornerAO(x + width, y + height, z, chunk, quad.blockType),
            this.calculateCornerAO(x, y + height, z, chunk, quad.blockType)
          );
        } else {
          aoValues.push(1.0, 1.0, 1.0, 1.0);
        }
        
        // Add UV coordinates with texture repetition for greedy meshing
        uvCoords.push(
          u1, v1, // Bottom-left
          u2, v1, // Bottom-right
          u2, v2, // Top-right
          u1, v2  // Top-left
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
        
        if (enableAO) {
          aoValues.push(
            this.calculateCornerAO(x + width, y, z - 1, chunk, quad.blockType),
            this.calculateCornerAO(x, y, z - 1, chunk, quad.blockType),
            this.calculateCornerAO(x, y + height, z - 1, chunk, quad.blockType),
            this.calculateCornerAO(x + width, y + height, z - 1, chunk, quad.blockType)
          );
        } else {
          aoValues.push(1.0, 1.0, 1.0, 1.0);
        }
        
        // Add UV coordinates with texture repetition for greedy meshing
        uvCoords.push(
          u2, v1, // Bottom-left
          u1, v1, // Bottom-right
          u1, v2, // Top-right
          u2, v2  // Top-left
        );
        break;
    }

    return { vertices, aoValues, uvCoords };
  }

  /**
   * Get color for a block type - now uses MaterialSystem as single source of truth
   */
  private static getBlockTypeColor(blockType: VoxelType): {
    r: number;
    g: number;
    b: number;
  } {
    const [r, g, b] = getRGB(blockType);
    return { r, g, b };
  }


}
