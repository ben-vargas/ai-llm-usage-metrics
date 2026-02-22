import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://ayagmar.github.io',
  base: '/llm-usage-metrics',
  integrations: [
    starlight({
      title: 'llm-usage-metrics',
      description: 'CLI for aggregating local LLM usage metrics from pi, codex, and opencode sessions',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/ayagmar/llm-usage-metrics' },
      ],
      sidebar: [
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
      ],
      customCss: [
        './src/styles/custom.css',
      ],
      editLink: {
        baseUrl: 'https://github.com/ayagmar/llm-usage-metrics/edit/main/site/',
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