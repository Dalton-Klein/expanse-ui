import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import DebugCamera from "./DebugCamera";
import VoxelTerrain from "./VoxelTerrain";
import TestVoxel from "./TestVoxel";
import DebugUpdater from "./DebugUpdater";
import FlatworldTester from "./FlatworldTester";
import { useDebugData } from "./DebugInfoProvider";

export default function VoxelWorld() {
  const { debugData } = useDebugData();

  return (
    <Canvas
      camera={{ position: [10, 200, 30], fov: 60 }}
      shadows
      gl={{ antialias: true }}
    >
      <Suspense fallback={null}>
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
        
        {/* Debug Camera Controller */}
        <DebugCamera />
        
        {/* Debug Data Updater */}
        <DebugUpdater />
        
        {/* Conditional Rendering: Either main terrain OR flatworld tester */}
        {debugData.rendering?.flatworldTesterMode ? (
          /* Flatworld Tester for Greedy Meshing Debug */
          <FlatworldTester 
            wireframeMode={debugData.rendering?.wireframeMode || false}
            pattern={debugData.rendering?.flatworldPattern || "flat"}
          />
        ) : (
          /* Main Voxel Terrain */
          <VoxelTerrain />
        )}
      </Suspense>
    </Canvas>
  );
}