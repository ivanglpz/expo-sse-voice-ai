import Storage from "expo-sqlite/kv-store";

export const createStorePersist = {
  getItem: async (_key: string, initialValue: any) => {
    const raw = await Storage.getItem(_key);
    if (raw === null) return initialValue;
    try {
      return JSON.parse(raw) as any;
    } catch {
      return initialValue;
    }
  },
  setItem: async (_key: string, newValue: any) => {
    await Storage.setItem(_key, JSON.stringify(newValue));
  },
  removeItem: async (_key: string) => {
    await Storage.removeItem(_key);
  },
};
