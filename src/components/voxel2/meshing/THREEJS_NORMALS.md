# Three.js Face Normal Reference

## Vertex Winding Order Rules

Three.js uses **counter-clockwise vertex winding order** when viewed from the **outside** of a face to determine the face normal direction. This is critical for proper lighting and backface culling.

## Correct Vertex Order for Each Face

### X-Axis Faces

#### +X Face (Right/East)
- **View from**: Positive X direction (looking west)
- **Normal points**: +X direction (1, 0, 0)
- **Vertex order**: Counter-clockwise when viewed from +X
```
3---2
|   |
0---1
```

#### -X Face (Left/West)
- **View from**: Negative X direction (looking east)
- **Normal points**: -X direction (-1, 0, 0)
- **Vertex order**: Counter-clockwise when viewed from -X
```
2---3
|   |
1---0
```

### Y-Axis Faces

#### +Y Face (Top)
- **View from**: Above (positive Y direction, looking down)
- **Normal points**: +Y direction (0, 1, 0)
- **Vertex order**: Counter-clockwise when viewed from above
```
0---1
|   |
3---2
```

#### -Y Face (Bottom)
- **View from**: Below (negative Y direction, looking up)
- **Normal points**: -Y direction (0, -1, 0)
- **Vertex order**: Counter-clockwise when viewed from below
```
3---2
|   |
0---1
```

### Z-Axis Faces

#### +Z Face (Front/South)
- **View from**: Positive Z direction (looking north)
- **Normal points**: +Z direction (0, 0, 1)
- **Vertex order**: Counter-clockwise when viewed from +Z
```
2---3
|   |
1---0
```

#### -Z Face (Back/North)
- **View from**: Negative Z direction (looking south)
- **Normal points**: -Z direction (0, 0, -1)
- **Vertex order**: Counter-clockwise when viewed from -Z
```
3---2
|   |
0---1
```

## Implementation in Code

### Correct Implementation (from GreedyQuadGenerator.ts)

```typescript
// X-Axis Faces
if (facePositive) {
  // +X face
  vertices.push(
    new THREE.Vector3(x, v, u),
    new THREE.Vector3(x, v + height, u),
    new THREE.Vector3(x, v + height, u + width),
    new THREE.Vector3(x, v, u + width)
  );
} else {
  // -X face
  vertices.push(
    new THREE.Vector3(x, v, u + width),
    new THREE.Vector3(x, v + height, u + width),
    new THREE.Vector3(x, v + height, u),
    new THREE.Vector3(x, v, u)
  );
}

// Y-Axis Faces  
if (facePositive) {
  // +Y face
  vertices.push(
    new THREE.Vector3(u, y, v + height),
    new THREE.Vector3(u + width, y, v + height),
    new THREE.Vector3(u + width, y, v),
    new THREE.Vector3(u, y, v)
  );
} else {
  // -Y face
  vertices.push(
    new THREE.Vector3(u, y, v),
    new THREE.Vector3(u + width, y, v),
    new THREE.Vector3(u + width, y, v + height),
    new THREE.Vector3(u, y, v + height)
  );
}

// Z-Axis Faces
if (facePositive) {
  // +Z face
  vertices.push(
    new THREE.Vector3(u + width, v, z),
    new THREE.Vector3(u + width, v + height, z),
    new THREE.Vector3(u, v + height, z),
    new THREE.Vector3(u, v, z)
  );
} else {
  // -Z face
  vertices.push(
    new THREE.Vector3(u, v, z),
    new THREE.Vector3(u, v + height, z),
    new THREE.Vector3(u + width, v + height, z),
    new THREE.Vector3(u + width, v, z)
  );
}
```

## Common Mistakes

1. **Using the same vertex order for opposite faces**: Each face direction needs its own specific vertex order
2. **Clockwise instead of counter-clockwise**: Results in inverted normals (faces appear dark/inside-out)
3. **Viewing perspective confusion**: Always consider "viewed from outside" when determining vertex order

## Testing Tips

1. **Enable wireframe mode**: `material.wireframe = true` to see face orientation
2. **Use directional lighting**: Makes incorrect normals obvious (dark faces)
3. **Enable backface culling**: `material.side = THREE.FrontSide` to hide incorrectly oriented faces
4. **Check with different camera angles**: Ensure all faces are visible from their expected viewing direction

## References

- [Three.js Face Culling Documentation](https://threejs.org/docs/#api/en/materials/Material.side)
- [WebGL Winding Order Specification](https://www.khronos.org/opengl/wiki/Face_Culling)