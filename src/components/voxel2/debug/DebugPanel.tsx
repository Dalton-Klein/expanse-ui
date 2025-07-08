import React, { useState, useEffect } from "react";
import * as THREE from "three";
import {
  RenderConfig,
  PerformanceMetrics,
  DebugPattern,
  TerrainConfig,
  GenerationAlgorithm,
  MeshingAlgorithm,
} from "../types";
import { updateTerrainConfig } from "../engine/TerrainConfig";
import "./DebugPanel.scss";

interface DebugPanelProps {
  config: RenderConfig;
  onConfigChange: (config: RenderConfig) => void;
  terrainConfig: TerrainConfig;
  onTerrainConfigChange: (config: TerrainConfig) => void;
  metrics: PerformanceMetrics;
  onMetricsUpdate: (metrics: PerformanceMetrics) => void;
  cameraData: {
    position: { x: number; y: number; z: number };
    direction: {
      compass: string;
      face: string;
      angle: number;
    };
  };
}

export default function DebugPanel({
  config,
  onConfigChange,
  terrainConfig,
  onTerrainConfigChange,
  metrics,
  onMetricsUpdate,
  cameraData,
}: DebugPanelProps) {
  // FPS tracking
  const [fps, setFps] = useState(0);
  const [frameCount, setFrameCount] = useState(0);
  const [lastTime, setLastTime] = useState(
    performance.now()
  );

  useEffect(() => {
    const updateFPS = () => {
      const currentTime = performance.now();
      setFrameCount((prev) => prev + 1);

      // Update FPS every second
      if (currentTime - lastTime >= 1000) {
        const newFps = Math.round(
          (frameCount * 1000) / (currentTime - lastTime)
        );
        setFps(newFps);

        // Update metrics
        onMetricsUpdate({
          ...metrics,
          fps: newFps,
        });

        setFrameCount(0);
        setLastTime(currentTime);
      }

      requestAnimationFrame(updateFPS);
    };

    const animationId = requestAnimationFrame(updateFPS);
    return () => cancelAnimationFrame(animationId);
  }, [frameCount, lastTime, metrics, onMetricsUpdate]);

  const handlePatternChange = (pattern: DebugPattern) => {
    // Update both the render config and terrain config to keep them in sync
    onConfigChange({
      ...config,
      terrainPattern: pattern,
    });

    onTerrainConfigChange(
      updateTerrainConfig(terrainConfig, {
        generation: {
          ...terrainConfig.generation,
          debugPattern: pattern,
        },
      })
    );
  };

  const handleTerrainConfigUpdate = (
    updates: Partial<TerrainConfig>
  ) => {
    onTerrainConfigChange(
      updateTerrainConfig(terrainConfig, updates)
    );
  };

  return (
    <div className="debug-info-container">
      <div className="debug-panel">
        <h3>Debug Info</h3>

        <div className="debug-section">
          <h4>Location</h4>
          <div className="debug-item">
            <span className="label">X:</span>
            <span className="value">
              {cameraData.position.x}
            </span>
          </div>
          <div className="debug-item">
            <span className="label">Y:</span>
            <span className="value">
              {cameraData.position.y}
            </span>
          </div>
          <div className="debug-item">
            <span className="label">Z:</span>
            <span className="value">
              {cameraData.position.z}
            </span>
          </div>
          <div className="debug-item">
            <span className="label">Facing:</span>
            <span className="value">
              {cameraData.direction.compass} (
              {cameraData.direction.face})
            </span>
          </div>
          <div className="debug-item">
            <span className="label">Angle:</span>
            <span className="value">
              {cameraData.direction.angle}°
            </span>
          </div>
        </div>

        <div className="debug-section">
          <h4>Core Terrain</h4>
          <div className="debug-item">
            <span className="label">Seed:</span>
            <input
              type="number"
              min="1"
              max="999999"
              value={terrainConfig.generation.seed}
              onChange={(e) =>
                handleTerrainConfigUpdate({
                  generation: {
                    ...terrainConfig.generation,
                    seed: parseInt(e.target.value) || 1,
                  },
                })
              }
            />
          </div>
          <div className="debug-item">
            <span className="label">Render Distance:</span>
            <input
              type="range"
              min="1"
              max="16"
              value={terrainConfig.renderDistance}
              onChange={(e) =>
                handleTerrainConfigUpdate({
                  renderDistance: parseInt(e.target.value),
                })
              }
            />
            <span className="value">
              {terrainConfig.renderDistance}
            </span>
          </div>
        </div>

        <div className="debug-section">
          <h4>Generation</h4>
          <div className="debug-item">
            <span className="label">Algorithm:</span>
            <select
              value={terrainConfig.generation.algorithm}
              onChange={(e) =>
                handleTerrainConfigUpdate({
                  generation: {
                    ...terrainConfig.generation,
                    algorithm: e.target
                      .value as GenerationAlgorithm,
                  },
                })
              }
            >
              <option
                value={GenerationAlgorithm.DEBUG_PATTERN}
              >
                Debug Pattern
              </option>
              <option value={GenerationAlgorithm.NOISE}>
                Noise
              </option>
            </select>
          </div>

          {terrainConfig.generation.algorithm ===
            GenerationAlgorithm.DEBUG_PATTERN && (
            <div className="debug-item">
              <span className="label">Pattern:</span>
              <select
                value={
                  terrainConfig.generation.debugPattern
                }
                onChange={(e) =>
                  handlePatternChange(
                    e.target.value as DebugPattern
                  )
                }
              >
                <option value={DebugPattern.TINY}>
                  Tiny
                </option>
                <option value={DebugPattern.FLAT}>
                  Flat
                </option>
                <option value={DebugPattern.CHECKERBOARD}>
                  Checkerboard
                </option>
                <option value={DebugPattern.STEPPED}>
                  Stepped
                </option>
              </select>
            </div>
          )}
        </div>

        <div className="debug-section">
          <h4>LOD System</h4>
          <div className="debug-item">
            <span className="label">LOD Enabled:</span>
            <button
              className={`wireframe-toggle ${
                terrainConfig.lod.enabled ? "active" : ""
              }`}
              onClick={() =>
                handleTerrainConfigUpdate({
                  lod: {
                    ...terrainConfig.lod,
                    enabled: !terrainConfig.lod.enabled,
                  },
                })
              }
            >
              {terrainConfig.lod.enabled ? "ON" : "OFF"}
            </button>
          </div>
          {terrainConfig.lod.enabled && (
            <>
              <div className="debug-item">
                <span className="label">
                  Level 1 Distance:
                </span>
                <input
                  type="range"
                  min="1"
                  max="12"
                  value={terrainConfig.lod.level1Distance}
                  onChange={(e) =>
                    handleTerrainConfigUpdate({
                      lod: {
                        ...terrainConfig.lod,
                        level1Distance: parseInt(
                          e.target.value
                        ),
                      },
                    })
                  }
                />
                <span className="value">
                  {terrainConfig.lod.level1Distance}
                </span>
              </div>
              <div className="debug-item">
                <span className="label">
                  Level 2 Distance:
                </span>
                <input
                  type="range"
                  min="2"
                  max="16"
                  value={terrainConfig.lod.level2Distance}
                  onChange={(e) =>
                    handleTerrainConfigUpdate({
                      lod: {
                        ...terrainConfig.lod,
                        level2Distance: parseInt(
                          e.target.value
                        ),
                      },
                    })
                  }
                />
                <span className="value">
                  {terrainConfig.lod.level2Distance}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="debug-section">
          <h4>Greedy Meshing</h4>
          <div className="debug-item">
            <span className="label">Enabled:</span>
            <button
              className={`wireframe-toggle ${
                terrainConfig.greedyMeshing.enabled
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                handleTerrainConfigUpdate({
                  greedyMeshing: {
                    ...terrainConfig.greedyMeshing,
                    enabled:
                      !terrainConfig.greedyMeshing.enabled,
                  },
                })
              }
            >
              {terrainConfig.greedyMeshing.enabled
                ? "ON"
                : "OFF"}
            </button>
          </div>
          {terrainConfig.greedyMeshing.enabled && (
            <>
              <div className="debug-item">
                <span className="label">Algorithm:</span>
                <select
                  value={
                    terrainConfig.greedyMeshing.algorithm
                  }
                  onChange={(e) =>
                    handleTerrainConfigUpdate({
                      greedyMeshing: {
                        ...terrainConfig.greedyMeshing,
                        algorithm: e.target
                          .value as MeshingAlgorithm,
                      },
                    })
                  }
                >
                  <option value={MeshingAlgorithm.NAIVE}>
                    Naive
                  </option>
                  <option
                    value={MeshingAlgorithm.BINARY_GREEDY}
                  >
                    Binary Greedy
                  </option>
                </select>
              </div>
              <div className="debug-item">
                <span className="label">
                  Cross-Chunk Culling:
                </span>
                <button
                  className={`wireframe-toggle ${
                    terrainConfig.greedyMeshing
                      .crossChunkCulling
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    handleTerrainConfigUpdate({
                      greedyMeshing: {
                        ...terrainConfig.greedyMeshing,
                        crossChunkCulling:
                          !terrainConfig.greedyMeshing
                            .crossChunkCulling,
                      },
                    })
                  }
                >
                  {terrainConfig.greedyMeshing
                    .crossChunkCulling
                    ? "ON"
                    : "OFF"}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="debug-section">
          <h4>Debug Options</h4>
          <div className="debug-item">
            <span className="label">Wireframe:</span>
            <button
              className={`wireframe-toggle ${
                config.wireframe ? "active" : ""
              }`}
              onClick={() =>
                onConfigChange({
                  ...config,
                  wireframe: !config.wireframe,
                })
              }
            >
              {config.wireframe ? "ON" : "OFF"}
            </button>
          </div>
          <div className="debug-item">
            <span className="label">Naive Comparison:</span>
            <button
              className={`wireframe-toggle ${
                terrainConfig.debug.enableNaiveComparison
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                handleTerrainConfigUpdate({
                  debug: {
                    ...terrainConfig.debug,
                    enableNaiveComparison:
                      !terrainConfig.debug
                        .enableNaiveComparison,
                  },
                })
              }
            >
              {terrainConfig.debug.enableNaiveComparison
                ? "ON"
                : "OFF"}
            </button>
          </div>
        </div>

        <div className="debug-section">
          <h4>Performance</h4>
          <div className="debug-item">
            <span className="label">FPS:</span>
            <span className="value">{fps}</span>
          </div>
          <div className="debug-item">
            <span className="label">Triangles:</span>
            <span className="value">
              {metrics.triangles.toLocaleString()}
            </span>
          </div>
          <div className="debug-item">
            <span className="label">Chunks:</span>
            <span className="value">{metrics.chunks}</span>
          </div>
        </div>

        <div className="debug-section">
          <h4>Camera Controls</h4>
          <div className="debug-item">
            <span className="label">Click:</span>
            <span className="value">Lock pointer</span>
          </div>
          <div className="debug-item">
            <span className="label">WASD:</span>
            <span className="value">Move horizontally</span>
          </div>
          <div className="debug-item">
            <span className="label">Q/E:</span>
            <span className="value">Move up/down</span>
          </div>
          <div className="debug-item">
            <span className="label">Shift:</span>
            <span className="value">Move faster</span>
          </div>
          <div className="debug-item">
            <span className="label">Mouse:</span>
            <span className="value">Look around</span>
          </div>
          <div className="debug-item">
            <span className="label">ESC:</span>
            <span className="value">Release pointer</span>
          </div>
        </div>
      </div>
    </div>
  );
}
