import React from "react";
import * as THREE from "three";
import {
  ChunkData,
  RenderConfig,
  TerrainConfig,
} from "../../types";
import { GreedyMesher } from "../../engine/greedy-meshing/GreedyMesher";

// React component for rendering chunks using binary greedy meshing

interface GreedyRendererProps {
  chunks: ChunkData[];
  renderingConfig: RenderConfig;
  terrainConfig: TerrainConfig;
  onMeshGenerated?: (stats: {
    chunkCount: number;
    totalTriangles: number;
    avgGenerationTime: number;
  }) => void;
}

export default function GreedyRenderer({
  chunks,
  renderingConfig,
  terrainConfig,
  onMeshGenerated,
}: GreedyRendererProps) {
  // Store previous geometries for cleanup
  const previousGeometriesRef = React.useRef<THREE.BufferGeometry[]>([]);

  // Generate meshes for all chunks
  const meshResults = React.useMemo(() => {
    // Dispose of previous geometries to prevent memory leaks
    previousGeometriesRef.current.forEach(geometry => {
      if (geometry) {
        geometry.dispose();
      }
    });
    previousGeometriesRef.current = [];

    // Results should be an array of generated meshes which represent a single chunk
    // Each element in results should be a buffer geometry
    // containing the vertices, normals, and colors for that chunk
    const results = [];
    // Total triangles and generation time for performance metrics
    // These are sums from all individual chunks and are divided by the number of chunks for UI debugging
    let totalTriangles = 0;
    let totalTime = 0;

    // Process each chunk
    for (const chunk of chunks) {
      const result =
        GreedyMesher.generateMeshForChunk(chunk, renderingConfig);
      totalTriangles += result.triangleCount;
      totalTime += result.generationTime;
      results.push(result);
      
      // Store geometry for cleanup
      previousGeometriesRef.current.push(result.geometry);
    }

    // Log performance for debugging
    const timeInMS =
      chunks.length > 0
        ? (totalTime / chunks.length).toFixed(3)
        : 0;
    console.log(
      `[GreedyMeshRenderer] Generated ${chunks.length} chunks:`,
      {
        totalTriangles,
        avgTimePerChunk: `${timeInMS} ms`,
        totalTime: totalTime.toFixed(3),
      }
    );

    return {
      results,
      totalTriangles,
      avgGenerationTime:
        chunks.length > 0 ? totalTime / chunks.length : 0,
    };
  }, [chunks, renderingConfig]);

  // Cleanup geometries on unmount
  React.useEffect(() => {
    return () => {
      previousGeometriesRef.current.forEach(geometry => {
        if (geometry) {
          geometry.dispose();
        }
      });
    };
  }, []);

  // Report statistics when mesh results change
  React.useEffect(() => {
    if (onMeshGenerated) {
      onMeshGenerated({
        chunkCount: chunks.length,
        totalTriangles: meshResults.totalTriangles,
        avgGenerationTime: meshResults.avgGenerationTime,
      });
    }
  }, [meshResults, onMeshGenerated, chunks.length]);

  return (
    <group name="greedy-mesh-terrain">
      {meshResults.results.map(
        (result: any, index: any) => (
          <mesh
            key={`chunk-${chunks[index].position.x}-${chunks[index].position.y}-${chunks[index].position.z}`}
            geometry={result.geometry}
            position={[chunks[index].position.x, chunks[index].position.y, chunks[index].position.z]}
            castShadow
            receiveShadow
          >
            <meshLambertMaterial
              wireframe={renderingConfig.wireframe}
              vertexColors={true}
              side={THREE.FrontSide}
            />
          </mesh>
        )
      )}
    </group>
  );
}

// Performance comparison component for A/B testing
interface PerformanceComparisonProps {
  naiveStats: {
    triangleCount: number;
    renderTime: number;
  };
  greedyStats: {
    triangleCount: number;
    renderTime: number;
  };
}

export function PerformanceComparison({
  naiveStats,
  greedyStats,
}: PerformanceComparisonProps) {
  const triangleReduction = (
    (1 -
      greedyStats.triangleCount /
        naiveStats.triangleCount) *
    100
  ).toFixed(1);
  const speedup = (
    naiveStats.renderTime / greedyStats.renderTime
  ).toFixed(2);

  return (
    <div className="performance-comparison">
      <h4>Performance Comparison</h4>
      <div className="comparison-item">
        <span className="label">Triangle Reduction:</span>
        <span className="value">{triangleReduction}%</span>
      </div>
      <div className="comparison-item">
        <span className="label">
          Mesh Generation Speedup:
        </span>
        <span className="value">{speedup}x</span>
      </div>
      <div className="comparison-item">
        <span className="label">Naive Triangles:</span>
        <span className="value">
          {naiveStats.triangleCount.toLocaleString()}
        </span>
      </div>
      <div className="comparison-item">
        <span className="label">Greedy Triangles:</span>
        <span className="value">
          {greedyStats.triangleCount.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
