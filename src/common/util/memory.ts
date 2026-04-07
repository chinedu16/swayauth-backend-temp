const inMemoryStorage = new Map();

export type Memory = {
  accessToken: string | null;
  accessTokenExpiresAt: number | null;
};

export const setFromMemory = (
  key: keyof Memory,
  value: Memory[keyof Memory],
) => {
  inMemoryStorage.set(key, value);
};

export const getFromMemory = <T extends keyof Memory>(key: T): Memory[T] => {
  return inMemoryStorage.get(key) ?? null;
};

export const removeFromMemory = (key: keyof Memory) => {
  inMemoryStorage.delete(key);
  return true;
};
