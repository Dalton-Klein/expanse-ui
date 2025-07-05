import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { ChunkData, VoxelType, CHUNK_SIZE, CHUNK_HEIGHT } from "./types";
import { GreedyMesher } from "./GreedyMesh";

interface ChunkProps {
  data: ChunkData;
}

export default function ChunkGreedy({ data }: ChunkProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const { geometry, faceCount } = useMemo(() => {
    // Convert voxel data to VoxelType array
    const voxelArray: VoxelType[][][] = [];
    for (let x = 0; x < CHUNK_SIZE; x++) {
      voxelArray[x] = [];
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        voxelArray[x][y] = [];
        for (let z = 0; z < CHUNK_SIZE; z++) {
          voxelArray[x][y][z] = data.voxels[x][y][z].type;
        }
      }
    }

    // Generate greedy mesh
    const mesher = new GreedyMesher(voxelArray, data.position);
    const meshData = mesher.generateMesh();

    // Create buffer geometry
    const geometry = new THREE.BufferGeometry();
    
    if (meshData.vertices.length > 0) {
      geometry.setAttribute('position', new THREE.BufferAttribute(meshData.vertices, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(meshData.colors, 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(meshData.normals, 3));
      geometry.setIndex(new THREE.BufferAttribute(meshData.indices, 1));
    }

    const faceCount = meshData.indices.length / 3;
    console.log(`Chunk [${data.position.join(', ')}]: Generated ${faceCount} faces with greedy meshing`);

    return { geometry, faceCount };
  }, [data]);

  // Don't render if no faces
  if (faceCount === 0) {
    return null;
  }

  return (
    <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
      <meshLambertMaterial vertexColors />
    </mesh>
  );
}