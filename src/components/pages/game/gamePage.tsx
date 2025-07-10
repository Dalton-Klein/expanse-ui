import React from "react";
import VoxelWorld2 from "../../voxel2/engine/rendering/VoxelWorld2";
import "./gamePage.scss";

export default function GamePage() {
  return (
    <div className="game-page">
      <VoxelWorld2 />
    </div>
  );
}
