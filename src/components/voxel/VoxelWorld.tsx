import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import DebugCamera from "./DebugCamera";
import VoxelTerrain from "./VoxelTerrain";
import TestVoxel from "./TestVoxel";
import DebugUpdater from "./DebugUpdater";

export default function VoxelWorld() {
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
        
        {/* Ground plane for reference */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} receiveShadow>
          <planeGeometry args={[200, 200]} />
          <meshStandardMaterial color="#404040" />
        </mesh>
        
        {/* Voxel Terrain */}
        <VoxelTerrain />
      </Suspense>
    </Canvas>
  );
}