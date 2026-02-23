import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://ayagmar.github.io',
  base: '/llm-usage-metrics',

  integrations: [
    starlight({
      title: 'llm-usage-metrics',
      description:
        'CLI for aggregating local LLM usage metrics from pi, codex, and opencode sessions',
      favicon: '/favicon.svg',
      logo: {
        src: './src/assets/logo.svg',
        replacesTitle: true,
      },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/ayagmar/llm-usage-metrics' },
      ],
      sidebar: [
        {
          label: 'Documentation',
          link: '/',
        },
        {
          label: 'Getting Started',
          link: '/getting-started',
        },
        {
          label: 'CLI Reference',
          link: '/cli-reference',
        },
        {
          label: 'Data Sources',
          items: [
            { label: 'Overview', link: '/sources/' },
            { label: 'pi', link: '/sources/pi/' },
            { label: 'codex', link: '/sources/codex/' },
            { label: 'opencode', link: '/sources/opencode/' },
          ],
        },
        {
          label: 'Configuration',
          link: '/configuration',
        },
        {
          label: 'Caching',
          link: '/caching',
        },
        {
          label: 'Output Formats',
          link: '/output-formats',
        },
        {
          label: 'Pricing',
          link: '/pricing',
        },
        {
          label: 'Troubleshooting',
          link: '/troubleshooting',
        },
        {
          label: 'Architecture',
          link: '/architecture',
        },
      ],
      customCss: ['./src/styles/tokens.css', './src/styles/custom.css'],
      editLink: {
        baseUrl: 'https://github.com/ayagmar/llm-usage-metrics/edit/master/site/',
      },
      expressiveCode: {
        themes: ['github-dark', 'github-light'],
        defaultProps: {
          wrap: true,
        },
      },
    }),
  ],
  outDir: './dist',
  srcDir: './src',
  publicDir: './public',
  server: {
    port: 4321,
  },
});
