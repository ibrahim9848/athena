/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: ['better-sqlite3', 'argon2', 'web-push', 'node-cron'],
    // Native modules load their .node binaries at runtime through node-gyp-build /
    // bindings, which the standalone file tracer cannot follow. Copy the whole
    // packages into the standalone output so the Docker image has the binaries.
    outputFileTracingIncludes: {
      '/**': [
        './node_modules/argon2/**',
        './node_modules/node-gyp-build/**',
        './node_modules/better-sqlite3/**',
        './node_modules/bindings/**',
        './node_modules/file-uri-to-path/**',
      ],
    },
  },
};

export default nextConfig;
