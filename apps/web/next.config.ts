import type { NextConfig } from 'next';
// Avoid restoring stale route manifests from the OneDrive development cache.
const upstream=(process.env.API_INTERNAL_URL||'http://localhost:4000').replace(/\/$/,'');
if(process.env.VERCEL){const api=new URL(upstream);if(api.protocol!=='https:'||['localhost','127.0.0.1','[::1]'].includes(api.hostname)||process.env.NEXT_PUBLIC_DATA_MODE!=='api'||process.env.NEXT_PUBLIC_API_URL!=='/backend')throw new Error('Set Vercel NEXT_PUBLIC_DATA_MODE=api, NEXT_PUBLIC_API_URL=/backend and API_INTERNAL_URL to your public HTTPS backend URL.');}
const config: NextConfig = {distDir:process.env.VERCEL?'.next':process.env.NEXT_BUILD_DIR||'.next',transpilePackages:['@ledger/shared'],experimental:{turbopackFileSystemCacheForDev:false,cpus:1,webpackMemoryOptimizations:true}, async rewrites(){return [{source:'/backend/:path*', destination:`${upstream}/:path*`}];}};
export default config;
