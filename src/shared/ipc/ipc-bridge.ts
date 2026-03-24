export interface IpcRendererInvoke {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
}

export interface IpcMainHandleTarget {
  handle(channel: string, listener: (event: unknown) => unknown): void;
  handle<Input>(channel: string, listener: (event: unknown, input: Input) => unknown): void;
}

export function bindIpcInvoke0<Output>(
  invoke: IpcRendererInvoke['invoke'],
  channel: string,
): () => Promise<Output> {
  return () => invoke(channel) as Promise<Output>;
}

export function bindIpcInvoke1<Input, Output>(
  invoke: IpcRendererInvoke['invoke'],
  channel: string,
): (input: Input) => Promise<Output> {
  return (input: Input) => invoke(channel, input) as Promise<Output>;
}

export function registerIpcHandle0<Output>(
  target: IpcMainHandleTarget,
  channel: string,
  execute: () => Promise<Output> | Output,
): void {
  target.handle(channel, async () => execute());
}

export function registerIpcHandle1<Input, Output>(
  target: IpcMainHandleTarget,
  channel: string,
  execute: (input: Input) => Promise<Output> | Output,
): void {
  target.handle(channel, async (_event: unknown, input: Input) => execute(input));
}
