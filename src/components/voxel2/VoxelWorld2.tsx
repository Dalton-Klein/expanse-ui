import React, { useState } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import DebugPanel from "./debug/DebugPanel";
import NaiveRenderer from "./engine/rendering/NaiveRenderer";
import GreedyMeshRenderer from "./engine/rendering/GreedyMeshRenderer";
import {
  RenderConfig,
  PerformanceMetrics,
  ChunkData,
  DebugPattern,
  TerrainConfig,
  GenerationAlgorithm,
  VoxelType,
  MeshingAlgorithm,
} from "./types";
import {
  CHUNK_SIZE,
  CHUNK_HEIGHT,
} from "./engine/TerrainConfig";
import { ChunkHelpers } from "./engine/chunk-generation/ChunkHelpers";
import { DEFAULT_TERRAIN_CONFIG } from "./engine/TerrainConfig";
import { TerrainGenerator } from "./engine/chunk-generation/TerrainGenerator";
import CameraControls from "./debug/CameraControls";
import CameraTracker from "./debug/CameraTracker";

// Main voxel2 world component - clean, debug-first implementation
// TODO: Implement incremental functionality with comprehensive debugging

export default function VoxelWorld2() {
  // Debug-first configuration
  const [renderConfig, setRenderConfig] =
    useState<RenderConfig>({
      wireframe: false,
      showDebugInfo: true,
      terrainPattern: DebugPattern.FLAT,
    });

  // Master terrain configuration - single source of truth
  const [terrainConfig, setTerrainConfig] =
    useState<TerrainConfig>(DEFAULT_TERRAIN_CONFIG);

  const [performanceMetrics, setPerformanceMetrics] =
    useState<PerformanceMetrics>({
      fps: 0,
      triangles: 0,
      chunks: 0,
    });

  // Camera tracking state for debug panel
  const [cameraData, setCameraData] = useState({
    position: { x: 0, y: 0, z: 0 },
    direction: { compass: "North", face: "Z-", angle: 0 },
  });

  // Generate terrain chunks based on config
  const chunks = React.useMemo(() => {
    if (
      terrainConfig.generation.algorithm ===
      GenerationAlgorithm.DEBUG_PATTERN
    ) {
      return TerrainGenerator.generateChunks(terrainConfig);
    } else {
      // TODO: Implement noise-based terrain generation
      // For now, return empty chunks for noise mode
      return [
        ChunkHelpers.createEmpty({ x: 0, y: 0, z: 0 }),
      ];
    }
  }, [terrainConfig]);

  // Stable callback for mesh generation stats
  const handleMeshGenerated = React.useCallback(
    (stats: {
      chunkCount: number;
      totalTriangles: number;
      avgGenerationTime: number;
    }) => {
      setPerformanceMetrics((prev) => ({
        ...prev,
        chunks: stats.chunkCount,
        triangles: stats.totalTriangles,
      }));
    },
    []
  );

  // Update performance metrics for naive renderer
  React.useEffect(() => {
    if (!terrainConfig.greedyMeshing.enabled) {
      setPerformanceMetrics((prev) => ({
        ...prev,
        chunks: chunks.length,
        triangles: calculateTriangleCount(chunks),
      }));
    }
  }, [chunks, terrainConfig.greedyMeshing.enabled]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
      }}
    >
      {/* Debug Panel Overlay */}
      {renderConfig.showDebugInfo && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            zIndex: 100,
          }}
        >
          <DebugPanel
            config={renderConfig}
            onConfigChange={setRenderConfig}
            terrainConfig={terrainConfig}
            onTerrainConfigChange={setTerrainConfig}
            metrics={performanceMetrics}
            onMetricsUpdate={setPerformanceMetrics}
            cameraData={cameraData}
          />
        </div>
      )}

      {/* 3D Scene */}
      <Canvas
        camera={{ position: [16, 10, 16], fov: 60 }}
        shadows
        gl={{ antialias: true }}
      >
        {/* Camera Controls */}
        <CameraControls
          enabled={true}
          movementSpeed={15}
          mouseSensitivity={0.002}
        />

        {/* Camera Tracker for Debug Panel */}
        <CameraTracker onUpdate={setCameraData} />

        {/* Lighting */}
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[50, 100, 50]}
          intensity={1.5}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-far={500}
          shadow-camera-left={-100}
          shadow-camera-right={100}
          shadow-camera-top={100}
          shadow-camera-bottom={-100}
        />

        {/* Sky */}
        <Sky
          distance={450000}
          sunPosition={[100, 50, 100]}
          inclination={0}
          azimuth={0.25}
        />

        {/* Voxel Rendering */}
        <group>
          {/* Conditional renderer based on terrain configuration */}
          {terrainConfig.greedyMeshing.enabled &&
          terrainConfig.greedyMeshing.algorithm ===
            MeshingAlgorithm.BINARY_GREEDY ? (
            <GreedyMeshRenderer
              chunks={chunks}
              renderingConfig={renderConfig}
              terrainConfig={terrainConfig}
              onMeshGenerated={handleMeshGenerated}
            />
          ) : (
            <NaiveRenderer
              chunks={chunks}
              renderingConfig={renderConfig}
              terrainConfig={terrainConfig}
            />
          )}
        </group>
      </Canvas>
    </div>
  );
}

// Calculate triangle count for performance metrics
function calculateTriangleCount(
  chunks: ChunkData[]
): number {
  let triangleCount = 0;

  chunks.forEach((chunk) => {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
          const voxel = ChunkHelpers.getVoxel(
            chunk,
            x,
            y,
            z
          );
          if (voxel && voxel.type !== VoxelType.AIR) {
            // Each voxel can have up to 6 faces, each face has 2 triangles
            // For now, estimate 3 faces per voxel on average (rough approximation)
            triangleCount += 6; // 3 faces * 2 triangles per face
          }
        }
      }
    }
  });

  return triangleCount;
}

// TODO: Add component utilities:
// - Camera control integration
// - Chunk loading management
// - Debug overlay management
// - Performance optimization
