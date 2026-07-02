// Pure client-rendered SPA: tools query the API in the browser and there's
// nothing to prerender per-route, so SSR/prerender are off and the adapter's
// fallback (404.html) serves deep links on GitHub Pages.
export const ssr = false;
export const prerender = false;
export const trailingSlash = 'ignore';
