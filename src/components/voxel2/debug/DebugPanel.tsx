import React, { useState, useEffect } from "react";
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
  onFpsUpdate: (fps: number) => void; // Separate FPS callback
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
  onFpsUpdate,
  cameraData,
}: DebugPanelProps) {
  // FPS tracking
  const [fps, setFps] = useState(0);

  useEffect(() => {
    let animationId: number;
    let frameCount = 0;
    let lastTime = performance.now();
    let lastMemoryCheck = performance.now();
    let currentFps = 0; // Track current FPS outside the update block

    const updateFPS = () => {
      const currentTime = performance.now();
      frameCount++;

      // Update FPS every second
      if (currentTime - lastTime >= 1000) {
        const newFps = Math.round(
          (frameCount * 1000) / (currentTime - lastTime)
        );
        currentFps = newFps; // Store for memory logging
        setFps(newFps);

        // Update FPS without overriding other metrics
        onFpsUpdate(newFps);

        frameCount = 0;
        lastTime = currentTime;
      }

      // Log memory usage every 30 seconds for debugging
      if (currentTime - lastMemoryCheck >= 30000) {
        if ((performance as any).memory) {
          const memInfo = (performance as any).memory;
          console.log(`[Performance] Memory Usage:`, {
            used: `${(
              memInfo.usedJSHeapSize /
              1024 /
              1024
            ).toFixed(1)}MB`,
            total: `${(
              memInfo.totalJSHeapSize /
              1024 /
              1024
            ).toFixed(1)}MB`,
            limit: `${(
              memInfo.jsHeapSizeLimit /
              1024 /
              1024
            ).toFixed(1)}MB`,
            fps: currentFps,
          });
        }
        lastMemoryCheck = currentTime;
      }

      animationId = requestAnimationFrame(updateFPS);
    };

    animationId = requestAnimationFrame(updateFPS);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [onFpsUpdate]); // Only depend on the FPS callback

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
          {/* <div className="debug-item">
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
          </div> */}
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
                <option value={DebugPattern.TWO_CUBES}>
                  Two Cubes
                </option>
              </select>
            </div>
          )}

          {terrainConfig.generation.algorithm ===
            GenerationAlgorithm.NOISE && (
            <>
              <div className="debug-item">
                <span className="label">Map Size:</span>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={
                    terrainConfig.generation.noise.mapSize
                  }
                  onChange={(e) =>
                    handleTerrainConfigUpdate({
                      generation: {
                        ...terrainConfig.generation,
                        noise: {
                          ...terrainConfig.generation.noise,
                          mapSize: parseInt(e.target.value),
                        },
                      },
                    })
                  }
                />
                <span className="value">
                  {terrainConfig.generation.noise.mapSize}x
                  {terrainConfig.generation.noise.mapSize}
                </span>
              </div>

              {/* Noise Layers Section */}
              {/* Continental Layer */}
              <div className="noise-layer">
                <div className="debug-item">
                  <span className="label">
                    Continental Noise:
                  </span>
                  <button
                    className={`wireframe-toggle ${
                      terrainConfig.generation.noise
                        .continental.enabled
                        ? "active"
                        : ""
                    }`}
                    onClick={() =>
                      handleTerrainConfigUpdate({
                        generation: {
                          ...terrainConfig.generation,
                          noise: {
                            ...terrainConfig.generation
                              .noise,
                            continental: {
                              ...terrainConfig.generation
                                .noise.continental,
                              enabled:
                                !terrainConfig.generation
                                  .noise.continental
                                  .enabled,
                            },
                          },
                        },
                      })
                    }
                  >
                    {terrainConfig.generation.noise
                      .continental.enabled
                      ? "ON"
                      : "OFF"}
                  </button>
                </div>
              </div>

              {/* Regional Layer */}
              <div className="noise-layer">
                <div className="debug-item">
                  <span className="label">Regional Noise:</span>
                  <button
                    className={`wireframe-toggle ${
                      terrainConfig.generation.noise
                        .regional.enabled
                        ? "active"
                        : ""
                    }`}
                    onClick={() =>
                      handleTerrainConfigUpdate({
                        generation: {
                          ...terrainConfig.generation,
                          noise: {
                            ...terrainConfig.generation
                              .noise,
                            regional: {
                              ...terrainConfig.generation
                                .noise.regional,
                              enabled:
                                !terrainConfig.generation
                                  .noise.regional.enabled,
                            },
                          },
                        },
                      })
                    }
                  >
                    {terrainConfig.generation.noise
                      .regional.enabled
                      ? "ON"
                      : "OFF"}
                  </button>
                </div>
              </div>

              {/* Local Layer */}
              <div className="noise-layer">
                <div className="debug-item">
                  <span className="label">Local Noise:</span>
                  <button
                    className={`wireframe-toggle ${
                      terrainConfig.generation.noise.local
                        .enabled
                        ? "active"
                        : ""
                    }`}
                    onClick={() =>
                      handleTerrainConfigUpdate({
                        generation: {
                          ...terrainConfig.generation,
                          noise: {
                            ...terrainConfig.generation
                              .noise,
                            local: {
                              ...terrainConfig.generation
                                .noise.local,
                              enabled:
                                !terrainConfig.generation
                                  .noise.local.enabled,
                            },
                          },
                        },
                      })
                    }
                  >
                    {terrainConfig.generation.noise.local
                      .enabled
                      ? "ON"
                      : "OFF"}
                  </button>
                </div>
              </div>
            </>
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
            <span className="label">Ambient Occlusion:</span>
            <button
              className={`wireframe-toggle ${
                config.ambientOcclusion ? "active" : ""
              }`}
              onClick={() =>
                onConfigChange({
                  ...config,
                  ambientOcclusion: !config.ambientOcclusion,
                })
              }
            >
              {config.ambientOcclusion ? "ON" : "OFF"}
            </button>
          </div>
          <div className="debug-item">
            <span className="label">Use Textures:</span>
            <button
              className={`wireframe-toggle ${
                config.useTextures ? "active" : ""
              }`}
              onClick={() =>
                onConfigChange({
                  ...config,
                  useTextures: !config.useTextures,
                })
              }
            >
              {config.useTextures ? "ON" : "OFF"}
            </button>
          </div>
          <div className="debug-item">
            <span className="label">Distance Fog:</span>
            <button
              className={`wireframe-toggle ${
                config.fog.enabled ? "active" : ""
              }`}
              onClick={() =>
                onConfigChange({
                  ...config,
                  fog: {
                    ...config.fog,
                    enabled: !config.fog.enabled,
                  },
                })
              }
            >
              {config.fog.enabled ? "ON" : "OFF"}
            </button>
          </div>
          {config.fog.enabled && (
            <>
              <div className="debug-item">
                <span className="label">Fog Near:</span>
                <input
                  type="range"
                  min="50"
                  max="200"
                  value={config.fog.near}
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      fog: {
                        ...config.fog,
                        near: parseInt(e.target.value),
                      },
                    })
                  }
                />
                <span className="value">{config.fog.near}</span>
              </div>
              <div className="debug-item">
                <span className="label">Fog Far:</span>
                <input
                  type="range"
                  min="250"
                  max="750"
                  value={config.fog.far}
                  onChange={(e) =>
                    onConfigChange({
                      ...config,
                      fog: {
                        ...config.fog,
                        far: parseInt(e.target.value),
                      },
                    })
                  }
                />
                <span className="value">{config.fog.far}</span>
              </div>
            </>
          )}
          <div className="debug-item">
            <span className="label">Chunk Borders:</span>
            <button
              className={`wireframe-toggle ${
                terrainConfig.debug.showChunkBorders
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                handleTerrainConfigUpdate({
                  debug: {
                    ...terrainConfig.debug,
                    showChunkBorders:
                      !terrainConfig.debug.showChunkBorders,
                  },
                })
              }
            >
              {terrainConfig.debug.showChunkBorders
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
          <div className="debug-item">
            <span className="label">Avg Gen Time:</span>
            <span className="value">
              {metrics.avgGenerationTime.toFixed(2)} ms
            </span>
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
