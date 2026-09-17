// Uploaded images are shown through object URLs (blob:). Each one holds the
// file in memory until revoked, so a step that is abandoned or replaced must
// release the URLs only it was using. Data URLs need no cleanup.

export function revokeBlobUrl(url: string | null | undefined, stillUsedBy?: string | null): void {
  if (url && url.startsWith('blob:') && url !== stillUsedBy) URL.revokeObjectURL(url)
}
