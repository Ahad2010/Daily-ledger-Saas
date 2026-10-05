'use client';
import {useState,type ReactNode} from 'react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {ApiError} from '../lib/data';
export function Providers({children}:{children:ReactNode}){const [client]=useState(()=>new QueryClient({defaultOptions:{queries:{retry:(count,error)=>!(error instanceof ApiError&&[401,403].includes(error.status))&&count<1,refetchOnWindowFocus:false,staleTime:30000}}}));return <QueryClientProvider client={client}>{children}</QueryClientProvider>;}
