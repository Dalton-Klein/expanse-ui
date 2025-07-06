import React, { createContext, useContext, useState, useCallback } from "react";

interface DebugData {
  position: { x: number; y: number; z: number };
  direction: string;
  rotation: { x: number; y: number; z: number };
  performance: {
    fps: number;
    triangles: number;
    drawCalls: number;
    memory: number;
  };
  terrain?: {
    renderDistance: number;
    lod1Distance: number;
    lod2Distance: number;
    chunksLoaded: number;
    chunksInQueue: number;
    chunksPending: number;
    workerActive: boolean;
  };
  rendering?: {
    wireframeMode: boolean;
    flatworldTesterMode: boolean;
    flatworldPattern: string;
    naiveRenderingMode: boolean;
  };
}

interface DebugContextType {
  debugData: DebugData;
  updateDebugData: (data: DebugData | Partial<DebugData>) => void;
}

const DebugContext = createContext<DebugContextType>({
  debugData: {
    position: { x: 0, y: 0, z: 0 },
    direction: "North",
    rotation: { x: 0, y: 0, z: 0 },
    performance: { fps: 0, triangles: 0, drawCalls: 0, memory: 0 },
    terrain: {
      renderDistance: 0,
      lod1Distance: 0,
      lod2Distance: 0,
      chunksLoaded: 0,
      chunksInQueue: 0,
      chunksPending: 0,
      workerActive: false,
    },
    rendering: {
      wireframeMode: false,
      flatworldTesterMode: false,
      flatworldPattern: "flat",
      naiveRenderingMode: false,
    }
  },
  updateDebugData: () => {}
});

export const useDebugData = () => useContext(DebugContext);

export const DebugProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [debugData, setDebugData] = useState<DebugData>({
    position: { x: 0, y: 0, z: 0 },
    direction: "North",
    rotation: { x: 0, y: 0, z: 0 },
    performance: { fps: 0, triangles: 0, drawCalls: 0, memory: 0 },
    terrain: {
      renderDistance: 0,
      lod1Distance: 0,
      lod2Distance: 0,
      chunksLoaded: 0,
      chunksInQueue: 0,
      chunksPending: 0,
      workerActive: false,
    },
    rendering: {
      wireframeMode: false,
      flatworldTesterMode: false,
      flatworldPattern: "flat",
      naiveRenderingMode: false,
    }
  });

  const updateDebugData = useCallback((data: DebugData | Partial<DebugData>) => {
    setDebugData(prevData => ({
      ...prevData,
      ...data
    }));
  }, []);

  return (
    <DebugContext.Provider value={{ debugData, updateDebugData }}>
      {children}
    </DebugContext.Provider>
  );
};