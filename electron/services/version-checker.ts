import https from 'node:https'

export interface UpdateCheckResult {
  readonly hasUpdate: boolean
  readonly currentVersion: string
  readonly latestVersion: string | null
  readonly releaseUrl: string | null
  readonly publishedAt: string | null
}

interface GithubRelease {
  readonly tag_name: string
  readonly html_url: string
  readonly published_at: string
  readonly draft: boolean
  readonly prerelease: boolean
}

const GITHUB_API_TIMEOUT_MS = 6000

function fetchJson(url: string, timeoutMs: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: 'GET',
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'Aether-Update-Checker'
        },
        timeout: timeoutMs
      },
      (response) => {
        if (response.statusCode && response.statusCode >= 400) {
          response.resume()
          reject(new Error(`GitHub API returned HTTP ${response.statusCode}`))
          return
        }

        const chunks: Buffer[] = []
        response.on('data', (chunk: Buffer) => chunks.push(chunk))
        response.on('end', () => {
          try {
            const body = Buffer.concat(chunks).toString('utf8')
            resolve(JSON.parse(body))
          } catch (error) {
            reject(error instanceof Error ? error : new Error('Failed to parse GitHub response'))
          }
        })
      }
    )

    request.on('timeout', () => {
      request.destroy(new Error('GitHub API request timed out'))
    })
    request.on('error', reject)
    request.end()
  })
}

function normalize(tag: string): string {
  return tag.replace(/^v/, '').trim()
}

function compareSemver(a: string, b: string): number {
  const parse = (v: string): readonly number[] =>
    normalize(v)
      .split('.')
      .slice(0, 3)
      .map((part) => {
        const numeric = Number.parseInt(part, 10)
        return Number.isFinite(numeric) ? numeric : 0
      })

  const left = parse(a)
  const right = parse(b)
  const length = Math.max(left.length, right.length)

  for (let i = 0; i < length; i += 1) {
    const li = left[i] ?? 0
    const ri = right[i] ?? 0
    if (li > ri) return 1
    if (li < ri) return -1
  }

  return 0
}

export async function checkForUpdate(
  currentVersion: string,
  repo: { readonly owner: string; readonly name: string }
): Promise<UpdateCheckResult> {
  const url = `https://api.github.com/repos/${repo.owner}/${repo.name}/releases/latest`
  const raw = await fetchJson(url, GITHUB_API_TIMEOUT_MS)
  const release = raw as GithubRelease

  if (!release || typeof release.tag_name !== 'string') {
    return {
      hasUpdate: false,
      currentVersion,
      latestVersion: null,
      releaseUrl: null,
      publishedAt: null
    }
  }

  if (release.draft || release.prerelease) {
    return {
      hasUpdate: false,
      currentVersion,
      latestVersion: normalize(release.tag_name),
      releaseUrl: release.html_url,
      publishedAt: release.published_at
    }
  }

  const latestVersion = normalize(release.tag_name)
  const hasUpdate = compareSemver(latestVersion, currentVersion) > 0

  return {
    hasUpdate,
    currentVersion,
    latestVersion,
    releaseUrl: release.html_url,
    publishedAt: release.published_at
  }
}
