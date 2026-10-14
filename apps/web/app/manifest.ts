import type {MetadataRoute} from 'next';
export default function manifest():MetadataRoute.Manifest{
 return {
  name:'Daily Ledger',short_name:'Daily Ledger',description:'A thoughtful workspace for your money, routines, and goals.',
  id:'/',start_url:'/',scope:'/',display:'standalone',orientation:'portrait',background_color:'#080808',theme_color:'#080808',categories:['finance','productivity','lifestyle'],
  icons:[{src:'/icons/icon-192.png',sizes:'192x192',type:'image/png',purpose:'any'},{src:'/icons/icon-512.png',sizes:'512x512',type:'image/png',purpose:'any'},{src:'/icons/icon-maskable-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'}],
  shortcuts:[{name:'Tasks & Habits',url:'/tasks'},{name:'Financial Planner',url:'/finance'},{name:'Monthly Reports',url:'/reports'}]
 };
}
