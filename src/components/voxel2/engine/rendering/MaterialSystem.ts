import * as THREE from "three";
import { VoxelType } from "../../types";
import { atlasVertexShader, atlasFragmentShader } from "./atlasShaders";

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

// Material properties interface
export interface MaterialProperties {
  color: string;
  hasTexture?: boolean;
  textureAtlasPath?: string;
  opacity?: number;
  roughness?: number;
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
  private static textureAtlas: THREE.Texture | null = null;
  private static individualTextures: Map<VoxelType, THREE.Texture> = new Map();
  private static textureLoader = new THREE.TextureLoader();

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

  /**
   * Load the texture atlas asynchronously
   * Returns a promise that resolves to the loaded texture
   */
  static async loadTextureAtlas(): Promise<THREE.Texture> {
    if (this.textureAtlas) {
      return this.textureAtlas;
    }

    return new Promise((resolve, reject) => {
      this.textureLoader.load(
        '/texture_atlas.png',
        (texture) => {
          // Configure texture settings for pixel art / voxel style
          texture.magFilter = THREE.NearestFilter; // Crisp pixel art look
          texture.minFilter = THREE.NearestFilter; // No blurring - Linear was causing blur artifacts
          texture.generateMipmaps = false; // OR provide padded mipmaps
          texture.wrapS = THREE.RepeatWrapping; // Allow UV repetition (reverted)
          texture.wrapT = THREE.RepeatWrapping; // Allow UV repetition (reverted)
          texture.flipY = false; // Match our UV coordinate system
          
          console.log('[MaterialSystem] Reverted to NearestFilter - LinearFilter was causing blur artifacts');
          
          this.textureAtlas = texture;
          console.log('[MaterialSystem] Texture atlas loaded successfully');
          resolve(texture);
        },
        (progress) => {
          console.log('[MaterialSystem] Loading texture atlas:', (progress.loaded / progress.total * 100) + '%');
        },
        (error) => {
          console.error('[MaterialSystem] Failed to load texture atlas:', error);
          reject(error);
        }
      );
    });
  }

  /**
   * Get the loaded texture atlas, or null if not loaded
   */
  static getTextureAtlas(): THREE.Texture | null {
    return this.textureAtlas;
  }

  /**
   * Create atlas bounds array for shader uniforms
   * Maps each VoxelType to its texture atlas bounds [uMin, vMin, uMax, vMax]
   */
  private static getAtlasBounds(): THREE.Vector4[] {
    const atlasWidth = 320;
    const atlasHeight = 320;
    const textureSize = 32;
    const textureWidth = textureSize / atlasWidth; // 0.1
    const textureHeight = textureSize / atlasHeight; // 0.1
    
    const bounds: THREE.Vector4[] = [];
    
    // Create bounds for each voxel type based on texture atlas layout
    // Atlas layout: grass_top, grass_side, dirt, stone, snow, water, sand
    const typeToIndex: { [key in VoxelType]: number } = {
      [VoxelType.AIR]: 2, // Default to dirt
      [VoxelType.STONE]: 3,
      [VoxelType.GRASS]: 0, // grass_top for now (will handle face direction later)
      [VoxelType.DIRT]: 2,
      [VoxelType.SAND]: 6,
      [VoxelType.WATER]: 5,
      [VoxelType.SNOW]: 4,
    };
    
    // Create bounds array indexed by VoxelType enum values
    for (let i = 0; i < 7; i++) {
      const textureIndex = i < Object.keys(typeToIndex).length ? 
        Object.values(typeToIndex)[i] : 2; // Default to dirt
      
      const uMin = textureIndex * textureWidth;
      const uMax = (textureIndex + 1) * textureWidth;
      const vMin = 0;
      const vMax = textureHeight;
      console.log('test???', uMin, uMax, vMin, vMax);
      bounds.push(new THREE.Vector4(uMin, vMin, uMax, vMax));
    }
    
    return bounds;
  }

  /**
   * Create a custom shader material for texture atlas repetition
   * Uses custom shaders to handle proper texture repetition in greedy quads
   */
  static createTexturedMaterial(options: {
    wireframe?: boolean;
    side?: THREE.Side;
  } = {}): THREE.Material {
    const texture = this.getTextureAtlas();
    
    console.log('[MaterialSystem] createTexturedMaterial called:', {
      textureExists: !!texture,
      wireframe: options.wireframe,
      side: options.side
    });
    
    if (!texture) {
      console.warn('[MaterialSystem] Texture atlas not loaded, falling back to vertex colors');
      return this.createColorOnlyMaterial(options);
    }
    
    console.log('[MaterialSystem] Creating ShaderMaterial with texture atlas');
    console.log('[MaterialSystem] DEBUG: Lighting calculation BYPASSED - showing texture + AO only');

    // Create custom shader material for texture atlas repetition
    return new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: texture },
        uAtlasBounds: { value: this.getAtlasBounds() },
        uDebugUV: { value: false }, // UV debug visualization mode
        uDebugLighting: { value: true }, // TEMP: Bypass lighting to test if lighting is the issue
        
        // Lighting uniforms (match scene lighting setup)
        uAmbientLight: { value: new THREE.Color("#87CEEB").multiplyScalar(0.3) }, // Sky blue ambient
        uDirectionalLightColor: { value: new THREE.Color("#FFF8DC").multiplyScalar(2.0) }, // Warm sun light
        uDirectionalLightDirection: { value: new THREE.Vector3(100, 150, 50).normalize() }, // Sun direction
        
        // Fog uniforms
        uFogColor: { value: new THREE.Color(0x87CEEB) },
        uFogNear: { value: 75 },
        uFogFar: { value: 650 },
        uUseFog: { value: true },
      },
      vertexShader: atlasVertexShader,
      fragmentShader: atlasFragmentShader,
      wireframe: options.wireframe || false,
      side: options.side || THREE.FrontSide,
      transparent: true,
      opacity: 0.95, // Slight transparency to visually confirm texture mode is active
    });
  }

  /**
   * Create a color-only material (for fallback or debug mode)
   */
  static createColorOnlyMaterial(options: {
    wireframe?: boolean;
    side?: THREE.Side;
  } = {}): THREE.Material {
    return new THREE.MeshLambertMaterial({
      vertexColors: true,
      wireframe: options.wireframe || false,
      side: options.side || THREE.FrontSide,
    });
  }
}

// TODO: Add material validation
// TODO: Add material loading system
// TODO: Add material animation support
