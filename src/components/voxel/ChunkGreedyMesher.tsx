import React, { useMemo } from "react";
import * as THREE from "three";
import {
  ChunkData,
  VoxelType,
  CHUNK_SIZE,
  CHUNK_HEIGHT,
} from "./types";

const voxelColors: { [key in VoxelType]: string } = {
  [VoxelType.AIR]: "#000000",
  [VoxelType.GRASS]: "#4ade80",
  [VoxelType.DIRT]: "#8b4513",
  [VoxelType.STONE]: "#808080",
  [VoxelType.SAND]: "#f4d03f",
  [VoxelType.WATER]: "#3498db",
};

interface ChunkProps {
  data: ChunkData;
  getVoxelAt?: (
    worldX: number,
    worldY: number,
    worldZ: number
  ) => VoxelType;
  getVoxelAtWithLODCheck?: (
    worldX: number,
    worldY: number,
    worldZ: number,
    requestingChunkLOD: number
  ) => VoxelType;
  wireframeMode?: boolean;
}

interface Face {
  x: number;
  y: number;
  z: number;
  material: VoxelType;
  direction: number; // 0=+X, 1=-X, 2=+Y, 3=-Y, 4=+Z, 5=-Z
}

interface Quad {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  material: VoxelType;
  direction: number;
}

