import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useDebugData } from "./DebugInfoProvider";

export default function DebugUpdater() {
  const { camera, gl } = useThree();
  const { updateDebugData } = useDebugData();
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());

  useFrame((state, delta) => {
    frameCount.current++;
    const now = performance.now();
    
    // Calculate FPS every second
    if (now - lastTime.current >= 1000) {
      const fps = Math.round((frameCount.current * 1000) / (now - lastTime.current));
      frameCount.current = 0;
      lastTime.current = now;
      
      // Get camera position
      const pos = camera.position;
      
      // Get camera rotation in degrees
      const rot = {
        x: THREE.MathUtils.radToDeg(camera.rotation.x),
        y: THREE.MathUtils.radToDeg(camera.rotation.y),
        z: THREE.MathUtils.radToDeg(camera.rotation.z)
      };

      // Calculate direction vector
      const direction = new THREE.Vector3(0, 0, -1);
      direction.applyQuaternion(camera.quaternion);

      // Determine cardinal direction based on horizontal angle
      let cardinalDirection = "North";
      const horizontalAngle = Math.atan2(direction.x, -direction.z);
      const degrees = THREE.MathUtils.radToDeg(horizontalAngle);
      const normalizedDegrees = ((degrees % 360) + 360) % 360;

      if (normalizedDegrees >= 315 || normalizedDegrees < 45) {
        cardinalDirection = "North (-Z)";
      } else if (normalizedDegrees >= 45 && normalizedDegrees < 135) {
        cardinalDirection = "East (+X)";
      } else if (normalizedDegrees >= 135 && normalizedDegrees < 225) {
        cardinalDirection = "South (+Z)";
      } else {
        cardinalDirection = "West (-X)";
      }

      // Get renderer performance info
      const info = gl.info;
      
      updateDebugData({
        position: {
          x: Math.round(pos.x * 100) / 100,
          y: Math.round(pos.y * 100) / 100,
          z: Math.round(pos.z * 100) / 100
        },
        direction: cardinalDirection,
        rotation: {
          x: Math.round(rot.x * 100) / 100,
          y: Math.round(rot.y * 100) / 100,
          z: Math.round(rot.z * 100) / 100
        },
        performance: {
          fps: fps,
          triangles: info.render.triangles,
          drawCalls: info.render.calls,
          memory: Math.round((info.memory.geometries + info.memory.textures) * 100) / 100
        }
      });
    }
  });

  return null; // This component doesn't render anything
}