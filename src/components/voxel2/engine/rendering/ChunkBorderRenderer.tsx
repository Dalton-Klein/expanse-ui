import React from "react";
import * as THREE from "three";
import { ChunkData } from "../../types";
import { CHUNK_SIZE } from "../TerrainConfig";

interface ChunkBorderRendererProps {
  chunks: ChunkData[];
  enabled: boolean;
  borderColor?: string;
  lineWidth?: number;
}

export default function ChunkBorderRenderer({
  chunks,
  enabled,
  borderColor = "#ffaa00", // Orange color for visibility
  lineWidth = 2,
}: ChunkBorderRendererProps) {
  // Generate wireframe geometry for chunk borders
  const borderGeometry = React.useMemo(() => {
    if (!enabled || chunks.length === 0) {
      return null;
    }

    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const indices: number[] = [];
    let vertexIndex = 0;

    // Create wireframe cube for each chunk
    for (const chunk of chunks) {
      // chunk.position is already in world coordinates from TerrainGenerator
      const chunkWorldX = chunk.position.x;
      const chunkWorldY = chunk.position.y;
      const chunkWorldZ = chunk.position.z;

      // Define the 8 corners of the chunk cube
      const corners = [
        // Bottom face
        [chunkWorldX, chunkWorldY, chunkWorldZ],
        [chunkWorldX + CHUNK_SIZE, chunkWorldY, chunkWorldZ],
        [chunkWorldX + CHUNK_SIZE, chunkWorldY, chunkWorldZ + CHUNK_SIZE],
        [chunkWorldX, chunkWorldY, chunkWorldZ + CHUNK_SIZE],
        // Top face
        [chunkWorldX, chunkWorldY + CHUNK_SIZE, chunkWorldZ],
        [chunkWorldX + CHUNK_SIZE, chunkWorldY + CHUNK_SIZE, chunkWorldZ],
        [chunkWorldX + CHUNK_SIZE, chunkWorldY + CHUNK_SIZE, chunkWorldZ + CHUNK_SIZE],
        [chunkWorldX, chunkWorldY + CHUNK_SIZE, chunkWorldZ + CHUNK_SIZE],
      ];

      // Add vertices
      for (const corner of corners) {
        vertices.push(corner[0], corner[1], corner[2]);
      }

      // Define the 12 edges of the cube (each edge connects two vertices)
      const edges = [
        // Bottom face edges
        [0, 1], [1, 2], [2, 3], [3, 0],
        // Top face edges
        [4, 5], [5, 6], [6, 7], [7, 4],
        // Vertical edges
        [0, 4], [1, 5], [2, 6], [3, 7],
      ];

      // Add indices for line segments
      for (const edge of edges) {
        indices.push(vertexIndex + edge[0], vertexIndex + edge[1]);
      }

      vertexIndex += 8; // Each cube has 8 vertices
    }

    // Set geometry attributes
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3)
    );
    geometry.setIndex(indices);

    return geometry;
  }, [chunks, enabled]);

  // Don't render if disabled or no geometry
  if (!enabled || !borderGeometry) {
    return null;
  }

  return (
    <group name="chunk-borders">
      <lineSegments geometry={borderGeometry}>
        <lineBasicMaterial
          color={borderColor}
          linewidth={lineWidth}
          transparent
          opacity={0.8}
        />
      </lineSegments>
    </group>
  );
}