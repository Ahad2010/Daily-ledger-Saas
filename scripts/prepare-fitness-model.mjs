// Reproducible GLB selection. Input: JMK712/human-anatomy-online muscular.glb.
// Geometry remains Z-Anatomy / BodyParts3D, see public/fitness/models/ATTRIBUTION.md.
import fs from 'node:fs';
const path='apps/web/public/fitness/models/muscular.glb';
const bytes=fs.readFileSync(path), length=bytes.readUInt32LE(12);
const model=JSON.parse(bytes.subarray(20,20+length));
const groups={
 Chest:['Clavicular head of pectoralis major muscle','Sternocostal head of pectoralis major muscle','(Abdominal part of pectoralis major muscle)'],
 Back:['Latissimus dorsi muscle','Ascending part of trapezius muscle','Descending part of trapezius muscle','Transverse part of trapezius muscle','Rhomboid major muscle','Rhomboid minor muscle'],
 Shoulders:['Acromial part of deltoid muscle','Clavicular part of deltoid muscle','Scapular spinal part of deltoid muscle'],
 Biceps:['Long head of biceps brachii','Short head of biceps brachii'],
 Triceps:['Long head of triceps brachii','Medial head of triceps brachii','Lateral head of triceps brachii'],
 Core:['Rectus abdominis muscle','External abdominal oblique muscle','Internal abdominal oblique muscle','Transversus abdominis muscle'],
 Glutes:['Gluteus maximus muscle','Gluteus medius muscle','Gluteus minimus muscle'],
 Quads:['Rectus femoris muscle','Vastus lateralis muscle','Vastus medialis muscle','Vastus intermedius muscle'],
 Hamstrings:['Long head of biceps femoris','Short head of biceps femoris','Semitendinosus muscle','Semimembranosus muscle'],
 Calves:['Lateral head of gastrocnemius','Medial head of gastrocnemius','Soleus muscle'],
 Forearms:['Flexor carpi radialis','Humeral head of flexor carpi ulnaris','Ulnar head of flexor carpi ulnaris','Extensor carpi radialis longus','Extensor carpi radialis brevis','Humeral head of extensor carpi ulnaris','Ulnar head of extensor carpi ulnaris','Extensor digitorum','Flexor digitorum profundus','Humero-ulnar head of flexor digitorum superficialis','Radial head of flexor digitorum superficialis'],
};
const mapping={};
for(const node of model.nodes){
 if(node.mesh===undefined)continue;
 // Remove atlas labels, enclosing fascia and joint/synovial sheets that obscure muscles.
 if(/\.[gj]\.\d+$/.test(node.name)||/fascia|bursa|sheath|retinacul|aponeurosis|intermuscular septum|tarsus|tendinous ring|trochlea/i.test(node.name)){delete node.mesh;continue;}
 for(const [group,names] of Object.entries(groups))if(names.some(name=>node.name===`${name}.l.001`||node.name===`${name}.r.001`)){
  node.extras={...node.extras,fitnessMuscle:group};mapping[node.name]=group;
 }
}
for(const group of Object.keys(groups))if(!Object.values(mapping).includes(group))throw Error(`Missing ${group}`);
const regionsOnly=process.argv.includes('--regions');
if(regionsOnly){
 const names=['neutral',...Object.keys(groups)];
 model.materials=names.map(name=>({name,extras:{fitnessMuscle:name},pbrMetallicRoughness:{baseColorFactor:[.5,.55,.58,1],metallicFactor:0,roughnessFactor:1}}));
 for(const node of model.nodes)if(node.mesh!==undefined)for(const primitive of model.meshes[node.mesh].primitives)primitive.material=names.indexOf(node.extras?.fitnessMuscle||'neutral');
}
const json=Buffer.from(JSON.stringify(model)), padded=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(padded);
const rest=bytes.subarray(20+length),header=Buffer.alloc(20);bytes.copy(header,0,0,12);header.writeUInt32LE(20+padded.length+rest.length,8);header.writeUInt32LE(padded.length,12);header.writeUInt32LE(0x4e4f534a,16);
fs.writeFileSync(regionsOnly?'artifacts/muscular-regions.glb':'artifacts/muscular-selected.glb',Buffer.concat([header,padded,rest]));
fs.writeFileSync('apps/web/public/fitness/models/muscle-mapping.json',JSON.stringify(mapping,null,2));
console.log(`${Object.keys(mapping).length} explicitly mapped bilateral muscle meshes`);