export default function ChunkGreedyMesher({
  data,
  getVoxelAt,
  getVoxelAtWithLODCheck,
  wireframeMode = false,
}: ChunkProps) {
  const { geometry, faceCount, originalFaceCount } =
    useMemo(() => {
      const vertices: number[] = [];
      const indices: number[] = [];
      const colors: number[] = [];
      const normals: number[] = [];
      let vertexIndex = 0;

      // Get LOD information with safety checks
      const lodScale = data.lodScale || 1;
      const chunkWidth = data.lodScale
        ? Math.ceil(CHUNK_SIZE / lodScale)
        : CHUNK_SIZE;
      const chunkHeight = data.lodScale
        ? Math.ceil(CHUNK_HEIGHT / lodScale)
        : CHUNK_HEIGHT;

      // Safety check for voxel array
      if (!data.voxels || !Array.isArray(data.voxels)) {
        console.warn(
          "Invalid voxel data for chunk:",
          data.position
        );
        return {
          geometry: new THREE.BufferGeometry(),
          faceCount: 0,
          originalFaceCount: 0,
        };
      }

      // Helper to check if voxel exists (with cross-chunk support and LOD awareness)
      const getVoxelLocal = (
        x: number,
        y: number,
        z: number
      ): VoxelType => {
        // If within chunk bounds, use local data
        if (
          x >= 0 &&
          x < chunkWidth &&
          y >= 0 &&
          y < chunkHeight &&
          z >= 0 &&
          z < chunkWidth
        ) {
          // Ensure the voxel array exists at this position
          if (
            data.voxels[x] &&
            data.voxels[x][y] &&
            data.voxels[x][y][z]
          ) {
            return data.voxels[x][y][z].type;
          }
          return VoxelType.AIR;
        }

        // Outside chunk bounds - checking neighboring chunks
        const isAtHorizontalChunkBoundary =
          x < 0 ||
          x >= chunkWidth ||
          z < 0 ||
          z >= chunkWidth;

        // For horizontal chunk boundaries (X/Z), be conservative for LOD transitions
        if (isAtHorizontalChunkBoundary) {
          // At horizontal chunk boundaries, always return AIR to force face rendering
          // This ensures visual continuity at LOD transitions
          return VoxelType.AIR;
        }

        // For Y-axis (vertical) checks, always do cross-chunk lookup
        if (getVoxelAtWithLODCheck) {
          const worldX =
            data.position[0] * CHUNK_SIZE + x * lodScale;
          const worldY =
            data.position[1] * CHUNK_SIZE + y * lodScale;
          const worldZ =
            data.position[2] * CHUNK_SIZE + z * lodScale;

          return getVoxelAtWithLODCheck(
            worldX,
            worldY,
            worldZ,
            lodScale
          );
        }

        // Fallback to AIR if no cross-chunk lookup available
        return VoxelType.AIR;
      };

      // Step 1: Extract all exposed faces
      const faces: Face[] = [];
      let originalFaceCount = 0;

      for (let x = 0; x < chunkWidth; x++) {
        for (let y = 0; y < chunkHeight; y++) {
          for (let z = 0; z < chunkWidth; z++) {
            const voxel = getVoxelLocal(x, y, z);
            if (voxel === VoxelType.AIR) continue;

            // Check each face direction
            const faceChecks = [
              { dx: 1, dy: 0, dz: 0, dir: 0 }, // +X (right)
              { dx: -1, dy: 0, dz: 0, dir: 1 }, // -X (left)
              { dx: 0, dy: 1, dz: 0, dir: 2 }, // +Y (top)
              { dx: 0, dy: -1, dz: 0, dir: 3 }, // -Y (bottom)
              { dx: 0, dy: 0, dz: 1, dir: 4 }, // +Z (front)
              { dx: 0, dy: 0, dz: -1, dir: 5 }, // -Z (back)
            ];

            for (const check of faceChecks) {
              const neighborVoxel = getVoxelLocal(
                x + check.dx,
                y + check.dy,
                z + check.dz
              );

              if (neighborVoxel === VoxelType.AIR) {
                faces.push({
                  x,
                  y,
                  z,
                  material: voxel,
                  direction: check.dir,
                });
                originalFaceCount++;
              }
            }
          }
        }
      }

      // Step 2: Greedy meshing - merge faces into larger quads
      const quads: Quad[] = [];
      const processedFaces = new Set<string>();

      // Process faces by direction and material
      for (let dir = 0; dir < 6; dir++) {
        const directionFaces = faces.filter(
          (f) =>
            f.direction === dir &&
            !processedFaces.has(
              `${f.x},${f.y},${f.z},${f.direction}`
            )
        );

        // Group by material
        const materialGroups = new Map<VoxelType, Face[]>();
        for (const face of directionFaces) {
          if (!materialGroups.has(face.material)) {
            materialGroups.set(face.material, []);
          }
          materialGroups.get(face.material)!.push(face);
        }

        // Process each material group
        for (const [
          material,
          materialFaces,
        ] of materialGroups) {
          // Create a 2D grid for this direction and material
          const processedInDir = new Set<string>();

          for (const face of materialFaces) {
            const faceKey = `${face.x},${face.y},${face.z},${face.direction}`;
            if (
              processedFaces.has(faceKey) ||
              processedInDir.has(faceKey)
            )
              continue;

            // Try to grow a rectangle from this face
            const quad = growQuad(
              face,
              materialFaces,
              processedInDir,
              chunkWidth,
              chunkHeight,
              dir
            );
            quads.push(quad);

            // Mark all faces in this quad as processed
            markQuadFacesAsProcessed(
              quad,
              processedFaces,
              processedInDir,
              dir
            );
          }
        }
      }

      // Step 3: Generate geometry from quads
      const addQuad = (quad: Quad) => {
        const {
          x,
          y,
          z,
          width,
          height,
          material,
          direction,
        } = quad;

        // Calculate world position with LOD scaling (chunk origin + voxel position)
        const baseWorldX =
          data.position[0] * CHUNK_SIZE + x * lodScale;
        const baseWorldY =
          data.position[1] * CHUNK_SIZE + y * lodScale;
        const baseWorldZ =
          data.position[2] * CHUNK_SIZE + z * lodScale;

        const color = new THREE.Color(
          voxelColors[material]
        );
        let v1: [number, number, number],
          v2: [number, number, number],
          v3: [number, number, number],
          v4: [number, number, number];
        let normal: [number, number, number];

        // Quad dimensions in world space
        const quadWidth = width * lodScale;
        const quadHeight = height * lodScale;

        // Generate vertices based on face direction
        // Key insight: faces are ON the surface of voxels, so position accordingly
        switch (direction) {
          case 0: // +X (right face) - face is on the +X side of the voxel
            v1 = [
              baseWorldX + lodScale,
              baseWorldY,
              baseWorldZ,
            ];
            v2 = [
              baseWorldX + lodScale,
              baseWorldY + quadHeight,
              baseWorldZ,
            ];
            v3 = [
              baseWorldX + lodScale,
              baseWorldY + quadHeight,
              baseWorldZ + quadWidth,
            ];
            v4 = [
              baseWorldX + lodScale,
              baseWorldY,
              baseWorldZ + quadWidth,
            ];
            normal = [1, 0, 0];
            break;
          case 1: // -X (left face) - face is on the -X side of the voxel
            v1 = [
              baseWorldX,
              baseWorldY,
              baseWorldZ + quadWidth,
            ];
            v2 = [
              baseWorldX,
              baseWorldY + quadHeight,
              baseWorldZ + quadWidth,
            ];
            v3 = [
              baseWorldX,
              baseWorldY + quadHeight,
              baseWorldZ,
            ];
            v4 = [baseWorldX, baseWorldY, baseWorldZ];
            normal = [-1, 0, 0];
            break;
          case 2: // +Y (top face) - face is on the +Y side of the voxel
            v1 = [
              baseWorldX,
              baseWorldY + lodScale,
              baseWorldZ + quadWidth,
            ];
            v2 = [
              baseWorldX + quadWidth,
              baseWorldY + lodScale,
              baseWorldZ + quadWidth,
            ];
            v3 = [
              baseWorldX + quadWidth,
              baseWorldY + lodScale,
              baseWorldZ,
            ];
            v4 = [
              baseWorldX,
              baseWorldY + lodScale,
              baseWorldZ,
            ];
            normal = [0, 1, 0];
            break;
          case 3: // -Y (bottom face) - face is on the -Y side of the voxel
            v1 = [baseWorldX, baseWorldY, baseWorldZ];
            v2 = [
              baseWorldX + quadWidth,
              baseWorldY,
              baseWorldZ,
            ];
            v3 = [
              baseWorldX + quadWidth,
              baseWorldY,
              baseWorldZ + quadWidth,
            ];
            v4 = [
              baseWorldX,
              baseWorldY,
              baseWorldZ + quadWidth,
            ];
            normal = [0, -1, 0];
            break;
          case 4: // +Z (front face) - face is on the +Z side of the voxel
            v1 = [
              baseWorldX + quadWidth,
              baseWorldY,
              baseWorldZ + lodScale,
            ];
            v2 = [
              baseWorldX + quadWidth,
              baseWorldY + quadHeight,
              baseWorldZ + lodScale,
            ];
            v3 = [
              baseWorldX,
              baseWorldY + quadHeight,
              baseWorldZ + lodScale,
            ];
            v4 = [
              baseWorldX,
              baseWorldY,
              baseWorldZ + lodScale,
            ];
            normal = [0, 0, 1];
            break;
          case 5: // -Z (back face) - face is on the -Z side of the voxel
            v1 = [baseWorldX, baseWorldY, baseWorldZ];
            v2 = [
              baseWorldX,
              baseWorldY + quadHeight,
              baseWorldZ,
            ];
            v3 = [
              baseWorldX + quadWidth,
              baseWorldY + quadHeight,
              baseWorldZ,
            ];
            v4 = [
              baseWorldX + quadWidth,
              baseWorldY,
              baseWorldZ,
            ];
            normal = [0, 0, -1];
            break;
          default:
            return;
        }

        // Add vertices
        vertices.push(...v1, ...v2, ...v3, ...v4);

        // Add colors (4 vertices)
        for (let i = 0; i < 4; i++) {
          colors.push(color.r, color.g, color.b);
        }

        // Add normals (4 vertices)
        for (let i = 0; i < 4; i++) {
          normals.push(...normal);
        }

        // Add indices (2 triangles)
        indices.push(
          vertexIndex,
          vertexIndex + 1,
          vertexIndex + 2,
          vertexIndex,
          vertexIndex + 2,
          vertexIndex + 3
        );
        vertexIndex += 4;
      };

      // Generate all quads
      let totalQuads = 0;
      let totalOptimizedFaces = 0;

      for (const quad of quads) {
        addQuad(quad);
        totalQuads++;
        totalOptimizedFaces += quad.width * quad.height;
      }

      // Create buffer geometry
      const geometry = new THREE.BufferGeometry();

      if (vertices.length > 0) {
        geometry.setAttribute(
          "position",
          new THREE.BufferAttribute(
            new Float32Array(vertices),
            3
          )
        );
        geometry.setAttribute(
          "color",
          new THREE.BufferAttribute(
            new Float32Array(colors),
            3
          )
        );
        geometry.setAttribute(
          "normal",
          new THREE.BufferAttribute(
            new Float32Array(normals),
            3
          )
        );
        geometry.setIndex(
          new THREE.BufferAttribute(
            new Uint16Array(indices),
            1
          )
        );
      }

      const finalFaceCount = indices.length / 3;

      return {
        geometry,
        faceCount: finalFaceCount,
        originalFaceCount,
      };
    }, [
      data,
      getVoxelAt,
      getVoxelAtWithLODCheck,
      wireframeMode,
    ]);

  // Helper function to grow a quad from a starting face
  function growQuad(
    startFace: Face,
    availableFaces: Face[],
    processed: Set<string>,
    chunkWidth: number,
    chunkHeight: number,
    direction: number
  ): Quad {
    const { x, y, z, material } = startFace;

    // Create a lookup for quick face checking
    const faceMap = new Map<string, Face>();
    for (const face of availableFaces) {
      if (
        face.material === material &&
        face.direction === direction
      ) {
        const key = `${face.x},${face.y},${face.z}`;
        faceMap.set(key, face);
      }
    }

    // Determine which dimensions to grow based on face direction
    // For each face direction, we can grow in the 2 dimensions perpendicular to the face normal
    let growDim1: "x" | "y" | "z",
      growDim2: "x" | "y" | "z";
    let maxGrowDim1: number, maxGrowDim2: number;

    switch (direction) {
      case 0:
      case 1: // X faces (±X): can grow in Y and Z directions
        growDim1 = "z";
        growDim2 = "y";
        maxGrowDim1 = chunkWidth;
        maxGrowDim2 = chunkHeight;
        break;
      case 2:
      case 3: // Y faces (±Y): can grow in X and Z directions
        growDim1 = "x";
        growDim2 = "z";
        maxGrowDim1 = chunkWidth;
        maxGrowDim2 = chunkWidth;
        break;
      case 4:
      case 5: // Z faces (±Z): can grow in X and Y directions
        growDim1 = "x";
        growDim2 = "y";
        maxGrowDim1 = chunkWidth;
        maxGrowDim2 = chunkHeight;
        break;
      default:
        return {
          x,
          y,
          z,
          width: 1,
          height: 1,
          material,
          direction,
        };
    }

    // Try to grow width first (growDim1)
    let width = 1;
    while (width < maxGrowDim1) {
      const testCoords = { x, y, z };
      testCoords[growDim1] = testCoords[growDim1] + width; // Check the next position in growDim1

      // Check bounds
      if (testCoords[growDim1] >= maxGrowDim1) break;

      const key = `${testCoords.x},${testCoords.y},${testCoords.z}`;
      const processedKey = `${testCoords.x},${testCoords.y},${testCoords.z},${direction}`;

      // Check if this face exists and hasn't been processed
      if (
        !faceMap.has(key) ||
        processed.has(processedKey)
      ) {
        break;
      }
      width++;
    }

    // Try to grow height (growDim2)
    let height = 1;
    while (height < maxGrowDim2) {
      const testRowStart = { x, y, z };
      testRowStart[growDim2] =
        testRowStart[growDim2] + height; // Check the next row in growDim2

      // Check bounds
      if (testRowStart[growDim2] >= maxGrowDim2) break;

      // Check if entire row is available
      let rowAvailable = true;
      for (let w = 0; w < width; w++) {
        const testCoords = { ...testRowStart };
        testCoords[growDim1] = testCoords[growDim1] + w;

        const key = `${testCoords.x},${testCoords.y},${testCoords.z}`;
        const processedKey = `${testCoords.x},${testCoords.y},${testCoords.z},${direction}`;

        if (
          !faceMap.has(key) ||
          processed.has(processedKey)
        ) {
          rowAvailable = false;
          break;
        }
      }

      if (!rowAvailable) break;
      height++;
    }

    return { x, y, z, width, height, material, direction };
  }

  // Helper function to mark all faces in a quad as processed
  function markQuadFacesAsProcessed(
    quad: Quad,
    globalProcessed: Set<string>,
    localProcessed: Set<string>,
    direction: number
  ) {
    const { x, y, z, width, height } = quad;

    // Determine which dimensions the quad spans (must match growQuad logic)
    let growDim1: "x" | "y" | "z",
      growDim2: "x" | "y" | "z";

    switch (direction) {
      case 0:
      case 1: // X faces: width=Z, height=Y
        growDim1 = "z";
        growDim2 = "y";
        break;
      case 2:
      case 3: // Y faces: width=X, height=Z
        growDim1 = "x";
        growDim2 = "z";
        break;
      case 4:
      case 5: // Z faces: width=X, height=Y
        growDim1 = "x";
        growDim2 = "y";
        break;
      default:
        return;
    }

    // Mark all faces in the quad as processed
    for (let h = 0; h < height; h++) {
      for (let w = 0; w < width; w++) {
        const coords = { x, y, z };
        coords[growDim1] += w; // width spans growDim1
        coords[growDim2] += h; // height spans growDim2

        const key = `${coords.x},${coords.y},${coords.z},${direction}`;
        globalProcessed.add(key);
        localProcessed.add(key);
      }
    }
  }

  if (faceCount === 0) {
    return null;
  }

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshLambertMaterial
        vertexColors={!wireframeMode}
        wireframe={wireframeMode}
        color={wireframeMode ? "#00ff00" : undefined}
      />
    </mesh>
  );
}
