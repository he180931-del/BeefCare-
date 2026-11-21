// Feed Stock has no production consumers of a public feature barrel. Keep the
// boundary explicit so consumers use the owning route, hook, API, or domain
// module instead of depending on an accidental aggregate surface.
export {}
