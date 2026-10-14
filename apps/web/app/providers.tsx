'use client';
import {useState,type ReactNode} from 'react';
import {usePathname} from 'next/navigation';
import {QueryClient,QueryClientProvider,useQuery} from '@tanstack/react-query';
import {ApiError,apiBase} from '../lib/data';
import {MaintenanceScreen} from '../components/maintenance-screen';
type Maintenance={enabled:boolean;message:string;until:string|null};
async function maintenanceStatus():Promise<Maintenance|null>{try{const response=await fetch(`${apiBase}/status`,{cache:'no-store'});if(!response.ok)return null;return (await response.json()).maintenance as Maintenance;}catch{return null;}}
// Customers see a maintenance page whenever an administrator has switched maintenance on; admin routes are never blocked.
function MaintenanceGate({children}:{children:ReactNode}){
 const path=usePathname();const admin=path.startsWith('/admin');
 const status=useQuery({queryKey:['maintenance'],queryFn:maintenanceStatus,enabled:!admin,refetchInterval:30000,staleTime:0,retry:false});
 if(!admin&&status.data?.enabled)return <MaintenanceScreen message={status.data.message} until={status.data.until} checking={status.isFetching} onRetry={()=>void status.refetch()}/>;
 return <>{children}</>;
}
export function Providers({children}:{children:ReactNode}){const [client]=useState(()=>new QueryClient({defaultOptions:{queries:{retry:(count,error)=>!(error instanceof ApiError&&[401,403].includes(error.status))&&count<1,refetchOnWindowFocus:false,staleTime:30000}}}));return <QueryClientProvider client={client}><MaintenanceGate>{children}</MaintenanceGate></QueryClientProvider>;}
