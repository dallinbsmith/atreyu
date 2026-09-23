// AEM media bus assets (content-addressed images/video, e.g. ./media_<sha>.jpg).
export const isMediaPath = (pathname) => /\/media_[0-9a-f]{40,}[/a-zA-Z0-9_-]*\.[0-9a-z]+$/.test(pathname);
