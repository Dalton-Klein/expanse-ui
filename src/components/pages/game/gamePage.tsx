import "./gamePage.scss";
import React, {
  useEffect,
  useRef,
  startTransition,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { Canvas, useThree } from "@react-three/fiber";
import Experience from "../../3d/experience";
import { useLoader } from "@react-three/fiber";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import { OrbitControls, Sky } from "@react-three/drei";
import {
  DirectionalLight,
  Mesh,
  DirectionalLightHelper,
} from "three";

export default function HomePage() {
  const navigate = useNavigate();
  const [ramp, setRamp] = useState(null);
  const directionalLightRef = useRef<DirectionalLight>(
    null!
  );
  const targetRef = useRef<Mesh>(null!);

  // Load FBX model asynchronously and handle it with state
  useEffect(() => {
    const loadRamp = async () => {
      const loadedRamp: any =
        await new FBXLoader().loadAsync("/wfc_ramp.fbx");
      startTransition(() => {
        setRamp(loadedRamp);
      });
    };
    loadRamp();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (
        directionalLightRef.current &&
        targetRef.current
      ) {
        // Set the light target to the target object
        directionalLightRef.current.target =
          targetRef.current;
        // Optional: Add a helper to visualize the light direction
        const helper = new DirectionalLightHelper(
          directionalLightRef.current,
          5
        );
        directionalLightRef.current.add(helper);

        // Clear the interval once the target is set
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const buttonPressPlayGame = () => {
    navigate("/game");
  };

  const Controls = () => {
    const {
      camera,
      gl: { domElement },
    } = useThree();
    return <OrbitControls args={[camera, domElement]} />;
  };
  return (
    <div className="game-canvas">
      <Canvas camera={{ position: [0, 0, 5], fov: 80 }}>
        <ambientLight intensity={0.3} />
        <directionalLight
          ref={directionalLightRef}
          position={[0, 19, 0]}
          intensity={1}
        />
        {/* this mesh is just an invisible target for directional light to point to */}
        <mesh ref={targetRef} position={[15, 0, 15]}>
          {/* Invisible target object */}
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshBasicMaterial color="red" visible={false} />
        </mesh>
        <mesh>
          <Sky distance={950000} />
        </mesh>
        <Controls />
        <Experience />
        {ramp && <primitive object={ramp} />}
      </Canvas>
    </div>
  );
}
