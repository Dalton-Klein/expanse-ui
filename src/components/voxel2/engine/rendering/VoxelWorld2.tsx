import React, { useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import * as THREE from "three";
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

// Fog component to apply distance fog to the scene
function FogComponent({ config }: { config: RenderConfig['fog'] }) {
  const { scene } = useThree();
  
  React.useEffect(() => {
    if (config.enabled) {
      scene.fog = new THREE.FogExp2(config.color, config.density);
    } else {
      scene.fog = null;
    }
    
    return () => {
      scene.fog = null;
    };
  }, [scene, config]);
  
  return null;
}

// Main voxel2 world component - clean, debug-first implementation
// TODO: Implement incremental functionality with comprehensive debugging

export default function VoxelWorld2() {
  // Debug-first configuration
  const [renderConfig, setRenderConfig] =
    useState<RenderConfig>({
      wireframe: false,
      showDebugInfo: true,
      terrainPattern: DebugPattern.FLAT,
      ambientOcclusion: true,
      useTextures: true, // Enable textures by default
      fog: {
        enabled: true,
        near: 75,
        far: 650,
        density: 0.001, // Subtle exponential fog density
        color: "#87CEEB", // Sky blue color
      },
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
        camera={{ position: [38, 41, -29], fov: 60 }}
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

        {/* Distance Fog */}
        <FogComponent config={renderConfig.fog} />

        {/* Enhanced Lighting Setup */}
        {/* Reduced ambient for better contrast and depth */}
        <ambientLight intensity={0.3} color="#87CEEB" />
        
        {/* Main sun light - warmer tone, better positioning */}
        <directionalLight
          position={[100, 150, 50]}
          intensity={2.0}
          color="#FFF8DC"
          castShadow
          shadow-mapSize={[4096, 4096]}
          shadow-camera-far={800}
          shadow-camera-left={-200}
          shadow-camera-right={200}
          shadow-camera-top={200}
          shadow-camera-bottom={-200}
          shadow-bias={-0.0001}
        />
        
        {/* Fill light for softer shadows */}
        <directionalLight
          position={[-50, 100, -50]}
          intensity={0.4}
          color="#B0E0E6"
          castShadow={false}
        />
        
        {/* Hemisphere light for natural sky lighting */}
        <hemisphereLight
          color="#9ed4e9"
          groundColor="#8B7355"
          intensity={0.6}
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
