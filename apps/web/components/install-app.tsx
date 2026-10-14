'use client';
import {useEffect,useState} from 'react';
import {Smartphone,Download} from 'lucide-react';
import {Entrance} from './animation';
import {Button} from './ui/button';

interface InstallEvent extends Event{prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>}
// Install-to-home-screen card. Chromium browsers expose a prompt; iOS Safari only supports the manual Share menu route.
export function InstallApp(){
 const [event,setEvent]=useState<InstallEvent|null>(null),[standalone,setStandalone]=useState(true),[ios,setIos]=useState(false),[done,setDone]=useState(false);
 useEffect(()=>{
  setStandalone(window.matchMedia('(display-mode: standalone)').matches||(navigator as Navigator&{standalone?:boolean}).standalone===true);
  setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
  const before=(e:Event)=>{e.preventDefault();setEvent(e as InstallEvent);};const installed=()=>{setDone(true);setEvent(null);};
  window.addEventListener('beforeinstallprompt',before);window.addEventListener('appinstalled',installed);
  return()=>{window.removeEventListener('beforeinstallprompt',before);window.removeEventListener('appinstalled',installed);};
 },[]);
 if(standalone||(!event&&!ios&&!done))return null;
 async function install(){if(!event)return;await event.prompt();const choice=await event.userChoice;if(choice.outcome==='accepted')setDone(true);setEvent(null);}
 return <Entrance className="panel install-app"><div className="panel-heading"><div><span className="eyebrow">MOBILE & DESKTOP</span><h2>Install Daily Ledger</h2></div><Smartphone size={22}/></div>
  {done?<p className="mint" role="status">Daily Ledger was added to your device.</p>
  :event?<><p className="muted">Open Daily Ledger from your home screen or desktop, full screen and one tap away.</p><Button variant="primary" onClick={()=>void install()}><Download size={15}/>Install app</Button></>
  :<p className="muted">On iPhone or iPad: tap the Share button in Safari, then choose <strong>Add to Home Screen</strong>.</p>}
 </Entrance>;
}
