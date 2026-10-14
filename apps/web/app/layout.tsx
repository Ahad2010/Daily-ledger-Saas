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
import './redesign.css';
import './hold-button.css';
import {Providers} from './providers';
// Inter carries UI text and tabular figures; Manrope carries headings and large numbers. Both are variable fonts bundled locally.
const inter=localFont({src:'./fonts/Inter-Variable.woff2',weight:'100 900',variable:'--font-inter',display:'swap'});
const manrope=localFont({src:'./fonts/Manrope-Variable.woff2',weight:'200 800',variable:'--font-manrope',display:'swap'});
export const metadata:Metadata={title:'Daily Ledger — Your life at a glance',description:'A thoughtful workspace for your money, routines, and goals.',applicationName:'Daily Ledger',appleWebApp:{capable:true,title:'Daily Ledger',statusBarStyle:'black-translucent'},icons:{icon:[{url:'/icons/icon-192.png',sizes:'192x192',type:'image/png'}],apple:'/icons/apple-touch-icon.png'}};
export const viewport:Viewport={themeColor:'#080808',colorScheme:'dark',width:'device-width',initialScale:1};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en" className={`${inter.variable} ${manrope.variable}`}><body><Providers>{children}</Providers></body></html>;}

