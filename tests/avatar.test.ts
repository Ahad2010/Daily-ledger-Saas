import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {cloudinarySignature,validAvatar,cloudinaryConfigured} from '../apps/api/src/avatar';
import {startApi} from './support/api';
const skip=!process.env.TEST_DATABASE_URL;

test('Cloudinary signatures match the documented algorithm',()=>{
 assert.equal(cloudinarySignature({eager:'w_400,h_300,c_pad|w_260,h_200,c_crop',public_id:'sample_image',timestamp:1315060510},'abcd'),'bfd09f95f331f558cbd1320e67aa8d488770583e');
});

test('only images in our Cloudinary account under the user\'s own public ID are accepted',()=>{
 const id=randomUUID(),other=randomUUID(),publicId=`daily-ledger/avatars/${id}-0a1b2c3d`;
 const url=`https://res.cloudinary.com/democloud/image/upload/c_fill,h_256,w_256/v1700000000/${publicId}.jpg`;
 assert.equal(validAvatar(id,'democloud',url,publicId),true);assert.equal(validAvatar(id,'democloud',`https://res.cloudinary.com/democloud/image/upload/v1/${publicId}.webp`,publicId),true);
 assert.equal(validAvatar(other,'democloud',url,publicId),false,'another user\'s image');
 assert.equal(validAvatar(id,'othercloud',url,publicId),false,'another Cloudinary account');
 assert.equal(validAvatar(id,'democloud',url.replace('https://res.cloudinary.com','https://evil.example'),publicId),false);
 assert.equal(validAvatar(id,'democloud',url.replace('.jpg','.svg'),publicId),false);
 assert.equal(validAvatar(id,'democloud',url+'?x=1',publicId),false);
 assert.equal(validAvatar(id,'democloud',url,`daily-ledger/avatars/${id}-../../x`),false);
 assert.equal(cloudinaryConfigured(),false);
});

test('avatar API: signed upload parameters, ownership-validated save and removal; unconfigured is explicit',{skip,timeout:120000},async()=>{
 const off=await startApi(4051);
 try{const u=await off.user();assert.equal((await u.json('/api/profile/avatar')).configured,false);assert.equal((await u.request('/api/profile/avatar/sign','POST')).status,503);}finally{await off.stop();}
 const secret='test-api-secret',api=await startApi(4052,{CLOUDINARY_CLOUD_NAME:'democloud',CLOUDINARY_API_KEY:'123456',CLOUDINARY_API_SECRET:secret});
 try{
  const u=await api.user(),other=await api.user();
  const signed=await u.json('/api/profile/avatar/sign','POST');assert.equal(signed.cloudName,'democloud');assert.equal(signed.apiKey,'123456');assert.ok(!JSON.stringify(signed).includes(secret),'the API secret never leaves the server');
  assert.match(signed.public_id,new RegExp(`^daily-ledger/avatars/${u.id}-[a-f0-9]{8}$`));assert.equal(signed.allowed_formats,'jpg,png,webp');
  assert.equal(signed.signature,cloudinarySignature({allowed_formats:signed.allowed_formats,public_id:signed.public_id,timestamp:signed.timestamp,transformation:signed.transformation},secret));
  const url=`https://res.cloudinary.com/democloud/image/upload/v1700000000/${signed.public_id}.jpg`;
  assert.equal((await other.request('/api/profile/avatar','PUT',{url,publicId:signed.public_id})).status,400,'cannot claim another user\'s upload');
  assert.equal((await u.request('/api/profile/avatar','PUT',{url:'https://evil.example/x.jpg',publicId:signed.public_id})).status,400);
  assert.equal((await u.request('/api/profile/avatar','PUT',{url,publicId:signed.public_id})).status,200);
  assert.equal((await u.json('/api/snapshot')).profile.avatarUrl,url);assert.equal((await other.json('/api/snapshot')).profile.avatarUrl,null);
  assert.equal((await u.request('/api/profile/avatar','DELETE')).status,204);assert.equal((await u.json('/api/snapshot')).profile.avatarUrl,null);
 }finally{await api.stop();}
});
