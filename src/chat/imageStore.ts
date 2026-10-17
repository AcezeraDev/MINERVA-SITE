/*
  Imagens criadas pela Mine, guardadas no aparelho (IndexedDB).

  Por que não no estado do site: todo o Minerva vive numa linha JSON que é
  reenviada inteira a cada alteração. Uma imagem de 1024² em base64 tem perto
  de 1 MB; três delas já pesariam mais que o resto da conta. Aqui elas ficam
  como Blob, por chave = hash do prompt, e a conversa guarda só o marcador.
  Noutro aparelho a imagem não está: o cartão oferece "Criar de novo".
*/
const DB = "minerva-mine-imagens";
const STORE = "imagens";

export type StoredImage = { key: string; blob: Blob; prompt: string; createdAt: number };

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "key" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = action(db.transaction(STORE, mode).objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

/** Chave estável de um prompt (FNV-1a), para achar a imagem de novo depois. */
export function imageKey(prompt: string, edit = false) {
  let hash = 2166136261;
  const text = `${edit ? "e" : "n"}|${prompt.trim().toLowerCase()}`;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `img-${(hash >>> 0).toString(36)}-${text.length}`;
}

export async function loadImage(key: string): Promise<StoredImage | undefined> {
  try {
    return await run<StoredImage | undefined>("readonly", (store) => store.get(key));
  } catch {
    return undefined;
  }
}

export async function saveImage(entry: StoredImage) {
  try {
    await run("readwrite", (store) => store.put(entry));
  } catch {
    // sem IndexedDB (aba privada): a imagem vale só enquanto a página estiver aberta
  }
}
