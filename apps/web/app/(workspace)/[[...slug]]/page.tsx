import {notFound} from 'next/navigation';
import {exerciseGuides} from '../../../lib/exercise-guides';
const pages=['','today','calendar','finance','tasks','fitness','meals','goals','assistant','reports','settings','help','plans','ranking','billing'];
// Prerender the known top-level pages as static HTML; nested paths (finance sections, record ids) still render on demand.
export function generateStaticParams(){return [...pages.map(page=>({slug:page?[page]:[]})),{slug:['billing','success']},...exerciseGuides.map(e=>({slug:['fitness','exercises',e.slug]}))];}
export default async function Page({params}:{params:Promise<{slug?:string[]}>}){const {slug=[]}=await params;if(!pages.includes(slug[0]||''))notFound();if(slug[0]==='billing'&&!(slug.length===2&&slug[1]==='success'))notFound();if(slug[0]==='fitness'&&slug.length>1&&(slug[1]!=='exercises'||slug.length!==3||!exerciseGuides.some(e=>e.slug===slug[2])))notFound();return null;}
