export const withBase = (relativePath: string): string => {
  const base = import.meta.env.BASE_URL ?? '/'
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  const normalizedPath = relativePath.replace(/^\/+/u, '')
  return `${normalizedBase}${normalizedPath}`
}

