import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
export default function AuthLayout({children}:{children:React.ReactNode}){return <div className="auth-shell"><div className="auth-art" aria-hidden="true"><div className="fold fold-top"/><div className="fold fold-bottom"/><div className="auth-ambient"/></div><Link className="auth-home" href="/"><ChevronLeft size={15}/>Home</Link><main className="auth-main">{children}</main></div>;}
