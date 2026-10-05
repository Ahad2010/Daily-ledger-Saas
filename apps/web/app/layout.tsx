import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import './premium.css';
import './finance.css';
import './platform.css';
import './onboarding.css';
import './empty-state.css';
import './support.css';
import './guides.css';
import {Providers} from './providers';
const poppins=localFont({src:[{path:'./fonts/Poppins-Regular.ttf',weight:'400'},{path:'./fonts/Poppins-Medium.ttf',weight:'500'},{path:'./fonts/Poppins-SemiBold.ttf',weight:'600'}],variable:'--font-poppins',display:'swap'});
export const metadata:Metadata={title:'Daily Ledger — Your life at a glance',description:'A thoughtful workspace for your money, routines, and goals.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en" className={poppins.variable}><body><Providers>{children}</Providers></body></html>;}
