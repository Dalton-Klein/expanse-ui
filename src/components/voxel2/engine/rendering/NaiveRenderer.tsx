import React from "react";
import * as THREE from "three";
import {
  ChunkData,
  RenderConfig,
  TerrainConfig,
  VoxelType,
} from "../../types";
import { CHUNK_SIZE } from "../../engine/TerrainConfig";
import { ChunkHelpers } from "../../engine/chunk-generation/ChunkHelpers";

// Naive cube-per-voxel renderer for voxel2
// Simple, reliable baseline renderer for debugging and comparison

interface NaiveRendererProps {
  chunks: ChunkData[];
  renderingConfig: RenderConfig;
  terrainConfig: TerrainConfig;
  onMeshGenerated?: (stats: {
    chunkCount: number;
    totalTriangles: number;
    avgGenerationTime: number;
  }) => void;
}

// Voxel colors for material visualization
const voxelColors: Record<VoxelType, THREE.Color> = {
  [VoxelType.AIR]: new THREE.Color(0x000000),
  [VoxelType.STONE]: new THREE.Color(0x808080),
  [VoxelType.GRASS]: new THREE.Color(0x4caf50),
  [VoxelType.DIRT]: new THREE.Color(0x8d6e63),
  [VoxelType.SAND]: new THREE.Color(0xfdd835),
  [VoxelType.WATER]: new THREE.Color(0x2196f3),
};

export default function NaiveRenderer({
  chunks,
  renderingConfig,
  terrainConfig,
  onMeshGenerated,
}: NaiveRendererProps) {
  // Generate geometry from all chunks with performance tracking
  const meshResults = React.useMemo(() => {
    const startTime = performance.now();

    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];

    // Render each chunk
    chunks.forEach((chunk) => {
      renderChunk(chunk, vertices, normals, colors);
    });

    // Set buffer attributes
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3)
    );
    geometry.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute(normals, 3)
    );
    geometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(colors, 3)
    );

    const endTime = performance.now();
    const totalTriangles = vertices.length / 9; // 3 vertices per triangle, 3 coords per vertex
    const generationTime = endTime - startTime;

    // Log performance for debugging
    console.log(
      `[NaiveRenderer] Generated ${chunks.length} chunks:`,
      {
        totalTriangles,
        generationTime: generationTime.toFixed(3),
      }
    );

    return {
      geometry,
      totalTriangles,
      generationTime,
    };
  }, [chunks]);

  // Report statistics when mesh results change
  React.useEffect(() => {
    if (onMeshGenerated) {
      onMeshGenerated({
        chunkCount: chunks.length,
        totalTriangles: meshResults.totalTriangles,
        avgGenerationTime: chunks.length > 0 ? meshResults.generationTime / chunks.length : 0,
      });
    }
  }, [meshResults, onMeshGenerated, chunks.length]);

  return (
    <group>
      <mesh geometry={meshResults.geometry}>
        <meshLambertMaterial
          wireframe={renderingConfig.wireframe}
          vertexColors={true}
        />
      </mesh>
    </group>
  );
}

// Render a single chunk's voxels
function renderChunk(
  chunk: ChunkData,
  vertices: number[],
  normals: number[],
  colors: number[]
): void {
  const chunkWorldX = chunk.position.x;
  const chunkWorldZ = chunk.position.z;

  for (let x = 1; x <= CHUNK_SIZE; x++) {
    for (let y = 1; y <= CHUNK_SIZE; y++) {
      for (let z = 1; z <= CHUNK_SIZE; z++) {
        const voxel = ChunkHelpers.getVoxel(chunk, x, y, z);

        if (!voxel || voxel.type === VoxelType.AIR) {
          continue;
        }

        // World position for this voxel
        const worldX = chunkWorldX + (x - 1);
        const worldY = y - 1;
        const worldZ = chunkWorldZ + (z - 1);

        // Generate faces for this voxel
        generateVoxelFaces(
          chunk,
          x,
          y,
          z,
          worldX,
          worldY,
          worldZ,
          voxel.type,
          vertices,
          normals,
          colors
        );
      }
    }
  }
}

