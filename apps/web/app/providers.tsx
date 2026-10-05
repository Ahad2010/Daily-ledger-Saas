'use client';
import {useState,type ReactNode} from 'react';
import {usePathname} from 'next/navigation';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {LedgerApp} from '../components/ledger-app';
import {AdminApp} from '../components/admin-app';
const publicRoutes=['/login','/signup','/forgot-password','/reset-password','/terms','/privacy'];
export function Providers({children}:{children:ReactNode}){const [client]=useState(()=>new QueryClient({defaultOptions:{queries:{retry:1,refetchOnWindowFocus:false,staleTime:30000}}}));const path=usePathname();return <QueryClientProvider client={client}>{path.startsWith('/admin')?<AdminApp/>:publicRoutes.includes(path)?children:<LedgerApp/>}</QueryClientProvider>;}
