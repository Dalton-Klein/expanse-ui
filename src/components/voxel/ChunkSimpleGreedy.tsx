import React, { useMemo } from "react";
import * as THREE from "three";
import { ChunkData, VoxelType, CHUNK_SIZE, CHUNK_HEIGHT } from "./types";

const voxelColors: { [key in VoxelType]: string } = {
  [VoxelType.AIR]: "#000000",
  [VoxelType.GRASS]: "#4ade80",
  [VoxelType.DIRT]: "#8b4513", 
  [VoxelType.STONE]: "#808080",
  [VoxelType.SAND]: "#ffd700",
  [VoxelType.WATER]: "#0000ff",
};

interface ChunkProps {
  data: ChunkData;
}

export default function ChunkSimpleGreedy({ data }: ChunkProps) {
  const { geometry, faceCount } = useMemo(() => {
    const vertices: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];
    const normals: number[] = [];
    let vertexIndex = 0;

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
        vertexIndex, vertexIndex + 1, vertexIndex + 2,
        vertexIndex, vertexIndex + 2, vertexIndex + 3
      );
      vertexIndex += 4;
    };

    // Helper to check if voxel exists
    const getVoxel = (x: number, y: number, z: number): VoxelType => {
      if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
        return VoxelType.AIR;
      }
      return data.voxels[x][y][z].type;
    };

    // Generate faces for each voxel
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
          const voxel = getVoxel(x, y, z);
          if (voxel === VoxelType.AIR) continue;

          const worldX = data.position[0] * CHUNK_SIZE + x;
          const worldY = data.position[1] * CHUNK_SIZE + y;
          const worldZ = data.position[2] * CHUNK_SIZE + z;
          const color = voxelColors[voxel];

          // Top face (+Y) - Fixed winding order
          if (getVoxel(x, y + 1, z) === VoxelType.AIR) {
            addFace(
              [worldX, worldY + 1, worldZ + 1],
              [worldX + 1, worldY + 1, worldZ + 1],
              [worldX + 1, worldY + 1, worldZ],
              [worldX, worldY + 1, worldZ],
              color,
              [0, 1, 0]
            );
          }

          // Bottom face (-Y) - Fixed winding order
          if (getVoxel(x, y - 1, z) === VoxelType.AIR) {
            addFace(
              [worldX, worldY, worldZ],
              [worldX + 1, worldY, worldZ],
              [worldX + 1, worldY, worldZ + 1],
              [worldX, worldY, worldZ + 1],
              color,
              [0, -1, 0]
            );
          }

          // Right face (+X)
          if (getVoxel(x + 1, y, z) === VoxelType.AIR) {
            addFace(
              [worldX + 1, worldY, worldZ],
              [worldX + 1, worldY + 1, worldZ],
              [worldX + 1, worldY + 1, worldZ + 1],
              [worldX + 1, worldY, worldZ + 1],
              color,
              [1, 0, 0]
            );
          }

          // Left face (-X)
          if (getVoxel(x - 1, y, z) === VoxelType.AIR) {
            addFace(
              [worldX, worldY, worldZ + 1],
              [worldX, worldY + 1, worldZ + 1],
              [worldX, worldY + 1, worldZ],
              [worldX, worldY, worldZ],
              color,
              [-1, 0, 0]
            );
          }

          // Front face (+Z)
          if (getVoxel(x, y, z + 1) === VoxelType.AIR) {
            addFace(
              [worldX, worldY, worldZ + 1],
              [worldX, worldY + 1, worldZ + 1],
              [worldX + 1, worldY + 1, worldZ + 1],
              [worldX + 1, worldY, worldZ + 1],
              color,
              [0, 0, 1]
            );
          }

          // Back face (-Z)
          if (getVoxel(x, y, z - 1) === VoxelType.AIR) {
            addFace(
              [worldX + 1, worldY, worldZ],
              [worldX + 1, worldY + 1, worldZ],
              [worldX, worldY + 1, worldZ],
              [worldX, worldY, worldZ],
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
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
      geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));
    }

    const faceCount = indices.length / 3;
    console.log(`Chunk [${data.position.join(', ')}]: Generated ${faceCount} faces (simple face culling)`);

    return { geometry, faceCount };
  }, [data]);

  if (faceCount === 0) {
    return null;
  }

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshLambertMaterial vertexColors />
    </mesh>
  );
}