export function isDevelopmentReviewRoute(pathname: string, isDevelopment: boolean): boolean {
  if (!isDevelopment) return false
  return /^\/ui\/scr-\d{2,3}$/i.test(pathname)
    || /^\/cattle(?:\/[^/]+)?\/?$/i.test(pathname)
    || /^\/pens\/?$/i.test(pathname)
    || /^\/herd-(?:entry|exit)(?:\/new|\/[^/]+)?\/?$/i.test(pathname)
}

export function isPublicAccountRoute(pathname: string): boolean {
  return pathname === '/' || /^\/ui\/scr-0[1-6]$/i.test(pathname)
}