// Generate faces for a single voxel with simple culling
function generateVoxelFaces(
  chunk: ChunkData,
  localX: number,
  localY: number,
  localZ: number,
  worldX: number,
  worldY: number,
  worldZ: number,
  voxelType: VoxelType,
  vertices: number[],
  normals: number[],
  colors: number[]
): void {
  const color = voxelColors[voxelType];

  // Face checks: only render face if neighbor is air
  const faces = [
    // Right face (+X) - Counter-clockwise when viewed from +X direction
    {
      check: () => isAir(chunk, localX + 1, localY, localZ),
      vertices: [
        worldX + 1,
        worldY,
        worldZ,
        worldX + 1,
        worldY + 1,
        worldZ,
        worldX + 1,
        worldY + 1,
        worldZ + 1,
        worldX + 1,
        worldY,
        worldZ,
        worldX + 1,
        worldY + 1,
        worldZ + 1,
        worldX + 1,
        worldY,
        worldZ + 1,
      ],
      normal: [1, 0, 0],
    },
    // Left face (-X) - Counter-clockwise when viewed from -X direction
    {
      check: () => isAir(chunk, localX - 1, localY, localZ),
      vertices: [
        worldX,
        worldY,
        worldZ + 1,
        worldX,
        worldY + 1,
        worldZ + 1,
        worldX,
        worldY + 1,
        worldZ,
        worldX,
        worldY,
        worldZ + 1,
        worldX,
        worldY + 1,
        worldZ,
        worldX,
        worldY,
        worldZ,
      ],
      normal: [-1, 0, 0],
    },
    // Top face (+Y)
    {
      check: () => isAir(chunk, localX, localY + 1, localZ),
      vertices: [
        worldX,
        worldY + 1,
        worldZ + 1,
        worldX + 1,
        worldY + 1,
        worldZ + 1,
        worldX + 1,
        worldY + 1,
        worldZ,
        worldX,
        worldY + 1,
        worldZ + 1,
        worldX + 1,
        worldY + 1,
        worldZ,
        worldX,
        worldY + 1,
        worldZ,
      ],
      normal: [0, 1, 0],
    },
    // Bottom face (-Y) - Counter-clockwise when viewed from below
    {
      check: () => isAir(chunk, localX, localY - 1, localZ),
      vertices: [
        worldX,
        worldY,
        worldZ,
        worldX + 1,
        worldY,
        worldZ,
        worldX + 1,
        worldY,
        worldZ + 1,
        worldX,
        worldY,
        worldZ,
        worldX + 1,
        worldY,
        worldZ + 1,
        worldX,
        worldY,
        worldZ + 1,
      ],
      normal: [0, -1, 0],
    },
    // Front face (+Z)
    {
      check: () => isAir(chunk, localX, localY, localZ + 1),
      vertices: [
        worldX,
        worldY,
        worldZ + 1,
        worldX + 1,
        worldY,
        worldZ + 1,
        worldX + 1,
        worldY + 1,
        worldZ + 1,
        worldX,
        worldY,
        worldZ + 1,
        worldX + 1,
        worldY + 1,
        worldZ + 1,
        worldX,
        worldY + 1,
        worldZ + 1,
      ],
      normal: [0, 0, 1],
    },
    // Back face (-Z)
    {
      check: () => isAir(chunk, localX, localY, localZ - 1),
      vertices: [
        worldX + 1,
        worldY,
        worldZ,
        worldX,
        worldY,
        worldZ,
        worldX,
        worldY + 1,
        worldZ,
        worldX + 1,
        worldY,
        worldZ,
        worldX,
        worldY + 1,
        worldZ,
        worldX + 1,
        worldY + 1,
        worldZ,
      ],
      normal: [0, 0, -1],
    },
  ];

  faces.forEach((face) => {
    if (face.check()) {
      // Add vertices
      vertices.push(...face.vertices);

      // Add normals (6 vertices per face)
      for (let i = 0; i < 6; i++) {
        normals.push(...face.normal);
      }

      // Add colors (6 vertices per face)
      for (let i = 0; i < 6; i++) {
        colors.push(color.r, color.g, color.b);
      }
    }
  });
}

// Check if a voxel position contains air (or is out of bounds)
function isAir(
  chunk: ChunkData,
  x: number,
  y: number,
  z: number
): boolean {
  const voxel = ChunkHelpers.getVoxel(chunk, x, y, z);
  return !voxel || voxel.type === VoxelType.AIR;
}

// TODO: Add helper functions:
// - Face generation
// - Color assignment
// - Coordinate transformation
// - Debug logging
