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

## Binary Greedy Meshing Implementation

This project implements a highly optimized binary greedy meshing algorithm based on TanTanDev's approach for voxel terrain rendering. The implementation is located in `/src/components/voxel2/engine/greedy-meshing/GreedyMesher.ts`.

### Algorithm Overview

The binary greedy meshing algorithm works in 4 main steps:

1. **Binary Encoding**: Convert 3D voxel data into binary columns separated by block type
2. **Face Culling**: Use bitwise operations to find face transitions (solid-to-air boundaries)
3. **Greedy Meshing**: Apply 2D greedy algorithm to merge adjacent faces into larger quads
4. **Geometry Generation**: Convert optimized quads to Three.js buffer geometry

### Key Technical Details

- **Chunk Size**: 30x30x30 voxels with 2-block padding for neighbor data (32x32x32 total)
- **Binary Representation**: Each axis column uses 32-bit integers for efficient bit operations
- **Face Directions**: 6 directions (±X, ±Y, ±Z) processed separately
- **Block Type Separation**: Different voxel types are processed independently for correct face culling

### Major Challenge: Non-Contiguous Face Patterns

During development, we encountered a critical issue with the greedy meshing algorithm when processing non-contiguous face patterns (e.g., two separated cubes).

#### The Problem
When processing faces at position [0,0] with bits at positions 2 and 6 (representing faces from two separate cubes):
- The algorithm would process bit 2 first, create a quad, and immediately clear bits 2-3
- This left bit 6 isolated in some positions, causing it to be split into multiple smaller quads
- Result: 14 quads instead of the optimal 12 quads for two cubes

#### Root Cause Analysis
The issue was **premature bit clearing** in the sequential processing approach:

```typescript
// PROBLEMATIC APPROACH:
for each position {
  find first set bit
  expand quad
  clear bits immediately  // ← This caused fragmentation
}
```

#### Our Solution: Batch Processing
We implemented a batch processing approach that handles all contiguous bit groups at each position before clearing any bits:

```typescript
// IMPROVED APPROACH:
for each position {
  identify all contiguous bit groups
  for each group {
    expand quad optimally
    store quad info
  }
  clear all processed bits together  // ← Prevents fragmentation
}
```

### Implementation Details

#### Key Functions Added:
- `findContiguousBitGroups()`: Identifies all contiguous bit sequences in a column
- Modified `greedyMesh2D()`: Processes multiple groups per position before clearing bits

#### Algorithm Flow:
1. **Group Identification**: At each position, find all contiguous bit groups
2. **Independent Processing**: Each group is expanded optimally without interference
3. **Batch Clearing**: All processed bits are cleared together after quad creation

### Performance Impact

The solution provides:
- **Optimal Quad Count**: Each face region gets the largest possible quad representation
- **Correct Face Coverage**: No gaps or overlaps in the final mesh
- **Maintained Efficiency**: Preserves the binary algorithm's performance benefits
- **Pattern Agnostic**: Works correctly for any terrain configuration

### Test Patterns Used
During development, we used several test patterns to verify correctness:
- **Tiny Pattern**: 2x2x2 cube for basic functionality
- **Flat Pattern**: Large flat surface for greedy merging verification
- **Two Cubes Pattern**: Non-contiguous cubes that exposed the fragmentation issue
- **Stepped Pattern**: Variable height terrain for complex face scenarios

### Debug Process
The debugging process involved:
1. **Binary Pattern Analysis**: Examining bit patterns in face masks
2. **Quad Generation Logging**: Tracking how quads were created and bits cleared
3. **Step-by-step Debugging**: Following the algorithm through each processing step
4. **Root Cause Identification**: Discovering the premature bit clearing issue
5. **Solution Development**: Implementing the batch processing approach

### Current Status
✅ **SOLVED**: The binary greedy meshing algorithm now correctly handles all test patterns and produces optimal mesh quality with proper face merging.

