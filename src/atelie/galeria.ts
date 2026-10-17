/**
 * "Meus desenhos" fica no IndexedDB deste aparelho.
 *
 * Não vai para o estado do site: aquele JSON inteiro é reenviado ao servidor
 * a cada mudança e mora numa linha só do banco, e uma folha pintada pesa
 * centenas de KB. Aqui cada desenho guarda as camadas como Blob PNG.
 */

export type Drawing = {
  id: string;
  title: string;
  kind: "branco" | "mine" | "foto";
  w: number;
  h: number;
  paint: Blob;
  lines: Blob;
  guide?: Blob;
  thumb: string;
  updatedAt: number;
};

export const DRAFT_ID = "rascunho";

const DB = "minerva-atelie";
const STORE = "desenhos";

let opening: Promise<IDBDatabase> | null = null;

function db() {
  if (!opening) {
    opening = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    opening.catch(() => { opening = null; });
  }
  return opening;
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest) {
  return db().then(
    (conn) =>
      new Promise<T>((resolve, reject) => {
        const request = work(conn.transaction(STORE, mode).objectStore(STORE));
        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () => reject(request.error);
      }),
  );
}

export function saveDrawing(drawing: Drawing) {
  return run<IDBValidKey>("readwrite", (store) => store.put(drawing));
}

export function loadDrawing(id: string) {
  return run<Drawing | undefined>("readonly", (store) => store.get(id));
}

export function deleteDrawing(id: string) {
  return run<undefined>("readwrite", (store) => store.delete(id));
}

export async function listDrawings() {
  const all = await run<Drawing[]>("readonly", (store) => store.getAll());
  return all.filter((item) => item.id !== DRAFT_ID).sort((a, b) => b.updatedAt - a.updatedAt);
}
