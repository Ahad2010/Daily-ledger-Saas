import {notFound} from 'next/navigation';
const pages=['','login','support','users','plans','announcements','automations','reports','ai','settings','audit'];
export default async function Page({params}:{params:Promise<{slug?:string[]}>}){const {slug=[]}=await params;if(!pages.includes(slug[0]||''))notFound();return null;}