The implementation successfully combines the efficiency of TanTanDev's binary approach with robust handling of edge cases, resulting in a production-ready voxel meshing solution.

## Critical Bug Fix: Phantom Face Generation at Chunk Boundaries

### The Problem

A critical bug was discovered where phantom faces were being rendered outside chunk boundaries when solid neighboring data was present in the padding. Specifically:

- **Symptom**: A 30x30 face would appear 1 voxel below the chunk boundary, facing downward
- **Visibility**: The phantom face could be seen when the camera was positioned below the chunk
- **Condition**: Only occurred when there was solid neighboring data in the padding layer

### Root Cause Analysis

The issue was in the binary greedy meshing face culling logic. Here's what was happening:

1. **Binary Encoding**: Chunks are encoded as 32x32x32 with padding (positions 0-31)
   - Bit 0: Padding below chunk
   - Bits 1-30: Actual chunk data  
   - Bit 31: Padding above chunk

2. **Face Culling**: The algorithm correctly used padding data for neighbor-aware face culling
   - `thisTypeCol & ~(allSolidCol << 1)` for -Y faces
   - This correctly prevented faces when solid neighbors existed

3. **The Bug**: Face culling results included ALL 32 bits, including padding positions
   - Face masks were stored as 30x30x30 but each integer contained 32 bits
   - Bit 0 (padding position) could be set in face masks
   - Greedy meshing would find bit 0 and create a quad at y=0
   - Vertex generation used `y-1`, placing the face at y=-1 (outside chunk bounds)

### The Solution

Applied a bit mask `0x7FFFFFFE` to exclude padding bits (0 and 31) from face mask results:

```typescript
// CRITICAL: Mask to only include chunk positions (bits 1-30)
// Excludes padding positions (bits 0 and 31) to prevent phantom faces
const chunkMask = 0x7FFFFFFE; // 01111111111111111111111111111110
faceMasks[1][0][z - 1][x - 1] = (thisTypeCol & ~(allSolidCol << 1)) & chunkMask;
```

This ensures:
- ✅ Padding data is still used for correct neighbor-aware face culling
- ✅ Only chunk interior positions (1-30) can generate faces
- ✅ No phantom faces outside chunk boundaries
- ✅ Maintains rendering efficiency and correctness

### Key Insights

1. **Subtle 32→30 Transition**: The transition from 32-bit padded data to 30-bit chunk data was incomplete
2. **Bit Operations Complexity**: The face culling logic was correct, but the result storage included unwanted bits
3. **Debug Strategy**: Binary logging was essential to understand the bit-level operations
4. **Neighbor Data Necessity**: Padding data is crucial for efficient face culling - removing it would force rendering unnecessary faces at chunk boundaries

### Debugging Process

The bug was identified through:
1. Visual observation of phantom faces below chunk boundaries
2. Debug logging showing all -Y faces had bit 0 set (`00000001`)
3. Detailed bit operation logging revealing padding bits in face mask results
4. Understanding that face generation should only occur for chunk interior positions

This was an extremely subtle bug that required deep understanding of the binary encoding, face culling operations, and the relationship between padding data and face generation.

## Visual Enhancement Roadmap

This section tracks planned visual improvements to make the terrain more visually appealing. Each enhancement is rated for Visual Impact, Performance Cost, and Implementation Complexity.

### Enhancement Priority List

#### 1. **Ambient Occlusion** ⭐⭐⭐⭐⭐ [x]
- **Visual Impact**: HIGH - Makes voxels look much more 3D and realistic
- **Performance**: MEDIUM - Optimized with vertex-based AO and block-type awareness
- **Complexity**: MEDIUM - Implemented with advanced features
- **Status**: Completed
- **Implementation**: 
  - Vertex-based AO with 8-corner sampling pattern
  - Block-type aware occlusion weights (stone, terrain, water)
  - Specialized water AO to prevent ocean artifacts
  - Chunk boundary clamping to eliminate seams
  - Debug toggle for comparison (ON/OFF)
