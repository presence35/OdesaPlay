export class ObjectPool<T extends {visible: boolean; alpha: number; x: number; y: number}> {
  private pool: T[] = [];
  private activeSet = new Set<T>();
  private factory: () => T;
  private reset: (obj: T) => void;

  constructor(factory: () => T, reset: (obj: T) => void, preAllocate = 0) {
    this.factory = factory;
    this.reset = reset;
    for (let i = 0; i < preAllocate; i++) {
      const obj = this.factory();
      obj.visible = false;
      this.pool.push(obj);
    }
  }

  acquire(): T {
    let obj = this.pool.pop();
    if (!obj) obj = this.factory();
    this.activeSet.add(obj);
    obj.visible = true;
    return obj;
  }

  release(obj: T): void {
    if (!this.activeSet.delete(obj)) return;
    this.reset(obj);
    obj.visible = false;
    this.pool.push(obj);
  }

  releaseAll(): void {
    for (const obj of this.activeSet) {
      this.reset(obj);
      obj.visible = false;
      this.pool.push(obj);
    }
    this.activeSet.clear();
  }

  get active(): ReadonlySet<T> {
    return this.activeSet;
  }

  destroyAll(destroyFn: (obj: T) => void): void {
    this.releaseAll();
    for (const obj of this.pool) destroyFn(obj);
    this.pool = [];
  }
}
