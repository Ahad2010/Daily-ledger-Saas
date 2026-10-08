import {notFound} from 'next/navigation';
import {exerciseGuides} from '../../../lib/exercise-guides';
const pages=['','finance','tasks','fitness','meals','goals','assistant','reports','settings','help','plans','ranking'];
// Prerender the known top-level pages as static HTML; nested paths (finance sections, record ids) still render on demand.
export function generateStaticParams(){return [...pages.map(page=>({slug:page?[page]:[]})),...exerciseGuides.map(e=>({slug:['fitness','exercises',e.slug]}))];}
export default async function Page({params}:{params:Promise<{slug?:string[]}>}){const {slug=[]}=await params;if(!pages.includes(slug[0]||''))notFound();if(slug[0]==='fitness'&&slug.length>1&&(slug[1]!=='exercises'||slug.length!==3||!exerciseGuides.some(e=>e.slug===slug[2])))notFound();return null;}
