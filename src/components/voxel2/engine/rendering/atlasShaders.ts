// Shader code for texture atlas repetition
// Handles proper texture repetition for greedy-meshed voxel quads

export const atlasVertexShader = `
  // Custom vertex attributes (Three.js provides uv, position, normal automatically)
  attribute vec3 color;
  attribute float blockType;

  // Varyings to fragment shader
  varying vec2 vLocalUV;
  varying vec3 vVertexColor;
  varying float vBlockType;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    // Pass through vertex color for ambient occlusion
    vVertexColor = color;
    
    // Pass through block type for atlas lookup
    vBlockType = blockType;
    
    // Pass local UV coordinates (these extend beyond 0-1 for repetition)
    vLocalUV = uv;
    
    // Transform normal for lighting
    vNormal = normalize(normalMatrix * normal);
    
    // Calculate world position for lighting
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    
    // Standard vertex transformation
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const atlasFragmentShader = `
  precision mediump float;

  // Uniforms
  uniform sampler2D uTexture;
  uniform vec4 uAtlasBounds[7]; // Atlas bounds for each block type [uMin, vMin, uMax, vMax]
  uniform bool uDebugUV; // Debug mode to visualize UV coordinates
  uniform bool uDebugLighting; // Debug mode to bypass lighting calculation
  
  // Lighting uniforms (simplified Lambert model)
  uniform vec3 uAmbientLight;
  uniform vec3 uDirectionalLightColor;
  uniform vec3 uDirectionalLightDirection;
  
  // Fog uniforms (if enabled)
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform bool uUseFog;

  // Varyings from vertex shader
  varying vec2 vLocalUV;
  varying vec3 vVertexColor;
  varying float vBlockType;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    // Get atlas bounds for this block type
    int blockIndex = int(vBlockType);
    vec4 bounds = uAtlasBounds[blockIndex];
    vec2 atlasMin = bounds.xy;
    vec2 atlasMax = bounds.zw;
    
    // Create repeating UV pattern using fract() - this is the key!
    vec2 tiledUV = clamp(fract(vLocalUV), 0.001, 0.999);
    
    // Debug UV visualization mode
    if (uDebugUV) {
      // Show vLocalUV as red/green, tiledUV as blue intensity
      vec3 debugColor = vec3(
        mod(vLocalUV.x, 1.0),  // Red channel: original U coord (mod 1)
        mod(vLocalUV.y, 1.0),  // Green channel: original V coord (mod 1) 
        length(tiledUV)        // Blue channel: magnitude of fract result
      );
      gl_FragColor = vec4(debugColor, 1.0);
      return;
    }
    
    // Map tiled UV to atlas bounds for this block type
    vec2 atlasUV = atlasMin + tiledUV * (atlasMax - atlasMin);
    
    // Sample texture from atlas
    vec4 texColor = texture2D(uTexture, atlasUV);
    
    // Apply vertex colors (ambient occlusion)
    vec3 finalColor = texColor.rgb * vVertexColor;
    
    // Debug mode: bypass lighting calculation to isolate lighting issues
    if (uDebugLighting) {
      // Show texture + AO only, no lighting calculation
      gl_FragColor = vec4(finalColor, texColor.a);
      return;
    }
    
    // Simple Lambert lighting
    float lightDot = max(dot(vNormal, -uDirectionalLightDirection), 0.0);
    vec3 lightColor = uAmbientLight + uDirectionalLightColor * lightDot;
    finalColor *= lightColor;
    
    // Apply fog if enabled
    if (uUseFog) {
      float depth = gl_FragCoord.z / gl_FragCoord.w;
      float fogFactor = smoothstep(uFogNear, uFogFar, depth);
      finalColor = mix(finalColor, uFogColor, fogFactor);
    }
    
    gl_FragColor = vec4(finalColor, texColor.a);
    gl_FragColor.rgb = abs(vLocalUV.xyx);
  }
`;