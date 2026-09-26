import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";

/*
 * File storage adapter for listing media (Enhanced listing logos).
 *   STORAGE_PROVIDER=local     (default) files in ./.data/uploads (gitignored)
 *   STORAGE_PROVIDER=supabase  Supabase Storage bucket (SUPABASE_STORAGE_BUCKET,
 *                              default "listing-media") using the service role key.
 *
 * Files are always served through /api/uploads/<key>, which checks the
 * moderation status of the media record before returning bytes, so pending
 * or rejected uploads are never publicly visible regardless of the backend.
 */

export type ImageType = "image/png" | "image/jpeg" | "image/webp";

export const IMAGE_EXTENSIONS: Record<ImageType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const CONTENT_TYPES: Record<string, ImageType> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };

export interface StoredObject {
  body: Uint8Array;
  contentType: string;
}

export interface StorageAdapter {
  readonly name: "local" | "supabase";
  put(key: string, body: Uint8Array, contentType: ImageType): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
}

/** Storage keys: lowercase segments of [a-z0-9_-], a single dot extension, no traversal. */
const KEY_PATTERN = /^(?:[a-z0-9][a-z0-9_-]{0,80}\/){1,4}[a-z0-9][a-z0-9_-]{0,80}\.(?:png|jpg|jpeg|webp)$/;

export function isSafeStorageKey(key: string) {
  return KEY_PATTERN.test(key) && !key.includes("..");
}

export function contentTypeForKey(key: string): ImageType | null {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES[ext] ?? null;
}

/** URL that serves a stored object (moderation-aware route). */
export function mediaUrl(key: string | null | undefined) {
  return key ? `/api/uploads/${key}` : null;
}

/**
 * Detects the real image type from the file's first bytes (magic numbers).
 * The browser-provided MIME type and file extension are never trusted.
 */
export function detectImageType(bytes: Uint8Array): ImageType | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // RIFF
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50 // WEBP
  ) {
    return "image/webp";
  }
  return null;
}

class LocalStorageAdapter implements StorageAdapter {
  readonly name = "local" as const;
  private root = path.resolve(process.cwd(), ".data", "uploads");

  private resolve(key: string) {
    if (!isSafeStorageKey(key)) throw new Error("Unsafe storage key");
    const full = path.resolve(this.root, ...key.split("/"));
    // Defense in depth: the resolved path must stay inside the uploads root.
    if (!full.startsWith(this.root + path.sep)) throw new Error("Storage key escapes the uploads directory");
    return full;
  }

  async put(key: string, body: Uint8Array) {
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, body, { flag: "wx" });
  }

  async get(key: string): Promise<StoredObject | null> {
    const contentType = contentTypeForKey(key);
    if (!contentType || !isSafeStorageKey(key)) return null;
    try {
      const body = await fs.readFile(this.resolve(key));
      return { body: new Uint8Array(body), contentType };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  async delete(key: string) {
    try {
      await fs.unlink(this.resolve(key));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }
}

class SupabaseStorageAdapter implements StorageAdapter {
  readonly name = "supabase" as const;
  constructor(private url: string, private serviceKey: string, private bucket: string) {}

  private async client() {
    const { createClient } = await import("@supabase/supabase-js");
    return createClient(this.url, this.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }).storage.from(this.bucket);
  }

  async put(key: string, body: Uint8Array, contentType: ImageType) {
    if (!isSafeStorageKey(key)) throw new Error("Unsafe storage key");
    const bucket = await this.client();
    const { error } = await bucket.upload(key, body, { contentType, upsert: false, cacheControl: "3600" });
    if (error) throw new Error(`Supabase Storage upload failed: ${error.message}`);
  }

  async get(key: string): Promise<StoredObject | null> {
    const contentType = contentTypeForKey(key);
    if (!contentType || !isSafeStorageKey(key)) return null;
    const bucket = await this.client();
    const { data, error } = await bucket.download(key);
    if (error || !data) return null;
    return { body: new Uint8Array(await data.arrayBuffer()), contentType };
  }

  async delete(key: string) {
    if (!isSafeStorageKey(key)) return;
    const bucket = await this.client();
    const { error } = await bucket.remove([key]);
    if (error) throw new Error(`Supabase Storage delete failed: ${error.message}`);
  }
}

let warned = false;
export function getStorageAdapter(): StorageAdapter {
  if (process.env.STORAGE_PROVIDER === "supabase") {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) return new SupabaseStorageAdapter(url, key, process.env.SUPABASE_STORAGE_BUCKET || "listing-media");
    if (!warned) {
      console.warn("[storage] STORAGE_PROVIDER=supabase but NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are missing; using local storage.");
      warned = true;
    }
  }
  return new LocalStorageAdapter();
}
