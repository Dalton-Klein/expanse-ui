import React from "react";
import * as THREE from "three";

export default function TestVoxel() {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshLambertMaterial({ color: 0x4ade80 });
  
  return (
    <>
      {/* Single voxel at origin */}
      <mesh position={[0, 5, 0]} geometry={geometry} material={material} castShadow receiveShadow />
      
      {/* Grid of voxels */}
      {Array.from({ length: 5 }, (_, x) =>
        Array.from({ length: 5 }, (_, z) => (
          <mesh
            key={`${x}-${z}`}
            position={[x - 2, 3, z - 2]}
            geometry={geometry}
            material={material}
            castShadow
            receiveShadow
          />
        ))
      )}
    </>
  );
}