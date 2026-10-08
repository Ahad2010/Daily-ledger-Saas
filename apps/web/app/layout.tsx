import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import './premium.css';
import './finance.css';
import './platform.css';
import './onboarding.css';
import './empty-state.css';
import './support.css';
import './guides.css';
import './plans.css';
import './otp.css';
import './referrals.css';
import './growth.css';
import {Providers} from './providers';
const poppins=localFont({src:[{path:'./fonts/Poppins-Regular.woff2',weight:'400'},{path:'./fonts/Poppins-Medium.woff2',weight:'500'},{path:'./fonts/Poppins-SemiBold.woff2',weight:'600'}],variable:'--font-poppins',display:'swap'});
export const metadata:Metadata={title:'Daily Ledger — Your life at a glance',description:'A thoughtful workspace for your money, routines, and goals.',applicationName:'Daily Ledger',appleWebApp:{capable:true,title:'Daily Ledger',statusBarStyle:'black-translucent'},icons:{icon:[{url:'/icons/icon-192.png',sizes:'192x192',type:'image/png'}],apple:'/icons/apple-touch-icon.png'}};
export const viewport:Viewport={themeColor:'#080808',colorScheme:'dark',width:'device-width',initialScale:1};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en" className={poppins.variable}><body><Providers>{children}</Providers></body></html>;}