- **Notes**: Successfully implemented with strong visual impact and clean artifact-free rendering

#### 2. **Distance Fog** ⭐⭐⭐⭐ [x]
- **Visual Impact**: HIGH - Adds depth and atmosphere
- **Performance**: LOW - Simple fragment shader effect
- **Complexity**: LOW - Easy to implement
- **Status**: Completed
- **Implementation**:
  - Three.js fog integration with scene-level application
  - Configurable near/far distances and color
  - Debug panel controls with live adjustment sliders
  - Automatic material compatibility (works with vertex colors)
- **Notes**: Successfully implemented with dramatic atmospheric improvement and negligible performance impact

#### 3. **Texture Atlas/Block Textures** ⭐⭐⭐⭐⭐ [ ]
- **Visual Impact**: VERY HIGH - Transforms from solid colors to realistic blocks
- **Performance**: LOW - Actually improves performance vs multiple materials  
- **Complexity**: MEDIUM - Need to modify material system and UV mapping
- **Status**: Not started
- **Implementation**: Transforms entire visual aesthetic

#### 4. **Improved Lighting Model** ⭐⭐⭐⭐ [✓]
- **Visual Impact**: HIGH - Better light falloff and shadows
- **Performance**: MEDIUM - Modern GPUs handle this well
- **Complexity**: LOW-MEDIUM - Three.js built-in improvements
- **Status**: **COMPLETED** 
- **Notes**: Enhanced with multiple light sources, better shadows, and natural color temperatures

#### 5. **Post-Processing Pipeline** ⭐⭐⭐⭐ [ ]
- **Visual Impact**: MEDIUM-HIGH - Bloom, tone mapping, HDR
- **Performance**: MEDIUM - Manageable with good pipeline
- **Complexity**: MEDIUM - Three.js has good post-processing support
- **Status**: Not Started
- **Notes**: Enables multiple visual effects

#### 6. **Biome-Specific Color Variations** ⭐⭐⭐ [ ]
- **Visual Impact**: MEDIUM - More natural looking terrain
- **Performance**: LOW - Just color interpolation
- **Complexity**: LOW - Modify existing color system
- **Status**: Not Started
- **Notes**: Easy polish enhancement

#### 7. **Simple Bloom/HDR** ⭐⭐⭐ [ ]
- **Visual Impact**: MEDIUM - Makes bright areas pop
- **Performance**: MEDIUM - Standard post-processing
- **Complexity**: LOW - Three.js has built-in bloom
- **Status**: Not Started
- **Notes**: Part of post-processing pipeline

#### 8. **God Rays/Volumetric Lighting** ⭐⭐⭐ [ ]
- **Visual Impact**: MEDIUM-HIGH - Beautiful but situational
- **Performance**: HIGH COST - Expensive screen-space effects
- **Complexity**: HIGH - Complex implementation
- **Status**: Not Started
- **Notes**: Save for final polish phase

### Implementation Guidelines

- **Performance Budget**: Maintain 60fps on mid-range hardware
- **Mobile Considerations**: Ensure effects can be scaled down or disabled
- **Shader Complexity**: Keep fragment shaders optimized for older GPUs
- **Testing Strategy**: Profile each enhancement individually before combining

### Current Focus

Starting with **Improved Lighting Model** as it provides a solid foundation for other lighting-based effects and has good visual impact for moderate complexity.

---

# 📅 **Next Week Development Plan**

## **Priority 1: Implement Texture Atlas System** 🎨

---

## **Priority 2: Implement Player Character** 🏃
**Goal**: Add controllable player with physics and collision

### Phase 2A: Basic Player Entity
- [ ] **Create Player component** (simple pill/capsule geometry)
- [ ] **Add to scene** with initial spawn position
- [ ] **Basic rendering** with distinct color/material

