export function toLocalResourceUrl(filePath: string): string {
  const safePath = filePath
    .replace(/\\/g, '/')
    .replace(/#/g, '%23')
    .replace(/\?/g, '%3F')

  return `local-resource://${safePath}`
}
