import React from "react";
import "./HUD.scss";

export default function HUD() {
  return (
    <div className="hud-container">
      <div className="controls-panel">
        <h3>Debug Camera Controls</h3>
        <div className="control-item">
          <span className="key">Click</span>
          <span className="action">Lock pointer</span>
        </div>
        <div className="control-item">
          <span className="key">WASD</span>
          <span className="action">Move horizontally</span>
        </div>
        <div className="control-item">
          <span className="key">Q/E</span>
          <span className="action">Move up/down</span>
        </div>
        <div className="control-item">
          <span className="key">Shift</span>
          <span className="action">Move faster</span>
        </div>
        <div className="control-item">
          <span className="key">Mouse</span>
          <span className="action">Look around</span>
        </div>
        <div className="control-item">
          <span className="key">ESC</span>
          <span className="action">Release pointer</span>
        </div>
      </div>
    </div>
  );
}