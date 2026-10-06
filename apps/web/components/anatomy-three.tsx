'use client';
import {Component,Suspense,useCallback,useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {Canvas,useThree,type ThreeEvent} from '@react-three/fiber';
import {OrbitControls,useGLTF,Html,Bvh} from '@react-three/drei';
import {Box3,Mesh,MeshLambertMaterial,Vector3} from 'three';
import type {OrbitControls as OrbitControlsImpl} from 'three-stdlib';
import type {MuscleGroup} from '../lib/exercise-guides';
import type {AnatomyViewerProps} from './anatomy-viewer';
const asset='/fitness/models/muscular.glb?v=20261006';
class ViewerBoundary extends Component<{children:ReactNode;onClose:()=>void},{failed:boolean}>{
 state={failed:false};static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<div className="anatomy-3d-loading" role="alert"><p>3D is unavailable on this device or the model could not load.</p><button onClick={()=>{useGLTF.clear(asset);this.setState({failed:false});}}>Retry</button><button onClick={this.props.onClose}>Use 2D view</button></div>:this.props.children;}
}
function Body({selected,streak,onSelect,onHover,onReady,canSelect}:{selected:MuscleGroup;streak:number;onSelect:(group:MuscleGroup)=>void;onHover:(group:MuscleGroup|null)=>void;onReady:()=>void;canSelect:()=>boolean}){
 const {scene}=useGLTF(asset,'/fitness/models/draco/');
 const invalidate=useThree(s=>s.invalidate),[hover,setHover]=useState<MuscleGroup|null>(null);
 const body=useMemo(()=>{
  // Asset already contains twelve documented regions; useGLTF caches its decoded geometry.
  const copy=scene.clone(true);copy.traverse(o=>{if(o instanceof Mesh){const group=!Array.isArray(o.material)&&o.material.userData.fitnessMuscle;o.userData.fitnessMuscle=group==='neutral'?undefined:group;o.material=new MeshLambertMaterial({color:'#777f84'});}});
  const bounds=new Box3().setFromObject(copy),center=bounds.getCenter(new Vector3()),scale=2.8/bounds.getSize(new Vector3()).y;copy.position.sub(center);return {copy,scale};
 },[scene]);
 useEffect(()=>{body.copy.traverse(o=>{if(o instanceof Mesh){const group=o.userData.fitnessMuscle;const chosen=selected!=='Full body'&&group===selected;const color=chosen?(streak>=7?'#fb7185':streak>=3?'#80e4bd':'#f6cf70'):group&&group===hover?'#9edfff':'#777f84';(o.material as MeshLambertMaterial).color.set(color);}});invalidate();},[body,selected,streak,hover,invalidate]);
 useEffect(()=>{onReady();return()=>{body.copy.traverse(o=>{if(o instanceof Mesh){(o.material as MeshLambertMaterial).dispose();o.geometry.dispose();}});};},[body,onReady]);
 const hovered=(e:ThreeEvent<PointerEvent>)=>{e.stopPropagation();const group=e.object.userData.fitnessMuscle as MuscleGroup|undefined;setHover(group||null);onHover(group||null);};
 return <Bvh firstHitOnly scale={body.scale}><primitive object={body.copy} dispose={null} onPointerMove={hovered} onPointerOut={()=>{setHover(null);onHover(null);}} onClick={(e:ThreeEvent<MouseEvent>)=>{e.stopPropagation();if(e.delta<=6&&canSelect()&&e.object.userData.fitnessMuscle)onSelect(e.object.userData.fitnessMuscle);}}/></Bvh>;
}
function Controls({command,active,reduced,onFailure}:{command:{view:string;id:number};active:boolean;reduced:boolean;onFailure:()=>void}){
 const controls=useRef<OrbitControlsImpl>(null);const {camera,gl,invalidate,setFrameloop}=useThree();
 useEffect(()=>{const lost=(event:Event)=>{event.preventDefault();onFailure();};gl.domElement.addEventListener('webglcontextlost',lost);return()=>gl.domElement.removeEventListener('webglcontextlost',lost);},[gl,onFailure]);
 useEffect(()=>{setFrameloop(active?'demand':'never');if(active)invalidate();},[active,invalidate,setFrameloop]);
 useEffect(()=>{const c=controls.current;if(!c)return;const v=command.view;if(v==='in'||v==='out'){const distance=Math.max(2.2,Math.min(7,camera.position.length()*(v==='in'?.8:1.25)));camera.position.setLength(distance);}else{camera.position.set(0,0,v==='back'?-4.6:4.6);c.target.set(0,0,0);}c.update();invalidate();},[command,camera,invalidate]);
 return <OrbitControls ref={controls} makeDefault enablePan={false} enableDamping={!reduced} dampingFactor={.12} minDistance={2.2} maxDistance={7} minPolarAngle={Math.PI*.28} maxPolarAngle={Math.PI*.72} enabled={active}/>;
}
function Viewer(props:AnatomyViewerProps){
 const [reduced,setReduced]=useState(false),[ready,setReady]=useState(false),[hover,setHover]=useState<MuscleGroup|null>(null),[command,setCommand]=useState({view:'front',id:0}),[active,setActive]=useState(true),[lost,setLost]=useState(false),[retry,setRetry]=useState(0);const region=useRef<HTMLDivElement>(null);
  const interaction=useRef({pointers:new Set<number>(),x:0,y:0,dragged:false});
 const canSelect=useCallback(()=>!interaction.current.dragged,[]);
 const onReady=useCallback(()=>setReady(true),[]);
 useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReduced(media.matches);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
 useEffect(()=>{let inView=true;const visible=()=>setActive(inView&&!document.hidden);document.addEventListener('visibilitychange',visible);const observer=new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;visible();});if(region.current)observer.observe(region.current);return()=>{observer.disconnect();document.removeEventListener('visibilitychange',visible);};},[]);
 const select=(group:MuscleGroup)=>{props.onSelect(group);if(['Back','Triceps','Glutes','Hamstrings','Calves'].includes(group))setCommand(c=>({view:'back',id:c.id+1}));};
 useEffect(()=>{setCommand(c=>({view:['Back','Triceps','Glutes','Hamstrings','Calves'].includes(props.selected)?'back':'front',id:c.id+1}));},[props.selected]);
 return <><div className="anatomy-3d-toolbar">{[['front','Front'],['back','Back'],['reset','Reset view'],['out','−'],['in','+']].map(([view,label])=><button key={view} aria-label={view==='in'?'Zoom in':view==='out'?'Zoom out':label} onClick={()=>setCommand(c=>({view,id:c.id+1}))}>{label}</button>)}<button onClick={props.onClose}>Back to 2D</button></div><div ref={region} className="anatomy-3d-canvas" onPointerDownCapture={e=>{const g=interaction.current;if(!g.pointers.size){g.x=e.clientX;g.y=e.clientY;g.dragged=false;}g.pointers.add(e.pointerId);if(g.pointers.size>1)g.dragged=true;}} onPointerMoveCapture={e=>{const g=interaction.current;if(g.pointers.size&&Math.hypot(e.clientX-g.x,e.clientY-g.y)>6)g.dragged=true;}} onPointerUpCapture={e=>interaction.current.pointers.delete(e.pointerId)} onPointerCancelCapture={e=>{interaction.current.pointers.delete(e.pointerId);interaction.current.dragged=true;}} aria-label="Interactive 3D muscle anatomy">{lost?<div className="anatomy-3d-loading" role="alert"><p>3D view paused. Try opening it again.</p><button onClick={()=>{setLost(false);setReady(false);setRetry(r=>r+1);}}>Retry</button><button onClick={props.onClose}>Use 2D view</button></div>:<Canvas key={retry} camera={{position:[0,0,4.6],fov:38}} dpr={1} frameloop="demand" gl={{antialias:true,powerPreference:'low-power'}} fallback={<div className="anatomy-3d-loading">3D is unavailable. <button onClick={props.onClose}>Use 2D view</button></div>}><ambientLight intensity={1.4}/><directionalLight position={[3,4,5]} intensity={2.2}/><directionalLight position={[-3,1,-4]} intensity={1.4}/><Suspense fallback={<Html center><div className="anatomy-model-loading" role="status">Loading anatomy…</div></Html>}><Body {...props} onSelect={select} onHover={setHover} onReady={onReady} canSelect={canSelect}/></Suspense><Controls command={command} active={active} reduced={reduced} onFailure={()=>setLost(true)}/></Canvas>}<span className="anatomy-3d-label" data-ready={ready} aria-live="polite">{hover||props.selected}</span></div><small className="anatomy-3d-credit">Illustrative muscle targets · <a href="/fitness/models/ATTRIBUTION.md" target="_blank" rel="noreferrer">Z-Anatomy / BodyParts3D · attribution & licenses</a></small></>;
}
export default function AnatomyThree(props:AnatomyViewerProps){return <ViewerBoundary onClose={props.onClose}><Viewer {...props}/></ViewerBoundary>;}







