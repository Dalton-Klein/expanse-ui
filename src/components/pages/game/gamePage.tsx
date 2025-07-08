import React from "react";
import VoxelWorld2 from "../../voxel2/engine/rendering/VoxelWorld2";
import { DebugProvider } from "../../voxel/DebugInfoProvider";
import "./gamePage.scss";

export default function GamePage() {
  return (
    <DebugProvider>
      <div className="game-page">
        <VoxelWorld2 />
      </div>
    </DebugProvider>
  );
}
