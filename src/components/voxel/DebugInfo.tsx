import React from "react";
import { useDebugData } from "./DebugInfoProvider";
import "./DebugInfo.scss";

export default function DebugInfo() {
  const { debugData } = useDebugData();

  return (
    <div className="debug-info-container">
      <div className="debug-panel">
        <h3>Debug Info</h3>
        
        <div className="debug-section">
          <h4>Position</h4>
          <div className="debug-item">
            <span className="label">X:</span>
            <span className="value">{debugData.position.x}</span>
          </div>
          <div className="debug-item">
            <span className="label">Y:</span>
            <span className="value">{debugData.position.y}</span>
          </div>
          <div className="debug-item">
            <span className="label">Z:</span>
            <span className="value">{debugData.position.z}</span>
          </div>
        </div>

        <div className="debug-section">
          <h4>Direction</h4>
          <div className="debug-item">
            <span className="label">Facing:</span>
            <span className="value">{debugData.direction}</span>
          </div>
        </div>

        <div className="debug-section">
          <h4>Rotation (degrees)</h4>
          <div className="debug-item">
            <span className="label">Pitch:</span>
            <span className="value">{debugData.rotation.x}°</span>
          </div>
          <div className="debug-item">
            <span className="label">Yaw:</span>
            <span className="value">{debugData.rotation.y}°</span>
          </div>
        </div>

        <div className="debug-section">
          <h4>Performance</h4>
          <div className="debug-item">
            <span className="label">FPS:</span>
            <span className="value">{debugData.performance.fps}</span>
          </div>
          <div className="debug-item">
            <span className="label">Triangles:</span>
            <span className="value">{debugData.performance.triangles.toLocaleString()}</span>
          </div>
          <div className="debug-item">
            <span className="label">Draw Calls:</span>
            <span className="value">{debugData.performance.drawCalls}</span>
          </div>
          <div className="debug-item">
            <span className="label">Memory:</span>
            <span className="value">{debugData.performance.memory} MB</span>
          </div>
        </div>

        <div className="debug-section">
          <h4>Face Reference</h4>
          <div className="debug-item">
            <span className="label">North:</span>
            <span className="value">-Z direction</span>
          </div>
          <div className="debug-item">
            <span className="label">South:</span>
            <span className="value">+Z direction</span>
          </div>
          <div className="debug-item">
            <span className="label">East:</span>
            <span className="value">+X direction</span>
          </div>
          <div className="debug-item">
            <span className="label">West:</span>
            <span className="value">-X direction</span>
          </div>
          <div className="debug-item">
            <span className="label">Up:</span>
            <span className="value">+Y direction</span>
          </div>
          <div className="debug-item">
            <span className="label">Down:</span>
            <span className="value">-Y direction</span>
          </div>
        </div>
      </div>
    </div>
  );
}