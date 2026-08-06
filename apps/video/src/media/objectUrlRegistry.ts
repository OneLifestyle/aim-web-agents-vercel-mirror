export class ObjectUrlRegistry {
  private readonly urls = new Map<string, string>();
  private readonly createUrl: (blob: Blob) => string;
  private readonly revokeUrl: (url: string) => void;

  constructor(
    createUrl: (blob: Blob) => string = URL.createObjectURL.bind(URL),
    revokeUrl: (url: string) => void = URL.revokeObjectURL.bind(URL),
  ) {
    this.createUrl = createUrl;
    this.revokeUrl = revokeUrl;
  }

  set(key: string, blob: Blob) {
    this.delete(key);
    const url = this.createUrl(blob);
    this.urls.set(key, url);
    return url;
  }

  get(key: string) {
    return this.urls.get(key) ?? null;
  }

  delete(key: string) {
    const existing = this.urls.get(key);
    if (!existing) return false;
    this.revokeUrl(existing);
    this.urls.delete(key);
    return true;
  }

  clear() {
    for (const url of this.urls.values()) this.revokeUrl(url);
    this.urls.clear();
  }

  get size() {
    return this.urls.size;
  }
}
