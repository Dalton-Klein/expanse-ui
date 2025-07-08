import { VoxelType } from "../../types";

// Material system for voxel2 - colors, textures, properties
// TODO: Implement comprehensive material system

// Voxel color definitions
export const VoxelColors: { [key in VoxelType]: string } = {
  [VoxelType.AIR]: "#87CEEB", // Sky blue (shouldn't be visible)
  [VoxelType.STONE]: "#696969", // Dark gray
  [VoxelType.GRASS]: "#228B22", // Forest green
  [VoxelType.DIRT]: "#8B4513", // Saddle brown
  [VoxelType.SAND]: "#F4A460", // Sandy brown
  [VoxelType.WATER]: "#4682B4", // Steel blue
};

// TODO: Add material properties
export interface MaterialProperties {
  color: string;
  // TODO: Add texture, opacity, roughness, etc.
}

// TODO: Implement material system utilities:
// - Color conversion
// - Texture mapping
// - Material variants
// - Debug material overrides

export class MaterialSystem {
  // Get color for voxel type
  static getColor(voxelType: VoxelType): string {
    return VoxelColors[voxelType];
  }

  // TODO: Add material utilities:
  // - getTexture()
  // - getMaterialProperties()
  // - createDebugMaterial()
  // - validateMaterial()
}

// TODO: Add material validation
// TODO: Add material loading system
// TODO: Add material animation support
