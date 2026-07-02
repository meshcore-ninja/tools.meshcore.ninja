import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    // SPA: prerender the shell and let the client render every tool route. The
    // fallback (404.html) boots the client router for deep links on GitHub Pages.
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: '404.html',
      precompress: false,
      strict: false
    }),
    paths: {
      base: process.env.BASE_PATH ?? ''
    }
  }
};

export default config;
