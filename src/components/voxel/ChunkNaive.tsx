import React, { useMemo } from "react";
import * as THREE from "three";
import {
  VoxelType,
  CHUNK_SIZE,
  CHUNK_HEIGHT,
} from "./types";

const voxelColors: { [key in VoxelType]: string } = {
  [VoxelType.AIR]: "#87CEEB",       // Sky blue (shouldn't be visible)
  [VoxelType.STONE]: "#696969",     // Dark gray
  [VoxelType.GRASS]: "#228B22",     // Forest green
  [VoxelType.DIRT]: "#8B4513",      // Saddle brown
  [VoxelType.SAND]: "#F4A460",      // Sandy brown
  [VoxelType.WATER]: "#4682B4",     // Steel blue
};

interface ChunkData {
  position: [number, number, number];
  voxels: any[][][];
  lodLevel: number;
  lodScale: number;
}

interface ChunkProps {
  data: ChunkData;
  getVoxelAt?: (worldX: number, worldY: number, worldZ: number) => VoxelType;
  getVoxelAtWithLODCheck?: (
    worldX: number,
    worldY: number,
    worldZ: number,
    lodScale: number
  ) => VoxelType;
  wireframeMode?: boolean;
}

export default function ChunkNaive({
  data,
  getVoxelAt,
  getVoxelAtWithLODCheck,
  wireframeMode = false,
}: ChunkProps) {
  const { geometry, faceCount } = useMemo(() => {
    const vertices: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];
    const normals: number[] = [];
    let vertexIndex = 0;
    let faceCount = 0;

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
      console.warn("Invalid voxel data for chunk:", data.position);
      return {
        geometry: new THREE.BufferGeometry(),
        faceCount: 0,
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

    // Helper to add a single face quad
    const addFace = (
      x: number,
      y: number,
      z: number,
      material: VoxelType,
      direction: number
    ) => {
      // Calculate world position with LOD scaling
      const baseWorldX = data.position[0] * CHUNK_SIZE + x * lodScale;
      const baseWorldY = data.position[1] * CHUNK_SIZE + y * lodScale;
      const baseWorldZ = data.position[2] * CHUNK_SIZE + z * lodScale;

      const color = new THREE.Color(voxelColors[material]);
      let v1: [number, number, number],
        v2: [number, number, number],
        v3: [number, number, number],
        v4: [number, number, number];
      let normal: [number, number, number];

      // Generate vertices based on face direction - each face is 1x1 voxel
      switch (direction) {
        case 0: // +X (right face)
          v1 = [baseWorldX + lodScale, baseWorldY, baseWorldZ];
          v2 = [baseWorldX + lodScale, baseWorldY + lodScale, baseWorldZ];
          v3 = [baseWorldX + lodScale, baseWorldY + lodScale, baseWorldZ + lodScale];
          v4 = [baseWorldX + lodScale, baseWorldY, baseWorldZ + lodScale];
          normal = [1, 0, 0];
          break;
        case 1: // -X (left face)
          v1 = [baseWorldX, baseWorldY, baseWorldZ + lodScale];
          v2 = [baseWorldX, baseWorldY + lodScale, baseWorldZ + lodScale];
          v3 = [baseWorldX, baseWorldY + lodScale, baseWorldZ];
          v4 = [baseWorldX, baseWorldY, baseWorldZ];
          normal = [-1, 0, 0];
          break;
        case 2: // +Y (top face)
          v1 = [baseWorldX, baseWorldY + lodScale, baseWorldZ + lodScale];
          v2 = [baseWorldX + lodScale, baseWorldY + lodScale, baseWorldZ + lodScale];
          v3 = [baseWorldX + lodScale, baseWorldY + lodScale, baseWorldZ];
          v4 = [baseWorldX, baseWorldY + lodScale, baseWorldZ];
          normal = [0, 1, 0];
          break;
        case 3: // -Y (bottom face)
          v1 = [baseWorldX, baseWorldY, baseWorldZ];
          v2 = [baseWorldX + lodScale, baseWorldY, baseWorldZ];
          v3 = [baseWorldX + lodScale, baseWorldY, baseWorldZ + lodScale];
          v4 = [baseWorldX, baseWorldY, baseWorldZ + lodScale];
          normal = [0, -1, 0];
          break;
        case 4: // +Z (front face)
          v1 = [baseWorldX + lodScale, baseWorldY, baseWorldZ + lodScale];
          v2 = [baseWorldX + lodScale, baseWorldY + lodScale, baseWorldZ + lodScale];
          v3 = [baseWorldX, baseWorldY + lodScale, baseWorldZ + lodScale];
          v4 = [baseWorldX, baseWorldY, baseWorldZ + lodScale];
          normal = [0, 0, 1];
          break;
        case 5: // -Z (back face)
          v1 = [baseWorldX, baseWorldY, baseWorldZ];
          v2 = [baseWorldX, baseWorldY + lodScale, baseWorldZ];
          v3 = [baseWorldX + lodScale, baseWorldY + lodScale, baseWorldZ];
          v4 = [baseWorldX + lodScale, baseWorldY, baseWorldZ];
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
      faceCount += 2; // 2 triangles per face
    };

    // Generate faces for all solid voxels - NAIVE APPROACH (no optimization)
    for (let x = 0; x < chunkWidth; x++) {
      for (let y = 0; y < chunkHeight; y++) {
        for (let z = 0; z < chunkWidth; z++) {
          const voxel = getVoxelLocal(x, y, z);
          if (voxel === VoxelType.AIR) continue;

          // Check each face direction and generate individual faces
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

            // Generate face if neighbor is air (basic face culling only)
            if (neighborVoxel === VoxelType.AIR) {
              addFace(x, y, z, voxel, check.dir);
            }
          }
        }
      }
    }

    console.log(
      `NAIVE Chunk [${data.position[0]},${data.position[2]}]: ${faceCount} triangles (${faceCount/2} faces)`
    );

    // Create buffer geometry
    const geometry = new THREE.BufferGeometry();

    if (vertices.length > 0) {
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(vertices), 3)
      );
      geometry.setAttribute(
        "color",
        new THREE.BufferAttribute(new Float32Array(colors), 3)
      );
      geometry.setAttribute(
        "normal",
        new THREE.BufferAttribute(new Float32Array(normals), 3)
      );
      geometry.setIndex(
        new THREE.BufferAttribute(new Uint16Array(indices), 1)
      );
    }

    return {
      geometry,
      faceCount,
    };
  }, [data, getVoxelAt, getVoxelAtWithLODCheck, wireframeMode]);

  if (faceCount === 0) {
    return null;
  }

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshLambertMaterial
        vertexColors={!wireframeMode}
        wireframe={wireframeMode}
        color={wireframeMode ? "#ff0000" : undefined} // Red wireframe for naive
      />
    </mesh>
  );
}