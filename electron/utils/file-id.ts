import { createHash } from 'node:crypto'
import { open, stat } from 'node:fs/promises'

const FILE_ID_SAMPLE_BYTES = 1024

export async function computeFileId(absolutePath: string): Promise<string> {
  const fileStats = await stat(absolutePath)
  const fileHandle = await open(absolutePath, 'r')

  try {
    const buffer = Buffer.alloc(FILE_ID_SAMPLE_BYTES)
    const { bytesRead } = await fileHandle.read(buffer, 0, buffer.length, 0)
    const hash = createHash('md5')

    hash.update(buffer.subarray(0, bytesRead))
    hash.update(String(fileStats.size))

    return hash.digest('hex')
  } finally {
    await fileHandle.close()
  }
}
