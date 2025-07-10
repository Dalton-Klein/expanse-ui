import * as THREE from "three";
import { VoxelType } from "../../types";

// Material system for voxel2 - colors, textures, properties
// Single source of truth for all voxel colors

// Voxel color definitions - SINGLE SOURCE OF TRUTH
export const VoxelColors: { [key in VoxelType]: string } = {
  [VoxelType.AIR]: "#000000", // Black (shouldn't be visible)
  [VoxelType.STONE]: "#808080", // Gray
  [VoxelType.GRASS]: "#4caf50", // Green
  [VoxelType.DIRT]: "#8d6e63", // Brown
  [VoxelType.SAND]: "#fdd835", // Sandy yellow
  [VoxelType.WATER]: "#2196f3", // Blue
  [VoxelType.SNOW]: "#fffafa", // Snow white
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

/**
 * Get THREE.Color for a voxel type
 * Used by renderers that need THREE.js Color objects
 */
export function getThreeColor(voxelType: VoxelType): THREE.Color {
  return new THREE.Color(VoxelColors[voxelType]);
}

/**
 * Get RGB values (0-1 range) for a voxel type
 * Used by renderers that need raw RGB components
 */
export function getRGB(voxelType: VoxelType): [number, number, number] {
  const color = new THREE.Color(VoxelColors[voxelType]);
  return [color.r, color.g, color.b];
}

/**
 * Get hex color string for a voxel type
 * Used for CSS or other string-based color needs
 */
export function getHexColor(voxelType: VoxelType): string {
  return VoxelColors[voxelType];
}

export class MaterialSystem {
  // Get color for voxel type (legacy support)
  static getColor(voxelType: VoxelType): string {
    return VoxelColors[voxelType];
  }

  // Get THREE.Color for voxel type
  static getThreeColor(voxelType: VoxelType): THREE.Color {
    return getThreeColor(voxelType);
  }

  // Get RGB components for voxel type
  static getRGB(voxelType: VoxelType): [number, number, number] {
    return getRGB(voxelType);
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
