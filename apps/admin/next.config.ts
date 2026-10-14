import base from '../web/next.config';
// The administrator frontend must never be indexed, whichever path is requested.
export default {...base,async headers(){return [...(await base.headers?.()??[]),{source:'/:path*',headers:[{key:'X-Robots-Tag',value:'noindex, nofollow'}]}];}};
