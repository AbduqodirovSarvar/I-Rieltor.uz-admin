import { HubLike } from '../core/realtime/auction-live';

/** A stand-in for SignalR's connection in tests: records what the app does and lets a test push messages. */
export class FakeHub implements HubLike {
  readonly handlers = new Map<string, (...args: never[]) => void>();
  readonly invoked: { method: string; args: unknown[] }[] = [];
  started = 0;
  stopped = 0;
  failStart = false;
  private reconnecting: () => void = () => undefined;
  private reconnected: () => void = () => undefined;
  private closed: () => void = () => undefined;

  on(method: string, handler: (...args: never[]) => void): void {
    this.handlers.set(method.toLowerCase(), handler);
  }

  async start(): Promise<void> {
    this.started++;
    if (this.failStart) throw new Error('no connection');
  }

  async stop(): Promise<void> {
    this.stopped++;
  }

  async invoke(method: string, ...args: unknown[]): Promise<unknown> {
    this.invoked.push({ method, args });
    return undefined;
  }

  onreconnecting(handler: () => void): void {
    this.reconnecting = handler;
  }
  onreconnected(handler: () => void): void {
    this.reconnected = handler;
  }
  onclose(handler: () => void): void {
    this.closed = handler;
  }

  // ---- test controls
  send(method: string, payload: unknown): void {
    (this.handlers.get(method.toLowerCase()) as ((p: unknown) => void) | undefined)?.(payload);
  }
  dropConnection(): void {
    this.reconnecting();
  }
  restoreConnection(): void {
    this.reconnected();
  }
  closeConnection(): void {
    this.closed();
  }
}
