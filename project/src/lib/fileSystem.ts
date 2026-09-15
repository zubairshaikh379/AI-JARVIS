// Browser File System Access API integration
// Handles directory access, file operations, and permission management

const DB_NAME = 'jarvis-fs';
const DB_VERSION = 1;
const STORE_NAME = 'handles';

// ────────────────────────────────────────────────────────────────────────────
// IndexedDB for persistent handle storage
// ────────────────────────────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

async function storeHandle(key: string, handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(handle, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getHandle(key: string): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Directory Access
// ────────────────────────────────────────────────────────────────────────────

export async function requestDirectoryAccess(): Promise<{ success: boolean; error?: string }> {
  try {
    if (!('showDirectoryPicker' in window)) {
      return { success: false, error: 'File System Access API not supported in this browser (use Chrome/Edge)' };
    }

    const handle = await (window as any).showDirectoryPicker({
      mode: 'readwrite',
    });

    await storeHandle('workspace', handle);
    return { success: true };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { success: false, error: 'Directory selection cancelled' };
    }
    return { success: false, error: error.message };
  }
}

export async function getStoredHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const handle = await getHandle('workspace');
    if (!handle) return null;

    // Verify we still have permission
    const permission = await (handle as any).queryPermission({ mode: 'readwrite' });
    if (permission === 'granted') return handle;

    // Try to request permission again
    const requestResult = await (handle as any).requestPermission({ mode: 'readwrite' });
    if (requestResult === 'granted') return handle;

    return null;
  } catch {
    return null;
  }
}

export async function hasDirectoryAccess(): Promise<boolean> {
  const handle = await getStoredHandle();
  return handle !== null;
}

export async function revokeDirectoryAccess(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete('workspace');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ────────────────────────────────────────────────────────────────────────────
// File Operations
// ────────────────────────────────────────────────────────────────────────────

async function resolvePath(rootHandle: FileSystemDirectoryHandle, path: string): Promise<FileSystemFileHandle | FileSystemDirectoryHandle | null> {
  const parts = path.split('/').filter(p => p && p !== '.');

  // Security: reject parent directory traversal
  if (parts.some(p => p === '..')) {
    throw new Error('Path traversal (..) not allowed');
  }

  let current: FileSystemDirectoryHandle | FileSystemFileHandle = rootHandle;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isLast = i === parts.length - 1;

    if (current.kind === 'file') {
      throw new Error('Cannot traverse through a file');
    }

    try {
      if (isLast) {
        // Try file first, then directory
        try {
          current = await (current as FileSystemDirectoryHandle).getFileHandle(part);
        } catch {
          current = await (current as FileSystemDirectoryHandle).getDirectoryHandle(part);
        }
      } else {
        current = await (current as FileSystemDirectoryHandle).getDirectoryHandle(part);
      }
    } catch {
      return null;
    }
  }

  return current;
}

export async function readFile(path: string): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    const rootHandle = await getStoredHandle();
    if (!rootHandle) {
      return { success: false, error: 'No directory access granted. Click "Grant File Access" first.' };
    }

    const fileHandle = await resolvePath(rootHandle, path);
    if (!fileHandle || fileHandle.kind !== 'file') {
      return { success: false, error: `File not found: ${path}` };
    }

    const file = await (fileHandle as FileSystemFileHandle).getFile();
    const content = await file.text();

    return { success: true, content };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function writeFile(path: string, content: string): Promise<{ success: boolean; error?: string }> {
  try {
    const rootHandle = await getStoredHandle();
    if (!rootHandle) {
      return { success: false, error: 'No directory access granted' };
    }

    const parts = path.split('/').filter(p => p && p !== '.');
    const fileName = parts.pop()!;
    const dirPath = parts.join('/');

    // Navigate to parent directory (or root if no parent)
    let dirHandle = rootHandle;
    if (dirPath) {
      const resolved = await resolvePath(rootHandle, dirPath);
      if (!resolved || resolved.kind !== 'directory') {
        return { success: false, error: `Directory not found: ${dirPath}` };
      }
      dirHandle = resolved as FileSystemDirectoryHandle;
    }

    // Create or get file handle
    const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function listDirectory(path: string = ''): Promise<{ success: boolean; files?: Array<{ name: string; kind: 'file' | 'directory' }>; error?: string }> {
  try {
    const rootHandle = await getStoredHandle();
    if (!rootHandle) {
      return { success: false, error: 'No directory access granted' };
    }

    let dirHandle = rootHandle;
    if (path) {
      const resolved = await resolvePath(rootHandle, path);
      if (!resolved || resolved.kind !== 'directory') {
        return { success: false, error: `Directory not found: ${path}` };
      }
      dirHandle = resolved as FileSystemDirectoryHandle;
    }

    const files: Array<{ name: string; kind: 'file' | 'directory' }> = [];
    for await (const entry of (dirHandle as any).values()) {
      files.push({ name: entry.name, kind: entry.kind });
    }

    // Sort: directories first, then files, alphabetically
    files.sort((a, b) => {
      if (a.kind === b.kind) return a.name.localeCompare(b.name);
      return a.kind === 'directory' ? -1 : 1;
    });

    return { success: true, files };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function searchFiles(query: string, basePath: string = ''): Promise<{ success: boolean; matches?: Array<{ path: string; kind: 'file' | 'directory' }>; error?: string }> {
  try {
    const rootHandle = await getStoredHandle();
    if (!rootHandle) {
      return { success: false, error: 'No directory access granted' };
    }

    let searchRoot = rootHandle;
    if (basePath) {
      const resolved = await resolvePath(rootHandle, basePath);
      if (!resolved || resolved.kind !== 'directory') {
        return { success: false, error: `Directory not found: ${basePath}` };
      }
      searchRoot = resolved as FileSystemDirectoryHandle;
    }

    const matches: Array<{ path: string; kind: 'file' | 'directory' }> = [];
    const lowerQuery = query.toLowerCase();

    async function scan(handle: FileSystemDirectoryHandle, currentPath: string) {
      for await (const entry of (handle as any).values()) {
        const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;

        // Match by filename
        if (entry.name.toLowerCase().includes(lowerQuery)) {
          matches.push({ path: entryPath, kind: entry.kind });
        }

        // Recurse into directories
        if (entry.kind === 'directory') {
          await scan(entry, entryPath);
        }
      }
    }

    await scan(searchRoot, basePath);

    return { success: true, matches };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteFile(path: string): Promise<{ success: boolean; error?: string }> {
  try {
    const rootHandle = await getStoredHandle();
    if (!rootHandle) {
      return { success: false, error: 'No directory access granted' };
    }

    const parts = path.split('/').filter(p => p && p !== '.');
    const fileName = parts.pop()!;
    const dirPath = parts.join('/');

    let dirHandle = rootHandle;
    if (dirPath) {
      const resolved = await resolvePath(rootHandle, dirPath);
      if (!resolved || resolved.kind !== 'directory') {
        return { success: false, error: `Directory not found: ${dirPath}` };
      }
      dirHandle = resolved as FileSystemDirectoryHandle;
    }

    await dirHandle.removeEntry(fileName, { recursive: false });

    return { success: true };
  } catch (error: any) {
    if (error.name === 'NotFoundError') {
      return { success: false, error: `File not found: ${path}` };
    }
    return { success: false, error: error.message };
  }
}
