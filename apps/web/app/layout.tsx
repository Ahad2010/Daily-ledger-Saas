import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import './premium.css';
import './finance.css';
import './platform.css';
const poppins=localFont({src:[{path:'./fonts/Poppins-Regular.ttf',weight:'400'},{path:'./fonts/Poppins-Medium.ttf',weight:'500'},{path:'./fonts/Poppins-SemiBold.ttf',weight:'600'}],variable:'--font-poppins',display:'swap'});
export const metadata:Metadata={title:'Daily Ledger — Your life at a glance',description:'A thoughtful workspace for your money, routines, and goals.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en" className={poppins.variable}><body>{children}</body></html>;}
