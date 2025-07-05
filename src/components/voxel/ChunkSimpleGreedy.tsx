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

export default function ChunkSimpleGreedy({
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
      };
    }

    // Helper to add a face
    const addFace = (
      v1: [number, number, number],
      v2: [number, number, number],
      v3: [number, number, number],
      v4: [number, number, number],
      color: string,
      normal: [number, number, number]
    ) => {
      // Add vertices
      vertices.push(...v1, ...v2, ...v3, ...v4);

      // Add colors (4 vertices)
      const colorObj = new THREE.Color(color);
      for (let i = 0; i < 4; i++) {
        colors.push(colorObj.r, colorObj.g, colorObj.b);
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
      // For LOD boundaries, be extra conservative and don't cull faces
      const isAtChunkBoundary =
        x < 0 ||
        x >= chunkWidth ||
        z < 0 ||
        z >= chunkWidth;

      if (isAtChunkBoundary) {
        // At chunk boundaries, always return AIR to force face rendering
        // This ensures visual continuity at LOD transitions
        return VoxelType.AIR;
      }

      // For Y-axis (vertical) checks, still do cross-chunk lookup
      if (getVoxelAtWithLODCheck) {
        const worldX =
          data.position[0] * CHUNK_SIZE + x * lodScale;
        const worldY = y * lodScale;
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

    // Generate faces for each voxel (using LOD dimensions)
    for (let x = 0; x < chunkWidth; x++) {
      for (let y = 0; y < chunkHeight; y++) {
        for (let z = 0; z < chunkWidth; z++) {
          const voxel = getVoxelLocal(x, y, z);
          if (voxel === VoxelType.AIR) continue;

          // Calculate world position with LOD scaling
          const worldX =
            data.position[0] * CHUNK_SIZE + x * lodScale;
          const worldY =
            data.position[1] * CHUNK_SIZE + y * lodScale;
          const worldZ =
            data.position[2] * CHUNK_SIZE + z * lodScale;
          const color = voxelColors[voxel];

          // Each LOD voxel is rendered as a cube of size lodScale

          // Top face (+Y) - Fixed winding order
          if (
            getVoxelLocal(x, y + 1, z) === VoxelType.AIR
          ) {
            addFace(
              [
                worldX,
                worldY + lodScale,
                worldZ + lodScale,
              ],
              [
                worldX + lodScale,
                worldY + lodScale,
                worldZ + lodScale,
              ],
              [
                worldX + lodScale,
                worldY + lodScale,
                worldZ,
              ],
              [worldX, worldY + lodScale, worldZ],
              color,
              [0, 1, 0]
            );
          }

          // Bottom face (-Y) - Fixed winding order
          if (
            getVoxelLocal(x, y - 1, z) === VoxelType.AIR
          ) {
            addFace(
              [worldX, worldY, worldZ],
              [worldX + lodScale, worldY, worldZ],
              [
                worldX + lodScale,
                worldY,
                worldZ + lodScale,
              ],
              [worldX, worldY, worldZ + lodScale],
              color,
              [0, -1, 0]
            );
          }

          // Right face (+X)
          if (
            getVoxelLocal(x + 1, y, z) === VoxelType.AIR
          ) {
            addFace(
              [worldX + lodScale, worldY, worldZ],
              [
                worldX + lodScale,
                worldY + lodScale,
                worldZ,
              ],
              [
                worldX + lodScale,
                worldY + lodScale,
                worldZ + lodScale,
              ],
              [
                worldX + lodScale,
                worldY,
                worldZ + lodScale,
              ],
              color,
              [1, 0, 0]
            );
          }

          // Left face (-X)
          if (
            getVoxelLocal(x - 1, y, z) === VoxelType.AIR
          ) {
            addFace(
              [worldX, worldY, worldZ + lodScale],
              [
                worldX,
                worldY + lodScale,
                worldZ + lodScale,
              ],
              [worldX, worldY + lodScale, worldZ],
              [worldX, worldY, worldZ],
              color,
              [-1, 0, 0]
            );
          }

          // Front face (+Z) - Fixed winding order
          if (
            getVoxelLocal(x, y, z + 1) === VoxelType.AIR
          ) {
            addFace(
              [
                worldX + lodScale,
                worldY,
                worldZ + lodScale,
              ],
              [
                worldX + lodScale,
                worldY + lodScale,
                worldZ + lodScale,
              ],
              [
                worldX,
                worldY + lodScale,
                worldZ + lodScale,
              ],
              [worldX, worldY, worldZ + lodScale],
              color,
              [0, 0, 1]
            );
          }

          // Back face (-Z) - Fixed winding order
          if (
            getVoxelLocal(x, y, z - 1) === VoxelType.AIR
          ) {
            addFace(
              [worldX, worldY, worldZ],
              [worldX, worldY + lodScale, worldZ],
              [
                worldX + lodScale,
                worldY + lodScale,
                worldZ,
              ],
              [worldX + lodScale, worldY, worldZ],
              color,
              [0, 0, -1]
            );
          }
        }
      }
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

    const faceCount = indices.length / 3;

    return { geometry, faceCount };
  }, [data, getVoxelAt, getVoxelAtWithLODCheck, wireframeMode]);

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
