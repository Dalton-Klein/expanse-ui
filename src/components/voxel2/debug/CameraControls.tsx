import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

interface CameraControlsProps {
  enabled?: boolean;
  movementSpeed?: number;
  mouseSensitivity?: number;
}

export default function CameraControls({
  enabled = true,
  movementSpeed = 15,
  mouseSensitivity = 0.002,
}: CameraControlsProps) {
  const { camera, gl } = useThree();
  const isLockedRef = useRef(false);
  const velocityRef = useRef(new THREE.Vector3());
  const directionRef = useRef(new THREE.Vector3());

  // Track key states
  const keysRef = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false,
    shift: false,
  });

  // Mouse movement tracking
  const eulerRef = useRef(new THREE.Euler(0, 0, 0, "YXZ"));

  useEffect(() => {
    if (!enabled) return;

    // Keyboard event handlers
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.code) {
        case "KeyW":
          keysRef.current.forward = true;
          break;
        case "KeyS":
          keysRef.current.backward = true;
          break;
        case "KeyA":
          keysRef.current.left = true;
          break;
        case "KeyD":
          keysRef.current.right = true;
          break;
        case "KeyQ":
          keysRef.current.down = true;
          break;
        case "KeyE":
          keysRef.current.up = true;
          break;
        case "ShiftLeft":
          keysRef.current.shift = true;
          break;
        case "Escape":
          exitPointerLock();
          break;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      switch (event.code) {
        case "KeyW":
          keysRef.current.forward = false;
          break;
        case "KeyS":
          keysRef.current.backward = false;
          break;
        case "KeyA":
          keysRef.current.left = false;
          break;
        case "KeyD":
          keysRef.current.right = false;
          break;
        case "KeyQ":
          keysRef.current.down = false;
          break;
        case "KeyE":
          keysRef.current.up = false;
          break;
        case "ShiftLeft":
          keysRef.current.shift = false;
          break;
      }
    };

    // Mouse movement handler
    const handleMouseMove = (event: MouseEvent) => {
      if (!isLockedRef.current) return;

      const movementX = event.movementX || 0;
      const movementY = event.movementY || 0;

      eulerRef.current.setFromQuaternion(camera.quaternion);
      eulerRef.current.y -= movementX * mouseSensitivity;
      eulerRef.current.x -= movementY * mouseSensitivity;

      // Limit vertical rotation
      eulerRef.current.x = Math.max(
        -Math.PI / 2,
        Math.min(Math.PI / 2, eulerRef.current.x)
      );

      camera.quaternion.setFromEuler(eulerRef.current);
    };

    // Pointer lock handlers
    const handleClick = () => {
      if (!isLockedRef.current) {
        requestPointerLock();
      }
    };

    const handlePointerLockChange = () => {
      isLockedRef.current =
        document.pointerLockElement === gl.domElement;
    };

    const requestPointerLock = () => {
      gl.domElement.requestPointerLock();
    };

    const exitPointerLock = () => {
      document.exitPointerLock();
    };

    // Add event listeners
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener(
      "pointerlockchange",
      handlePointerLockChange
    );
    gl.domElement.addEventListener("click", handleClick);

    // Cleanup
    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
      document.removeEventListener("keyup", handleKeyUp);
      document.removeEventListener(
        "mousemove",
        handleMouseMove
      );
      document.removeEventListener(
        "pointerlockchange",
        handlePointerLockChange
      );
      gl.domElement.removeEventListener(
        "click",
        handleClick
      );
    };
  }, [enabled, camera, gl, mouseSensitivity]);

  // Movement update loop
  useFrame((state, delta) => {
    if (!enabled) return;

    const velocity = velocityRef.current;
    const direction = directionRef.current;

    // Calculate movement direction
    direction.set(0, 0, 0);

    if (keysRef.current.forward) direction.z -= 1;
    if (keysRef.current.backward) direction.z += 1;
    if (keysRef.current.left) direction.x -= 1;
    if (keysRef.current.right) direction.x += 1;
    if (keysRef.current.up) direction.y += 1;
    if (keysRef.current.down) direction.y -= 1;

    // Normalize direction
    if (direction.length() > 0) {
      direction.normalize();
    }

    // Apply movement speed and sprint modifier
    const speed =
      movementSpeed * (keysRef.current.shift ? 5 : 1);

    // Transform direction to camera space (except Y movement)
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();

    camera.getWorldDirection(forward);
    right.crossVectors(forward, camera.up).normalize();

    // Calculate final velocity
    velocity.set(0, 0, 0);
    velocity.addScaledVector(right, direction.x * speed);
    velocity.addScaledVector(
      camera.up,
      direction.y * speed
    );
    velocity.addScaledVector(forward, -direction.z * speed);

    // Apply movement
    camera.position.addScaledVector(velocity, delta);
  });

  return null;
}
