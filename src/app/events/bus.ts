import { EventEmitter } from 'node:events';
export type BusEvents =
  | { type: 'iteration'; n: number }
  | { type: 'test-result'; name: string; verdict: 'pass' | 'fail' | 'noCov' | 'overallInc' }
  | { type: 'coverage'; pct: number }
  | { type: 'info'; msg: string }
  | { type: 'warn'; msg: string }
  | { type: 'error'; msg: string };

export class EventBus extends EventEmitter {
  emitEvent(e: BusEvents) { this.emit(e.type, e); }
  onAll(listener: (e: BusEvents) => void) { this.on('iteration', listener); this.on('test-result', listener); this.on('coverage', listener); this.on('info', listener); this.on('warn', listener); this.on('error', listener); }
}
