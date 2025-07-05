import React from "react";
import { useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import DebugInfo from "./DebugInfo";

export default function DebugInfoOverlay() {
  return (
    <Html>
      <DebugInfo />
    </Html>
  );
}