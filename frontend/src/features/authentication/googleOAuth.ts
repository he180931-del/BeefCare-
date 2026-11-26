/** Starts every Google flow at Spring Boot, including deployments where the frontend has a separate origin. */
export function googleAuthorizationUrl(): string {
  const apiOrigin = (import.meta.env.VITE_BEEFCARE_API_URL || '').trim().replace(/\/+$/, '')
  if (apiOrigin) return `${apiOrigin}/oauth2/authorization/google`
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:8080/oauth2/authorization/google`
  }
  return '/oauth2/authorization/google'
}
