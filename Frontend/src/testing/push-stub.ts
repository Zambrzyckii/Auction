export interface PushStub {
  on(topic: string, handler: (data: string) => void): () => void;
  emit(topic: string, data?: string): void;
  handlerCount(topic: string): number;
}

export function pushStub(): PushStub {
  const handlers = new Map<string, Set<(data: string) => void>>();
  return {
    on: (topic, handler) => {
      const set = handlers.get(topic) ?? new Set<(data: string) => void>();
      set.add(handler);
      handlers.set(topic, set);
      return () => {
        set.delete(handler);
      };
    },
    emit: (topic, data = '{}') => {
      for (const handler of handlers.get(topic) ?? []) {
        handler(data);
      }
    },
    handlerCount: (topic) => handlers.get(topic)?.size ?? 0,
  };
}
