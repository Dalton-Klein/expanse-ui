import React, { useMemo } from "react";
import {
  VoxelType,
  CHUNK_SIZE,
  CHUNK_HEIGHT,
} from "./types";
import Chunk from "./Chunk";
import ChunkDebug from "./ChunkDebug";
import ChunkGreedy from "./ChunkGreedy";
import ChunkSimpleGreedy from "./ChunkSimpleGreedy";
import { PerlinNoise } from "./noise";

export default function VoxelTerrain() {
  // Map width in chunks (e.g., 3 = 3x3 grid = 9 chunks total)
  // Change this value to control map size:
  // 1 = 1x1 (1 chunk)
  // 2 = 2x2 (4 chunks)
  // 3 = 3x3 (9 chunks)
  // 5 = 5x5 (25 chunks)
  const MAP_WIDTH_IN_CHUNKS = 4;

  // Generate terrain with Perlin noise
  const chunks = useMemo(() => {
    const chunksArray = [];
    const noise = new PerlinNoise(12345); // Fixed seed for consistent terrain

    // Calculate chunk range to get exact grid size
    const startIdx = -Math.floor(MAP_WIDTH_IN_CHUNKS / 2);
    const endIdx = startIdx + MAP_WIDTH_IN_CHUNKS - 1;
    
    console.log(`Generating ${MAP_WIDTH_IN_CHUNKS}x${MAP_WIDTH_IN_CHUNKS} chunks (${MAP_WIDTH_IN_CHUNKS * MAP_WIDTH_IN_CHUNKS} total)`);
    console.log(`Chunk range: [${startIdx}, ${endIdx}]`);

    for (let cx = startIdx; cx <= endIdx; cx++) {
      for (let cz = startIdx; cz <= endIdx; cz++) {
        // Generate chunk data
        const voxels: any = [];

        for (let x = 0; x < CHUNK_SIZE; x++) {
          voxels[x] = [];
          for (let y = 0; y < CHUNK_HEIGHT; y++) {
            voxels[x][y] = [];
            for (let z = 0; z < CHUNK_SIZE; z++) {
              const worldX = cx * CHUNK_SIZE + x;
              const worldZ = cz * CHUNK_SIZE + z;
              const worldY = y;

              // Generate terrain height using Perlin noise
              const scale = 0.03; // Frequency of terrain features
              const baseHeight = 10; // Base terrain height
              const heightVariation = 15; // Maximum height variation
              
              // Use octave noise for more natural terrain
              const noiseValue = noise.octaveNoise2D(
                worldX * scale, 
                worldZ * scale, 
                4, // octaves
                0.5 // persistence
              );
              
              // Convert noise to height (noise returns -1 to 1, we want positive heights)
              const height = Math.floor(baseHeight + (noiseValue * 0.5 + 0.5) * heightVariation);

              let voxelType = VoxelType.AIR;
              if (worldY < height - 3) {
                voxelType = VoxelType.STONE;
              } else if (worldY < height - 1) {
                voxelType = VoxelType.DIRT;
              } else if (worldY < height) {
                voxelType = VoxelType.GRASS;
              }

              voxels[x][y][z] = { type: voxelType };
            }
          }
        }

        // Count non-air voxels in this chunk
        let voxelCount = 0;
        for (let x = 0; x < CHUNK_SIZE; x++) {
          for (let y = 0; y < CHUNK_HEIGHT; y++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
              if (voxels[x][y][z].type !== VoxelType.AIR) {
                voxelCount++;
              }
            }
          }
        }
        
        console.log(`Chunk [${cx}, ${cz}]: ${voxelCount} voxels`);
        
        chunksArray.push({
          position: [cx, 0, cz] as [number, number, number],
          voxels,
        });
      }
    }

    console.log(`Total chunks generated: ${chunksArray.length}`);
    return chunksArray;
  }, []);

  return (
    <group>
      {chunks.map((chunk, index) => (
        <ChunkSimpleGreedy key={index} data={chunk} />
      ))}
    </group>
  );
}
