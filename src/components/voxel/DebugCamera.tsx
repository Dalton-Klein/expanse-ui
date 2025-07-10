import React, { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";

export default function DebugCamera() {
  const { camera, gl } = useThree();
  const velocity = useRef(new THREE.Vector3());
  const direction = useRef(new THREE.Vector3());
  const moveSpeed = 80;
  const lookSpeed = 0.002;

  const keys = useRef({
    w: false,
    a: false,
    s: false,
    d: false,
    q: false,
    e: false,
    shift: false,
  });

  const mouseMovement = useRef({ x: 0, y: 0 });
  const isPointerLocked = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key in keys.current) {
        keys.current[key as keyof typeof keys.current] =
          true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key in keys.current) {
        keys.current[key as keyof typeof keys.current] =
          false;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isPointerLocked.current) {
        mouseMovement.current.x = e.movementX;
        mouseMovement.current.y = e.movementY;
      }
    };

    const handlePointerLockChange = () => {
      isPointerLocked.current =
        document.pointerLockElement === gl.domElement;
    };

    const handleClick = () => {
      gl.domElement.requestPointerLock();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener(
      "pointerlockchange",
      handlePointerLockChange
    );
    gl.domElement.addEventListener("click", handleClick);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener(
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
  }, [gl]);

  useFrame((_, delta) => {
    if (!isPointerLocked.current) return;

    // Handle mouse look
    const euler = new THREE.Euler(0, 0, 0, "YXZ");
    euler.setFromQuaternion(camera.quaternion);
    euler.y -= mouseMovement.current.x * lookSpeed;
    euler.x -= mouseMovement.current.y * lookSpeed;
    euler.x = Math.max(
      -Math.PI / 2,
      Math.min(Math.PI / 2, euler.x)
    );
    camera.quaternion.setFromEuler(euler);

    mouseMovement.current.x = 0;
    mouseMovement.current.y = 0;

    // Handle movement
    direction.current.set(0, 0, 0);

    if (keys.current.w) direction.current.z -= 1;
    if (keys.current.s) direction.current.z += 1;
    if (keys.current.a) direction.current.x -= 1;
    if (keys.current.d) direction.current.x += 1;
    if (keys.current.q) direction.current.y -= 1;
    if (keys.current.e) direction.current.y += 1;

    direction.current.normalize();

    // Apply speed boost with shift
    const currentSpeed = keys.current.shift
      ? moveSpeed * 8
      : moveSpeed;

    // Transform direction to camera space
    const forward = new THREE.Vector3(
      0,
      0,
      -1
    ).applyQuaternion(camera.quaternion);
    const right = new THREE.Vector3(
      1,
      0,
      0
    ).applyQuaternion(camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0);

    velocity.current.set(0, 0, 0);
    velocity.current.addScaledVector(
      forward,
      -direction.current.z * currentSpeed * delta
    );
    velocity.current.addScaledVector(
      right,
      direction.current.x * currentSpeed * delta
    );
    velocity.current.addScaledVector(
      up,
      direction.current.y * currentSpeed * delta
    );

    camera.position.add(velocity.current);
  });

  return null;
}
