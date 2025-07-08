// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock Canvas API for Three.js
global.HTMLCanvasElement.prototype.getContext = () => ({
  fillStyle: '',
  fillRect: jest.fn(),
  clearRect: jest.fn(),
  getImageData: jest.fn(() => ({ data: [] })),
  putImageData: jest.fn(),
  createImageData: jest.fn(() => []),
  setTransform: jest.fn(),
  drawImage: jest.fn(),
  save: jest.fn(),
  restore: jest.fn(),
  scale: jest.fn(),
  rotate: jest.fn(),
  translate: jest.fn(),
  transform: jest.fn(),
  beginPath: jest.fn(),
  closePath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  clip: jest.fn(),
  arc: jest.fn(),
  fill: jest.fn(),
  stroke: jest.fn(),
  measureText: jest.fn(() => ({ width: 0 })),
});

// Mock @react-three/fiber
jest.mock('@react-three/fiber', () => ({
  Canvas: ({ children }) => children,
  useFrame: jest.fn(),
  useThree: jest.fn(),
  useLoader: jest.fn(),
  extend: jest.fn(),
}));

// Mock @react-three/drei
jest.mock('@react-three/drei', () => ({
  Sky: () => null,
  OrbitControls: () => null,
  Stats: () => null,
  Box: () => null,
  Sphere: () => null,
  Plane: () => null,
}));

// Mock Three.js
jest.mock('three', () => {
  class MockBufferGeometry {
    constructor() {
      this.attributes = {};
      this.index = null;
    }
    
    setAttribute(name, attribute) {
      this.attributes[name] = attribute;
    }
    
    setIndex(indices) {
      this.index = { count: indices.length };
    }
    
    computeVertexNormals() {}
  }
  
  return {
    BufferGeometry: MockBufferGeometry,
    BoxGeometry: jest.fn(),
    MeshBasicMaterial: jest.fn(),
    Mesh: jest.fn(),
    Scene: jest.fn(),
    PerspectiveCamera: jest.fn(),
    WebGLRenderer: jest.fn(),
    Vector3: jest.fn(),
    Color: jest.fn(),
    DirectionalLight: jest.fn(),
    AmbientLight: jest.fn(),
    Float32BufferAttribute: jest.fn().mockImplementation((array, itemSize) => ({
      array,
      itemSize,
      count: array.length / itemSize,
    })),
    DoubleSide: 'DoubleSide',
    FrontSide: 'FrontSide',
    BackSide: 'BackSide',
  };
});
