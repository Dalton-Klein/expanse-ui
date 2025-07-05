import React from "react";
import { useDebugData } from "./DebugInfoProvider";
import "./DebugInfo.scss";

export default function DebugInfo() {
  const { debugData, updateDebugData } = useDebugData();

  const toggleWireframe = () => {
    updateDebugData({
      rendering: {
        wireframeMode: !debugData.rendering?.wireframeMode,
        flatworldTesterMode: debugData.rendering?.flatworldTesterMode || false,
        flatworldPattern: debugData.rendering?.flatworldPattern || "flat",
      }
    });
  };

  const toggleFlatworldTester = () => {
    updateDebugData({
      rendering: {
        wireframeMode: debugData.rendering?.wireframeMode || false,
        flatworldTesterMode: !debugData.rendering?.flatworldTesterMode,
        flatworldPattern: debugData.rendering?.flatworldPattern || "flat",
      }
    });
  };

  const changeFlatworldPattern = (pattern: string) => {
    updateDebugData({
      rendering: {
        wireframeMode: debugData.rendering?.wireframeMode || false,
        flatworldTesterMode: debugData.rendering?.flatworldTesterMode || false,
        flatworldPattern: pattern,
      }
    });
  };

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

        {debugData.terrain && (
          <div className="debug-section">
            <h4>Voxel Terrain</h4>
            <div className="debug-item">
              <span className="label">Render Distance:</span>
              <span className="value">{debugData.terrain.renderDistance} chunks</span>
            </div>
            <div className="debug-item">
              <span className="label">LOD 1 Distance:</span>
              <span className="value">{debugData.terrain.lod1Distance} chunks</span>
            </div>
            <div className="debug-item">
              <span className="label">LOD 2 Distance:</span>
              <span className="value">{debugData.terrain.lod2Distance} chunks</span>
            </div>
            <div className="debug-item">
              <span className="label">Chunks Loaded:</span>
              <span className="value">{debugData.terrain.chunksLoaded}</span>
            </div>
            <div className="debug-item">
              <span className="label">Chunks in Queue:</span>
              <span className="value">{debugData.terrain.chunksInQueue}</span>
            </div>
            <div className="debug-item">
              <span className="label">Chunks Pending:</span>
              <span className="value">{debugData.terrain.chunksPending}</span>
            </div>
            <div className="debug-item">
              <span className="label">Worker:</span>
              <span className="value">{debugData.terrain.workerActive ? "Active" : "Inactive"}</span>
            </div>
          </div>
        )}

        <div className="debug-section">
          <h4>Rendering</h4>
          <div className="debug-item">
            <span className="label">Wireframe Mode:</span>
            <button 
              className={`wireframe-toggle ${debugData.rendering?.wireframeMode ? 'active' : ''}`}
              onClick={toggleWireframe}
            >
              {debugData.rendering?.wireframeMode ? 'ON' : 'OFF'}
            </button>
          </div>
          <div className="debug-item">
            <span className="label">Flatworld Tester:</span>
            <button 
              className={`wireframe-toggle ${debugData.rendering?.flatworldTesterMode ? 'active' : ''}`}
              onClick={toggleFlatworldTester}
            >
              {debugData.rendering?.flatworldTesterMode ? 'ON' : 'OFF'}
            </button>
          </div>
          {debugData.rendering?.flatworldTesterMode && (
            <div className="debug-item">
              <span className="label">Pattern:</span>
              <select 
                value={debugData.rendering?.flatworldPattern || "flat"}
                onChange={(e) => changeFlatworldPattern(e.target.value)}
              >
                <option value="flat">Flat</option>
                <option value="checkerboard">Checkerboard</option>
                <option value="stepped">Stepped</option>
                <option value="mixed">Mixed Materials</option>
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}