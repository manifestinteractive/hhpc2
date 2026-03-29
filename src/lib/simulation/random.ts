export type SeededRandom = {
  boolean(probability: number): boolean;
  float(min?: number, max?: number): number;
  int(min: number, max: number): number;
  pick<T>(values: T[]): T;
};

function mulberry32(seed: number) {
  let state = seed >>> 0;

  return function next() {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSeededRandom(seed: number): SeededRandom {
  const next = mulberry32(seed);

  return {
    boolean(probability: number) {
      return next() < probability;
    },
    float(min = 0, max = 1) {
      return min + next() * (max - min);
    },
    int(min: number, max: number) {
      return Math.floor(this.float(min, max + 1));
    },
    pick<T>(values: T[]) {
      return values[this.int(0, values.length - 1)];
    },
  };
}
