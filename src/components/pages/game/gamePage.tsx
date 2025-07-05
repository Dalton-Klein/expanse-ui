import React from "react";
import VoxelWorld from "../../voxel/VoxelWorld";
import HUD from "../../voxel/HUD";
import DebugInfo from "../../voxel/DebugInfo";
import { DebugProvider } from "../../voxel/DebugInfoProvider";
import "./gamePage.scss";

export default function GamePage() {
  return (
    <DebugProvider>
      <div className="game-page">
        <VoxelWorld />
        <HUD />
        <DebugInfo />
      </div>
    </DebugProvider>
  );
}