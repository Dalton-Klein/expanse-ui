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
}

interface DebugContextType {
  debugData: DebugData;
  updateDebugData: (data: DebugData) => void;
}

const DebugContext = createContext<DebugContextType>({
  debugData: {
    position: { x: 0, y: 0, z: 0 },
    direction: "North",
    rotation: { x: 0, y: 0, z: 0 },
    performance: { fps: 0, triangles: 0, drawCalls: 0, memory: 0 }
  },
  updateDebugData: () => {}
});

export const useDebugData = () => useContext(DebugContext);

export const DebugProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [debugData, setDebugData] = useState<DebugData>({
    position: { x: 0, y: 0, z: 0 },
    direction: "North",
    rotation: { x: 0, y: 0, z: 0 },
    performance: { fps: 0, triangles: 0, drawCalls: 0, memory: 0 }
  });

  const updateDebugData = useCallback((data: DebugData) => {
    setDebugData(data);
  }, []);

  return (
    <DebugContext.Provider value={{ debugData, updateDebugData }}>
      {children}
    </DebugContext.Provider>
  );
};