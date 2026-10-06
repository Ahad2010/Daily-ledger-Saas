'use client';
import {useEffect,useState,type ComponentType} from 'react';
import {Dialog} from './ui/dialog';
import {muscleGroups,type MuscleGroup} from '../lib/exercise-guides';
export type AnatomyViewerProps={selected:MuscleGroup;streak:number;onSelect:(group:MuscleGroup)=>void;onClose:()=>void};
export function AnatomyViewer(props:AnatomyViewerProps){
 const [Viewer,setViewer]=useState<ComponentType<AnatomyViewerProps>>(),[error,setError]=useState(false),[attempt,setAttempt]=useState(0);
 useEffect(()=>{let active=true;import('./anatomy-three').then(m=>{if(active)setViewer(()=>m.default);}).catch(()=>{if(active)setError(true);});return()=>{active=false;};},[attempt]);
 return <Dialog open onOpenChange={open=>{if(!open)props.onClose();}} title="Explore your muscles" description="Drag to rotate · Pinch to zoom · Tap a muscle"><div className="anatomy-3d-dialog">{Viewer?<Viewer {...props}/>:<div className="anatomy-3d-loading" role="status">{error?<><p>3D could not open. Your 2D view is still available.</p><button onClick={()=>{setError(false);setAttempt(a=>a+1);}}>Retry</button></>:<><span className="anatomy-skeleton"/><p>Preparing 3D view…</p></>}<button onClick={props.onClose}>Use 2D view</button></div>}<div className="muscle-buttons" aria-label="Choose 3D body part">{muscleGroups.map(group=><button key={group} aria-pressed={props.selected===group} onClick={()=>props.onSelect(group)}>{group==='Core'?'Core / Abs':group}</button>)}</div></div></Dialog>;
}
