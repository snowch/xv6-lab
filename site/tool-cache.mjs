// Optional derived modules. Release-keyed binaries remain the source of truth.
export async function toolModules(key) {
  if (!key) return null;
  let db;
  try {
    db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("xv6-tool-modules-v1", 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("modules");
      request.onsuccess = () => resolve(request.result);
      request.onerror = request.onblocked = () => reject(request.error);
    });
    const value = await new Promise((resolve, reject) => {
      const request = db.transaction("modules").objectStore("modules").get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return value?.modules;
  } catch {
    return null;
  } finally {
    db?.close();
  }
}
