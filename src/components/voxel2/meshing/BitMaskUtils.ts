// Utility functions for bitwise operations used in binary greedy meshing
// These operations allow us to process 64 voxels simultaneously
// Using modern bigint literals (0n, 1n) for clean, performant code

export class BitMaskUtils {
  // Create a mask with all bits set to 1
  static allOnes(): bigint {
    return ~0n;
  }
  
  // Create a mask with bits set in a range
  static rangeMask(start: number, end: number): bigint {
    const count = end - start;
    if (count >= 64) return this.allOnes();
    if (count <= 0) return 0n;
    
    const mask = (1n << BigInt(count)) - 1n;
    return mask << BigInt(start);
  }
  
  // Count number of set bits (population count)
  static popCount(mask: bigint): number {
    let count = 0;
    let m = mask;
    while (m !== 0n) {
      count++;
      m &= m - 1n; // Clear least significant set bit
    }
    return count;
  }
  
  // Find position of first set bit (least significant)
  static firstSetBit(mask: bigint): number {
    if (mask === 0n) return -1;
    
    let pos = 0;
    let m = mask;
    while ((m & 1n) === 0n) {
      m >>= 1n;
      pos++;
    }
    return pos;
  }
  
  // Find position of last set bit (most significant)
  static lastSetBit(mask: bigint): number {
    if (mask === 0n) return -1;
    
    let pos = 0;
    let m = mask;
    while (m !== 0n) {
      m >>= 1n;
      pos++;
    }
    return pos - 1;
  }
  
  // Extract a contiguous run of set bits starting from position
  static extractRun(mask: bigint, startPos: number): { start: number, length: number } {
    if ((mask & (1n << BigInt(startPos))) === 0n) {
      return { start: startPos, length: 0 };
    }
    
    let length = 0;
    let pos = startPos;
    
    while (pos < 64 && (mask & (1n << BigInt(pos))) !== 0n) {
      length++;
      pos++;
    }
    
    return { start: startPos, length };
  }
  
  // Shift and combine two masks (useful for cross-boundary operations)
  static shiftCombine(low: bigint, high: bigint, shift: number): bigint {
    if (shift === 0) return low;
    if (shift >= 64) return high;
    
    const lowPart = low >> BigInt(shift);
    const highPart = high << BigInt(64 - shift);
    return lowPart | highPart;
  }
  
  // Perform face culling operation between two adjacent columns
  static cullFaces(current: bigint, neighbor: bigint): bigint {
    // A face is visible if current voxel is solid and neighbor is air
    // This is equivalent to: current AND (NOT neighbor)
    return current & ~neighbor;
  }
  
  // Expand a mask in a direction (used for greedy quad expansion)
  static expandMask(
    baseMask: bigint, 
    testMask: bigint, 
    direction: 'horizontal' | 'vertical'
  ): bigint {
    if (direction === 'horizontal') {
      // Check if we can expand horizontally
      // All bits in baseMask must also be set in testMask
      return (baseMask & testMask) === baseMask ? baseMask : 0n;
    } else {
      // For vertical expansion, we need to check bit-by-bit
      return this.verticalExpand(baseMask, testMask);
    }
  }
  
  // Check if vertical expansion is possible
  private static verticalExpand(baseMask: bigint, testMask: bigint): bigint {
    // For each set bit in baseMask, check if corresponding bit is set in testMask
    let result = 0n;
    let base = baseMask;
    let pos = 0;
    
    while (base !== 0n && pos < 64) {
      if ((base & 1n) !== 0n) {
        if ((testMask & (1n << BigInt(pos))) !== 0n) {
          result |= 1n << BigInt(pos);
        } else {
          // Can't expand this bit
          return 0n;
        }
      }
      base >>= 1n;
      pos++;
    }
    
    return result;
  }
  
  // Find largest rectangle of set bits in a 2D bit array
  static findLargestRectangle(
    masks: bigint[][], 
    startX: number, 
    startY: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number, height: number, mask: bigint } {
    if (!masks[startX] || masks[startX][startY] === 0n) {
      return { width: 0, height: 0, mask: 0n };
    }
    
    let baseMask = masks[startX][startY];
    let width = 1;
    let height = this.popCount(baseMask);
    
    // Try to expand horizontally
    for (let x = startX + 1; x < startX + maxWidth && x < masks.length; x++) {
      const testMask = masks[x][startY];
      const combined = baseMask & testMask;
      
      if (combined === 0n) break;
      
      baseMask = combined;
      width++;
    }
    
    // Update height based on final mask
    height = this.popCount(baseMask);
    
    return { width, height, mask: baseMask };
  }
  
  // Convert bigint mask to array of set bit positions
  static maskToPositions(mask: bigint): number[] {
    const positions: number[] = [];
    let m = mask;
    let pos = 0;
    
    while (m !== 0n) {
      if ((m & 1n) !== 0n) {
        positions.push(pos);
      }
      m >>= 1n;
      pos++;
    }
    
    return positions;
  }
  
  // Create a mask from array of bit positions
  static positionsToMask(positions: number[]): bigint {
    let mask = 0n;
    for (const pos of positions) {
      mask |= 1n << BigInt(pos);
    }
    return mask;
  }
  
  // Debug helper: convert mask to binary string
  static toBinaryString(mask: bigint, width: number = 64): string {
    const str = mask.toString(2).padStart(width, '0');
    return str.slice(-width);
  }
  
  // Debug helper: visualize 2D mask array
  static visualizeMaskArray(masks: bigint[][], height: number = 64): string {
    const lines: string[] = [];
    
    for (let y = 0; y < height; y++) {
      let line = '';
      for (let x = 0; x < masks.length; x++) {
        const maskIndex = Math.floor(y / 64);
        const bitIndex = y % 64;
        const mask = masks[x][maskIndex] || 0n;
        const bit = (mask >> BigInt(bitIndex)) & 1n;
        line += bit ? '█' : '·';
      }
      lines.push(line);
    }
    
    return lines.reverse().join('\n'); // Reverse to show Y=0 at bottom
  }
}