### Phase 2B: Player Movement
- [ ] **WASD movement** on ground plane
- [ ] **Mouse look** for camera rotation (first-person)
- [ ] **Jump mechanics** with gravity simulation
- [ ] **Movement smoothing** and acceleration/deceleration

### Phase 2C: Terrain Collision
- [ ] **Collision detection** with voxel terrain
- [ ] **Ground detection** for proper jumping/landing
- [ ] **Wall collision** prevention
- [ ] **Step-up mechanics** for single voxel height differences

**Expected Result**: Playable character that can run, jump, and interact with voxel terrain naturally

---

## **Priority 3: Debug Mode Toggle** 🎮
**Goal**: Switch between flying camera and player modes

### Tasks:
- [ ] **Add debug mode state** to render config
- [ ] **Debug panel toggle** for "Flight Mode" vs "Player Mode"
- [ ] **Conditional camera controls** based on mode
- [ ] **Player input handling** when in player mode
- [ ] **Smooth transitions** between modes

**Expected Result**: Press button to toggle between creative flying and survival player modes

---

## **Priority 4: API Foundation for Multiplayer** 🌐
**Goal**: Backend infrastructure for socket-based multiplayer

### Phase 4A: Basic Socket Server
- [ ] **Create Node.js server** with Express + Socket.io
- [ ] **Basic connection handling** and room management
- [ ] **Player position sync** between clients
- [ ] **Simple message broadcasting**

### Phase 4B: Client Integration
- [ ] **Socket.io client setup** in React app
- [ ] **Connection management** and reconnection logic
- [ ] **Player position updates** sent to server
- [ ] **Other players rendering** in local world

### Phase 4C: Basic Protocol
- [ ] **Define message types** (join, move, disconnect, etc.)
- [ ] **Position interpolation** for smooth other-player movement
- [ ] **Basic latency handling** and prediction

**Expected Result**: Multiple players can see each other moving in the same world

---

## **Priority 5: Basic Voxel Editing** ⛏️
**Goal**: Add/remove individual voxels with mouse interaction

### Phase 5A: Raycasting System
- [ ] **Implement raycasting** from camera/player position
- [ ] **Voxel hit detection** with face identification
- [ ] **Visual feedback** for targeted voxel (highlight/outline)

### Phase 5B: Edit Operations
- [ ] **Left-click to destroy** voxel (set to AIR)
- [ ] **Right-click to place** voxel (current selected type)
- [ ] **Block type selector** in UI (stone, dirt, grass, etc.)
- [ ] **Range limiting** (can't edit too far away)

### Phase 5C: World Updates
- [ ] **Chunk regeneration** after voxel changes
- [ ] **Efficient updates** (only affected chunks)
- [ ] **Multiplayer sync** of voxel changes
- [ ] **Persistence** of world modifications

**Expected Result**: Click to mine/place blocks like Minecraft, with changes synced across players

---

## **Implementation Order & Dependencies**

```
Week Schedule:
Monday-Tuesday: Priority 1 (Texture Atlas Fix)
Wednesday: Priority 2A-2B (Player Entity & Movement)  
Thursday: Priority 2C + Priority 3 (Collision & Debug Toggle)
Friday: Priority 4A (Basic Socket Server)
Weekend/Next: Priority 4B-4C + Priority 5 (Client Integration & Voxel Editing)
```

## **Technical Considerations**

### **Performance Targets**:
- Maintain 60fps with player + multiplayer
- Efficient chunk updates for voxel editing
- Smooth interpolation for networked players

### **Code Organization**:
- Keep player logic separate from terrain rendering
- Modular multiplayer system for easy expansion  
- Clean separation between debug and gameplay modes

### **Testing Strategy**:
- Test each feature individually before integration
- Profile performance impact of each addition
- Validate multiplayer with multiple browser tabs

This plan transforms the current terrain viewer into a playable multiplayer voxel game foundation! 🎮