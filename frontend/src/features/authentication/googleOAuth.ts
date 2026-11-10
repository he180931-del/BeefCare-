/** Starts every Google flow at Spring Boot, including deployments where the frontend has a separate origin. */
export function googleAuthorizationUrl(): string {
  const apiOrigin = (import.meta.env.VITE_BEEFCARE_API_URL || '').trim().replace(/\/+$/, '')
  return `${apiOrigin}/oauth2/authorization/google`
}
