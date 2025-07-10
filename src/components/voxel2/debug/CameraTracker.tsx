import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useRef } from "react";

interface CameraTrackerProps {
  onUpdate: (data: {
    position: { x: number; y: number; z: number };
    direction: { compass: string; face: string; angle: number };
  }) => void;
}

export default function CameraTracker({ onUpdate }: CameraTrackerProps) {
  const { camera } = useThree();
  const lastUpdateTime = useRef(0);
  const UPDATE_INTERVAL = 100; // Update every 100ms instead of every frame
  
  useFrame((state) => {
    const currentTime = state.clock.getElapsedTime() * 1000; // Convert to milliseconds
    
    // Throttle updates to reduce frequency
    if (currentTime - lastUpdateTime.current < UPDATE_INTERVAL) {
      return;
    }
    
    lastUpdateTime.current = currentTime;
    
    // Get camera position
    const pos = camera.position;
    
    // Calculate facing direction
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    
    // Calculate angle in degrees (0-360) where 0 is North (-Z)
    const angle = Math.atan2(direction.x, -direction.z);
    const degrees = ((angle * 180 / Math.PI) + 360) % 360;
    
    // Determine compass direction and face
    let compass = "North";
    let face = "Z-";
    
    if (degrees >= 315 || degrees < 45) {
      compass = "North";
      face = "Z-";
    } else if (degrees >= 45 && degrees < 135) {
      compass = "East";
      face = "X+";
    } else if (degrees >= 135 && degrees < 225) {
      compass = "South";
      face = "Z+";
    } else {
      compass = "West";
      face = "X-";
    }
    
    // Update with rounded values
    onUpdate({
      position: {
        x: Math.round(pos.x * 100) / 100,
        y: Math.round(pos.y * 100) / 100,
        z: Math.round(pos.z * 100) / 100,
      },
      direction: {
        compass,
        face,
        angle: Math.round(degrees),
      }
    });
  });
  
  return null; // This component doesn't render anything
}