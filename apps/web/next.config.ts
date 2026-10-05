import type { NextConfig } from 'next';
const config: NextConfig = {transpilePackages:['@ledger/shared'],experimental:{cpus:1,webpackMemoryOptimizations:true}, async rewrites(){return [{source:'/backend/:path*', destination:`${process.env.API_INTERNAL_URL || 'http://localhost:4000'}/:path*`}];}};
export default config;
