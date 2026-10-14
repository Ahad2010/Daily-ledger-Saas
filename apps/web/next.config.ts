import type { NextConfig } from 'next';
// Avoid restoring stale route manifests from the OneDrive development cache.
const upstream=(process.env.API_INTERNAL_URL||'http://localhost:4000').replace(/\/$/,'');
if(process.env.VERCEL){const api=new URL(upstream);if(api.protocol!=='https:'||['localhost','127.0.0.1','[::1]'].includes(api.hostname)||process.env.NEXT_PUBLIC_DATA_MODE!=='api'||process.env.NEXT_PUBLIC_API_URL!=='/backend')throw new Error('Set Vercel NEXT_PUBLIC_DATA_MODE=api, NEXT_PUBLIC_API_URL=/backend and API_INTERNAL_URL to your public HTTPS backend URL.');}
const security=[{key:'X-Content-Type-Options',value:'nosniff'},{key:'X-Frame-Options',value:'DENY'},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},{key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=(), payment=()'}];
// Unhashed public assets: cache for a month so repeat visits do not re-download the 3D model and decoder.
const longCache=[{key:'Cache-Control',value:'public, max-age=2592000, stale-while-revalidate=86400'}];
const dayCache=[{key:'Cache-Control',value:'public, max-age=86400, stale-while-revalidate=604800'}];
const config: NextConfig = {distDir:process.env.VERCEL?'.next':process.env.NEXT_BUILD_DIR||'.next',transpilePackages:['@ledger/shared'],experimental:{turbopackFileSystemCacheForDev:false,cpus:1,webpackMemoryOptimizations:true}, async rewrites(){return [{source:'/backend/:path*', destination:`${upstream}/:path*`}];},
 async headers(){return [{source:'/:path*',headers:security},{source:'/admin/:path*',headers:[{key:'X-Robots-Tag',value:'noindex, nofollow'}]},{source:'/fitness/:path*',headers:longCache},{source:'/icons/:path*',headers:longCache},{source:'/daily-ledger-logo.png',headers:dayCache},{source:'/fold-top.svg',headers:dayCache},{source:'/fold-bottom.svg',headers:dayCache},{source:'/fold-top-wave.svg',headers:dayCache},{source:'/fold-bottom-wave.svg',headers:dayCache}];}};
export default config;
