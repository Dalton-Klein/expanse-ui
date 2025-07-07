import React from "react";
import * as THREE from "three";
import {
  ChunkData,
  RenderConfig,
  TerrainConfig,
} from "../types";
import {
  BinaryGreedyMesher,
  BinaryMeshResult,
} from "../meshing/BinaryGreedyMesher";

// React component for rendering chunks using binary greedy meshing

interface GreedyMeshRendererProps {
  chunks: ChunkData[];
  renderingConfig: RenderConfig;
  terrainConfig: TerrainConfig;
  onMeshGenerated?: (stats: {
    chunkCount: number;
    totalTriangles: number;
    avgGenerationTime: number;
  }) => void;
}

export default function GreedyMeshRenderer({
  chunks,
  renderingConfig,
  terrainConfig,
  onMeshGenerated,
}: GreedyMeshRendererProps) {
  // Generate meshes for all chunks
  const meshResults = React.useMemo(() => {
    const results: BinaryMeshResult[] = [];
    let totalTriangles = 0;
    let totalTime = 0;

    // Process each chunk
    for (const chunk of chunks) {
      const result = BinaryGreedyMesher.generateMesh(chunk);
      results.push(result);
      totalTriangles += result.triangleCount;
      totalTime += result.generationTimeMs;
    }

    // Log performance for debugging
    console.log(
      `[GreedyMeshRenderer] Generated ${chunks.length} chunks:`,
      {
        totalTriangles,
        avgTimePerChunk:
          chunks.length > 0
            ? (totalTime / chunks.length).toFixed(3)
            : 0,
        totalTime: totalTime.toFixed(3),
      }
    );

    return {
      results,
      totalTriangles,
      avgGenerationTime:
        chunks.length > 0 ? totalTime / chunks.length : 0,
    };
  }, [chunks]);

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
      {meshResults.results.map((result, index) => (
        <mesh
          key={`chunk-${chunks[index].position.x}-${chunks[index].position.z}`}
          geometry={result.geometry}
          castShadow
          receiveShadow
        >
          <meshLambertMaterial
            wireframe={renderingConfig.wireframe}
            vertexColors={true}
            side={THREE.FrontSide}
          />
        </mesh>
      ))}
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
