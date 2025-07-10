import React, { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import DebugPanel from "../../debug/DebugPanel";
import NaiveRenderer from "./NaiveRenderer";
import GreedyRenderer from "./GreedyRenderer";
import ChunkBorderRenderer from "./ChunkBorderRenderer";
import {
  RenderConfig,
  PerformanceMetrics,
  DebugPattern,
  TerrainConfig,
  MeshingAlgorithm,
} from "../../types";
import { DEFAULT_TERRAIN_CONFIG } from "../TerrainConfig";
import { TerrainGenerator } from "../chunk-generation/TerrainGenerator";
import CameraControls from "../../debug/CameraControls";
import CameraTracker from "../../debug/CameraTracker";

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
      avgGenerationTime: 0,
    });

  // Camera tracking state for debug panel
  const [cameraData, setCameraData] = useState({
    position: { x: 0, y: 0, z: 0 },
    direction: { compass: "North", face: "Z-", angle: 0 },
  });

  // Stable camera update callback to prevent unnecessary re-renders
  const handleCameraUpdate = React.useCallback(
    (data: {
      position: { x: number; y: number; z: number };
      direction: {
        compass: string;
        face: string;
        angle: number;
      };
    }) => {
      setCameraData(data);
    },
    []
  );

  // Separate FPS update callback to avoid overriding other metrics
  const handleFpsUpdate = React.useCallback(
    (fps: number) => {
      setPerformanceMetrics((prev) => ({
        ...prev,
        fps: fps,
      }));
    },
    []
  );

  // Generate terrain chunks based on config
  const chunks = React.useMemo(() => {
    return TerrainGenerator.generateChunks(terrainConfig);
  }, [terrainConfig]);

  // Stable callback for mesh generation stats
  const handleMeshGenerated = React.useCallback(
    (stats: {
      chunkCount: number;
      totalTriangles: number;
      avgGenerationTime: number;
    }) => {
      console.log("[VoxelWorld2] Updating metrics:", stats);
      setPerformanceMetrics((prev) => ({
        ...prev,
        chunks: stats.chunkCount,
        triangles: stats.totalTriangles,
        avgGenerationTime: stats.avgGenerationTime,
      }));
    },
    []
  );

  // Performance metrics are now handled by the onMeshGenerated callbacks from both renderers

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
            onFpsUpdate={handleFpsUpdate}
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
        <CameraTracker onUpdate={handleCameraUpdate} />

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
            <GreedyRenderer
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
              onMeshGenerated={handleMeshGenerated}
            />
          )}

          {/* Chunk Border Visualization */}
          <ChunkBorderRenderer
            chunks={chunks}
            enabled={terrainConfig.debug.showChunkBorders}
          />
        </group>
      </Canvas>
    </div>
  );
}
