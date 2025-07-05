import { VoxelType } from "./types";

export class FlatTerrainGenerator {
  private flatHeight: number;
  private seaLevel: number;

  constructor(seaLevel: number = 15) {
    this.seaLevel = seaLevel;
    this.flatHeight = seaLevel + 1; // One block above sea level
  }

  // Generate height at world coordinates - always returns flat height
  getHeightAt(worldX: number, worldZ: number): number {
    return this.flatHeight;
  }

  // Generate voxel type at specific world coordinates
  getVoxelAt(worldX: number, worldY: number, worldZ: number): VoxelType {
    // Simple flat world: grass at flat height, air above, stone below
    if (worldY > this.flatHeight) {
      return VoxelType.AIR;
    } else if (worldY === this.flatHeight) {
      return VoxelType.GRASS; // Grass surface
    } else if (worldY >= this.flatHeight - 3) {
      return VoxelType.DIRT; // Dirt layer beneath grass
    } else {
      return VoxelType.STONE; // Stone below dirt
    }
  }

  // Sample voxels for LOD with surface material priority (same logic as normal terrain)
  sampleVoxelArea(startX: number, startY: number, startZ: number, scale: number): VoxelType {
    const voxelCounts = new Map<VoxelType, number>();
    const surfaceMaterials = new Map<VoxelType, number>();
    let totalSolid = 0;

    // Sample the area, giving priority to surface materials
    for (let x = startX; x < startX + scale; x++) {
      for (let y = startY; y < startY + scale; y++) {
        for (let z = startZ; z < startZ + scale; z++) {
          const voxelType = this.getVoxelAt(x, y, z);
          
          if (voxelType !== VoxelType.AIR) {
            totalSolid++;
            voxelCounts.set(voxelType, (voxelCounts.get(voxelType) || 0) + 1);
            
            // Check if this is a surface voxel (has air above it)
            const voxelAbove = this.getVoxelAt(x, y + 1, z);
            if (voxelAbove === VoxelType.AIR) {
              surfaceMaterials.set(voxelType, (surfaceMaterials.get(voxelType) || 0) + 1);
            }
          }
        }
      }
    }

    // If less than 50% of the area is solid, return AIR
    const totalVoxels = scale * scale * scale;
    if (totalSolid < totalVoxels * 0.5) {
      return VoxelType.AIR;
    }

    // Prioritize surface materials if they exist
    if (surfaceMaterials.size > 0) {
      let mostCommonSurfaceType = VoxelType.GRASS;
      let maxSurfaceCount = 0;
      for (const [type, count] of surfaceMaterials) {
        if (count > maxSurfaceCount) {
          maxSurfaceCount = count;
          mostCommonSurfaceType = type;
        }
      }
      return mostCommonSurfaceType;
    }

    // Return the most common solid voxel type
    let mostCommonType = VoxelType.STONE;
    let maxCount = 0;
    for (const [type, count] of voxelCounts) {
      if (count > maxCount) {
        maxCount = count;
        mostCommonType = type;
      }
    }

    return mostCommonType;
  }
}