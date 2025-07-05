import React, { useEffect, useRef } from "react";
import ChunkGreedyMesher from "./ChunkGreedyMesher";
import { useChunkManager } from "./ChunkManager";
import { useDebugData } from "./DebugInfoProvider";
import { LODConfig } from "./types";

export default function VoxelTerrain() {
  // Default render distance: minimum 5 chunks in each direction
  const RENDER_DISTANCE = 25; // Will be enforced to minimum 5 in ChunkManager

  // LOD Configuration based on percentages of render distance
  const LOD_CONFIG: LODConfig = {
    level1Distance: Math.floor(RENDER_DISTANCE * 0.6), // Switch to 4x4x4 LOD at 60% (15 chunks)
    level2Distance: Math.floor(RENDER_DISTANCE * 0.8), // Switch to 8x8x8 LOD at 80% (20 chunks)
    level1Scale: 4, // 4x4x4 voxel groups for medium LOD
    level2Scale: 8, // 8x8x8 voxel groups for low LOD
    hysteresis: 1.5, // Buffer distance to prevent LOD flickering
  };

  const { debugData, updateDebugData } = useDebugData();
  const {
    loadedChunks,
    updateChunks,
    getStats,
    getVoxelAt,
    getVoxelAtWithLODCheck,
  } = useChunkManager({
    renderDistance: RENDER_DISTANCE,
    lodConfig: LOD_CONFIG,
  });

  // Track previous camera position to avoid unnecessary updates
  const lastCameraPos = useRef({ x: 0, z: 0 });
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(
    null
  );

  useEffect(() => {
    const { x: cameraX, z: cameraZ } = debugData.position;

    // Optimized movement threshold (increased from 4 to 12 world units)
    const deltaX = Math.abs(
      cameraX - lastCameraPos.current.x
    );
    const deltaZ = Math.abs(
      cameraZ - lastCameraPos.current.z
    );
    const movementThreshold = 12; // Reduced update frequency

    if (
      deltaX > movementThreshold ||
      deltaZ > movementThreshold
    ) {
      // Debounce rapid position changes with 150ms delay
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      updateTimeoutRef.current = setTimeout(() => {
        updateChunks(cameraX, cameraZ);
        lastCameraPos.current = { x: cameraX, z: cameraZ };

        // Log chunk stats for debugging
        const stats = getStats();
        console.log(
          `Dynamic chunks: ${stats.loadedChunks} loaded, ${
            stats.pendingChunks
          } pending (render distance: ${
            stats.renderDistance
          }, worker: ${
            stats.workerActive ? "active" : "inactive"
          })`
        );

        updateTimeoutRef.current = null;
      }, 150);
    }
  }, [debugData.position, updateChunks]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  // Initial chunk loading
  useEffect(() => {
    updateChunks(0, 0); // Start at world origin
  }, [updateChunks]);


  // Update terrain debug data periodically
  useEffect(() => {
    const terrainDebugInterval = setInterval(() => {
      const stats = getStats();

      // Send only terrain data - will be merged with existing debug data
      updateDebugData({
        terrain: {
          renderDistance: stats.renderDistance,
          lod1Distance: stats.lod1Distance,
          lod2Distance: stats.lod2Distance,
          chunksLoaded: stats.loadedChunks,
          chunksInQueue: stats.queuedChunks,
          chunksPending: stats.pendingChunks,
          workerActive: stats.workerActive,
        },
      });
    }, 500); // Update every 500ms

    return () => clearInterval(terrainDebugInterval);
  }, [getStats, updateDebugData]);

  return (
    <group>
      {loadedChunks.map((chunk) => (
        <ChunkGreedyMesher
          key={`${chunk.position[0]},${chunk.position[2]},LOD${chunk.lodLevel},S${chunk.lodScale}`}
          data={chunk}
          getVoxelAt={getVoxelAt}
          getVoxelAtWithLODCheck={getVoxelAtWithLODCheck}
          wireframeMode={debugData.rendering?.wireframeMode || false}
        />
      ))}
    </group>
  );
}
