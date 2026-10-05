import type { NextConfig } from 'next';
// Avoid restoring stale route manifests from the OneDrive development cache.
const config: NextConfig = {transpilePackages:['@ledger/shared'],experimental:{turbopackFileSystemCacheForDev:false,cpus:1,webpackMemoryOptimizations:true}, async rewrites(){return [{source:'/backend/:path*', destination:`${process.env.API_INTERNAL_URL || 'http://localhost:4000'}/:path*`}];}};
export default config;
