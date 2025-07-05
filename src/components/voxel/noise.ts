// Simple Perlin noise implementation for terrain generation
export class PerlinNoise {
  private permutation: number[];

  constructor(seed: number = Math.random() * 1000) {
    // Create permutation table
    this.permutation = [];
    for (let i = 0; i < 256; i++) {
      this.permutation[i] = i;
    }

    // Shuffle based on seed
    const random = this.seededRandom(seed);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [this.permutation[i], this.permutation[j]] = [
        this.permutation[j],
        this.permutation[i],
      ];
    }

    // Duplicate permutation table
    for (let i = 0; i < 256; i++) {
      this.permutation[256 + i] = this.permutation[i];
    }
  }

  private seededRandom(seed: number) {
    return function () {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(t: number, a: number, b: number): number {
    return a + t * (b - a);
  }

  private grad(hash: number, x: number, y: number): number {
    const h = hash & 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return (
      ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v)
    );
  }

  noise2D(x: number, y: number): number {
    // Find unit square that contains point
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;

    // Find relative x, y of point in square
    x -= Math.floor(x);
    y -= Math.floor(y);

    // Compute fade curves for each of x, y
    const u = this.fade(x);
    const v = this.fade(y);

    // Hash coordinates of the 4 square corners
    const A = this.permutation[X] + Y;
    const B = this.permutation[X + 1] + Y;

    // And add blended results from 4 corners of square
    return this.lerp(
      v,
      this.lerp(
        u,
        this.grad(this.permutation[A], x, y),
        this.grad(this.permutation[B], x - 1, y)
      ),
      this.lerp(
        u,
        this.grad(this.permutation[A + 1], x, y - 1),
        this.grad(this.permutation[B + 1], x - 1, y - 1)
      )
    );
  }

  // Octave noise for more natural terrain
  octaveNoise2D(
    x: number,
    y: number,
    octaves: number = 4,
    persistence: number = 0.5
  ): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total +=
        this.noise2D(x * frequency, y * frequency) *
        amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }

    return total / maxValue;
  }
}
