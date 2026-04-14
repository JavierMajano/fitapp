// Mock DB for development preview — services use in-memory storage instead
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db = new Proxy({} as any, {
  get: (_t, prop) =>
    new Proxy(
      {},
      {
        get: () => () =>
          Promise.reject(
            new Error(`Mock DB: ${String(prop)} is not implemented. Use in-memory services.`),
          ),
      },
    ),
});
