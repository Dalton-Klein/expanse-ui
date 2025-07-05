# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React TypeScript application built with Create React App that appears to be a web-based game or interactive application called "Expanse UI". The project uses Three.js for 3D graphics, Redux for state management, and Socket.io for real-time communication.

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (runs on http://localhost:3000)
npm start

# Run tests in interactive watch mode
npm test

# Build for production
npm run build

# Run a single test file
npm test -- path/to/test.file
```

## Architecture Overview

### Core Technologies
- **React 18** with TypeScript for the UI framework
- **Redux Toolkit** with Redux Persist for state management
- **React Three Fiber** (Three.js) for 3D graphics and experiences
- **Socket.io Client** for WebSocket connections
- **React Router** for client-side routing (using HashRouter)
- **SCSS** for styling

### Project Structure
- `/src/App.tsx` - Main application component that sets up routing, Redux provider, and socket connections
- `/src/index.tsx` - Entry point that renders the app with HashRouter
- `/src/store/` - Redux store configuration with persistence
  - `store.ts` - Store configuration with Redux Toolkit, Redux Observable, and Redux Persist
  - `userSlice.ts` - User state management
  - `interfaces.ts` - TypeScript interfaces for store
- `/src/components/` - React components organized by feature
  - `/pages/` - Page-level components for different routes
- `/src/utils/` - Utility functions
  - `rest.ts` - REST API utilities
  - `interfaces.ts` - Shared TypeScript interfaces
- `/src/styling/` - SCSS configuration and global styles

### Key Implementation Details

1. **Socket Connection**: The app establishes a Socket.io connection on mount in App.tsx (currently hardcoded to localhost:3000)
2. **State Persistence**: Redux state is persisted to localStorage using redux-persist
3. **Routing**: Uses HashRouter for client-side routing with routes defined in App.tsx
4. **3D Integration**: React Three Fiber is set up for 3D experiences (referenced in git history)
5. **TypeScript Configuration**: Strict mode enabled with React JSX support

### Important Notes
- The socket connection URL is hardcoded to `http://localhost:3000` and needs to be updated for production
- The project uses Create React App's default ESLint configuration
- Redux DevTools are currently disabled in the store configuration

## Voxel System Architecture

### Core Components
- `/src/components/voxel/VoxelWorld.tsx` - Main Three.js canvas setup with lighting and sky
- `/src/components/voxel/DebugCamera.tsx` - Flying camera controller (WASD+QE movement, mouse look)
- `/src/components/voxel/VoxelTerrain.tsx` - Terrain generation and chunk management
- `/src/components/voxel/TerrainGenerator.tsx` - Multi-layered noise terrain generation system
- `/src/components/voxel/ChunkSimpleGreedy.tsx` - Face culling and mesh rendering (current implementation)
- `/src/components/voxel/DebugInfo.tsx` - Debug panel with position, direction, and performance data
- `/src/components/voxel/DebugInfoProvider.tsx` - Context provider for debug data
- `/src/components/voxel/DebugUpdater.tsx` - Updates debug data from within Canvas
- `/src/components/voxel/noise.ts` - Perlin noise implementation for terrain generation
- `/src/components/voxel/types.ts` - Type definitions for voxels and chunks

### Current Features
- **Multi-Layered Terrain Generation**: Advanced system with 3 noise layers:
  - **Continental Layer**: Very low frequency for large landmasses and oceans
  - **Regional Layer**: Medium frequency for hills, valleys, and plateaus  
  - **Local Layer**: High frequency for surface detail and roughness
  - **Erosion System**: Creates dramatic valleys and cliff formations
- **Dynamic Biome System**: Height and noise-based biome determination:
  - **Ocean/Water**: Below sea level with water blocks
  - **Beach**: Sandy coastlines near sea level
  - **Grasslands**: Low to medium elevation with grass and dirt
  - **Highlands**: Elevated terrain with deeper soil layers
  - **Mountains**: High elevation stone formations
- **Optimized Face Culling**: Only renders visible faces with correct winding order
- **Configurable World Size**: Adjustable `MAP_WIDTH_IN_CHUNKS` variable (currently 20x20 = 400 chunks)
- **Chunk-based Organization**: 16x16x100 voxels per chunk (increased height limit)
- **Debug Camera**: Flying controls with speed boost
- **Enhanced Debug Panel**: Position, direction, and performance monitoring

### Performance Considerations
- **Greedy Meshing Algorithm**: Reduces triangle count by 60-90% compared to individual voxel meshes
- **Face Culling**: Only renders visible faces (adjacent to air or chunk boundaries)
- **Buffer Geometry**: Uses efficient Three.js buffer geometry for optimal rendering
- Chunk-based world organization for scalability
- Stats panel included for FPS monitoring

### Greedy Meshing Details
- **Algorithm**: Scans each chunk face by face in 6 directions (±X, ±Y, ±Z)
- **Optimization**: Combines adjacent faces of the same voxel type into larger quads
- **Face Culling**: Only generates faces that are visible (next to air or chunk edge)
- **Performance**: Dramatically reduces draw calls and triangle count

### Known Issues
- Instanced mesh color rendering needs fixing (Chunk.tsx)
- Redux-persist warning about non-serializable values - can be safely ignored

### Next Features to Implement
- **Proper Greedy Meshing**: Implement true greedy meshing algorithm to combine adjacent faces
- **Frustum Culling**: Only render chunks in camera view
- **Level of Detail (LOD)**: Lower detail for distant chunks
- **Chunk Loading/Unloading**: Dynamic world streaming based on player position
- **Cross-Chunk Face Culling**: Optimize faces between chunk boundaries
- **Advanced Biomes**: Add more biome types (forests, deserts, snow, etc.)
- **Cave Generation**: 3D noise for underground cave systems
- **Ore Generation**: Scattered mineral deposits in stone layers
- **Texture Atlas**: Support for textured voxels instead of solid colors
- **Water Physics**: Flowing water and proper water rendering
- **Ambient Occlusion**: Add subtle lighting effects for more realistic appearance

### Terrain Generation Parameters (Optimized for 100-block height)
The `TerrainGenerator` can be customized with different parameters:
- **Continental Scale**: 0.0008 (very large landmasses, amplitude: 55)
- **Regional Scale**: 0.006 (hills and valleys, amplitude: 30)
- **Local Scale**: 0.04 (surface detail, amplitude: 8)
- **Sea Level**: 25 (blocks above Y=0, allows deeper oceans)
- **Erosion Effects**: More aggressive (threshold: -0.2, intensity: 0.8)
- **Height Range**: Terrain can reach Y=80+ for dramatic mountains
- **Biome Variety**: 6 different terrain types based on elevation and noise

### Controls
- Click canvas to lock pointer
- WASD for horizontal movement
- Q/E for vertical movement (Q=down, E=up)
- Mouse for camera rotation
- Shift for speed boost (3x speed)
- ESC to release pointer

### Known Issues
- Redux-persist warning about non-serializable values - this can be safely ignored