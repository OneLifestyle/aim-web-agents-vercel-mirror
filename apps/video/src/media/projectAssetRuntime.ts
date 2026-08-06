import { ObjectUrlRegistry } from './objectUrlRegistry';

export class ProjectAssetRuntime {
  private readonly blobs = new Map<string, Blob>();
  private readonly urls = new ObjectUrlRegistry();
  private readonly decodedImages = new Map<string, Promise<HTMLImageElement>>();

  set(assetId: string, blob: Blob) {
    this.blobs.set(assetId, blob);
    this.decodedImages.delete(assetId);
    return this.urls.set(assetId, blob);
  }

  setAll(blobs: ReadonlyMap<string, Blob>) {
    this.clear();
    for (const [assetId, blob] of blobs) this.set(assetId, blob);
  }

  getBlob(assetId: string) {
    return this.blobs.get(assetId) ?? null;
  }

  getUrl(assetId: string) {
    const existing = this.urls.get(assetId);
    if (existing) return existing;
    const blob = this.getBlob(assetId);
    return blob ? this.urls.set(assetId, blob) : null;
  }

  async getImage(assetId: string) {
    const existing = this.decodedImages.get(assetId);
    if (existing) return existing;
    const url = this.getUrl(assetId);
    if (!url) throw new Error(`Local media ${assetId} is missing.`);
    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Local image ${assetId} could not be decoded.`));
      image.src = url;
    });
    this.decodedImages.set(assetId, promise);
    return promise;
  }

  delete(assetId: string) {
    this.decodedImages.delete(assetId);
    this.blobs.delete(assetId);
    this.urls.delete(assetId);
  }

  has(assetId: string) {
    return this.blobs.has(assetId);
  }

  snapshot() {
    return new Map(this.blobs);
  }

  clear() {
    this.decodedImages.clear();
    this.blobs.clear();
    this.urls.clear();
  }
}
