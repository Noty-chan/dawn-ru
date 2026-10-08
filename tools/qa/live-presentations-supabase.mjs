import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
if(process.env.DAWN_LIVE_NETWORK_QA!=='disposable-campaigns') throw Error('Explicit disposable-campaigns opt-in required');
const require=createRequire(new URL('../../output/qa-net/package.json',import.meta.url));
const {createClient}=require('@supabase/supabase-js');
const config=fs.readFileSync(new URL('../../apps/companion/config.js',import.meta.url),'utf8');
const url=config.match(/supabaseUrl:\s*["']([^"']+)["']/)[1],key=config.match(/publishableKey:\s*["']([^"']+)["']/)[1];
const clients=Array.from({length:4},()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}));
const [owner,player,outsider,publicObserver]=clients,channels=[],created=[];
const receipt={status:'running',checks:{},cleanup:[]};
const check=r=>{if(r.error)throw Error(r.error.code+': '+r.error.message);return r.data;};
const one=r=>Array.isArray(r)?r[0]:r;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function subscribe(client,topic,privateChannel=true){
 const messages=[];const channel=client.channel(topic,{config:{private:privateChannel,broadcast:{ack:true,self:false}}}).on('broadcast',{event:'qa'},p=>messages.push(p.payload));
 channels.push({client,channel});
 const status=await new Promise(resolve=>{const timer=setTimeout(()=>resolve('TIMEOUT'),12000);channel.subscribe(s=>{if(['SUBSCRIBED','CHANNEL_ERROR','TIMED_OUT'].includes(s)){clearTimeout(timer);resolve(s);}});});
 return {channel,messages,status};
}
try{
 const sessions=await Promise.all(clients.slice(0,3).map((c,i)=>c.auth.signInAnonymously({options:{data:{display_name:'Disposable presentation QA '+i}}}).then(check)));
 check(await publicObserver.auth.setSession({access_token:sessions[0].session.access_token,refresh_token:sessions[0].session.refresh_token}));
 const campaign=one(check(await owner.rpc('create_campaign',{p_name:'Disposable presentation QA '+randomUUID(),p_display_name:'QA Narrator',p_initial_state:{version:1,actors:[],objects:[],spaces:[],privateNotes:'QA private'}})));
 created.push(campaign.campaign_id);
 const invite=check(await owner.rpc('create_campaign_invite',{p_campaign_id:campaign.campaign_id,p_role:'player',p_max_uses:1,p_expires_hours:1}));
 check(await player.rpc('redeem_campaign_invite',{p_token:invite,p_display_name:'QA Player'}));
 const roster=check(await player.rpc('presentation_roster',{target_scene_id:campaign.scene_id}));
 assert.equal(roster.length,2);receipt.checks.roster=true;
 assert.equal((await outsider.rpc('presentation_roster',{target_scene_id:campaign.scene_id})).error?.code,'42501');receipt.checks.foreignRosterDenied=true;
 const topic='dawn-present:'+campaign.scene_id+':'+sessions[1].user.id;
 const receive=await subscribe(owner,topic),send=await subscribe(player,topic);
 assert.equal(receive.status,'SUBSCRIBED');assert.equal(send.status,'SUBSCRIBED');
 const started=Date.now();assert.equal(await send.channel.send({type:'broadcast',event:'qa',payload:{id:'allowed'}}),'ok');
 await delay(1000);assert.equal(receive.messages.some(m=>m.id==='allowed'),true);receipt.checks.ownSend=true;receipt.deliveryUpperBoundMs=Date.now()-started;
 const before=send.messages.length;
 receipt.forgedSendResult=await receive.channel.send({type:'broadcast',event:'qa',payload:{id:'forged'}});
 await delay(600);assert.equal(send.messages.length,before);assert.notEqual(receipt.forgedSendResult,'ok');receipt.checks.authorForgeryDenied=true;
 const foreign=await subscribe(outsider,topic);receipt.foreignSubscribe=foreign.status;assert.notEqual(foreign.status,'SUBSCRIBED');receipt.checks.foreignSubscribeDenied=true;
 const publicListener=await subscribe(publicObserver,topic,false);assert.equal(publicListener.status,'SUBSCRIBED');
 assert.equal(await send.channel.send({type:'broadcast',event:'qa',payload:{id:'private-only'}}),'ok');await delay(600);
 assert.equal(receive.messages.some(m=>m.id==='private-only'),true);
 assert.equal(publicListener.messages.length,0);receipt.checks.publicPrivateIsolation=true;
 const ownerTopic='dawn-present:'+campaign.scene_id+':'+sessions[0].user.id;
 const ownerSender=await subscribe(owner,ownerTopic),playerReader=await subscribe(player,ownerTopic);
 assert.equal(ownerSender.status,'SUBSCRIBED');assert.equal(playerReader.status,'SUBSCRIBED');
 assert.equal(await ownerSender.channel.send({type:'broadcast',event:'qa',payload:{id:'read-before-revoke'}}),'ok');await delay(600);
 assert.equal(playerReader.messages.some(m=>m.id==='read-before-revoke'),true);
 check(await owner.from('campaign_members').delete().eq('campaign_id',campaign.campaign_id).eq('user_id',sessions[1].user.id));
 assert.equal((await player.rpc('presentation_roster',{target_scene_id:campaign.scene_id})).error?.code,'42501');
 const revokeBefore=receive.messages.length;
 receipt.revokedSendResult=await send.channel.send({type:'broadcast',event:'qa',payload:{id:'revoked'}});
 await delay(1000);receipt.checks.revokedLiveSocketDenied=receive.messages.length===revokeBefore;
 const revokeReadBefore=playerReader.messages.length;
 receipt.ownerSendAfterRevoke=await ownerSender.channel.send({type:'broadcast',event:'qa',payload:{id:'read-after-revoke'}});
 assert.equal(receipt.ownerSendAfterRevoke,'ok');await delay(600);receipt.checks.revokedLiveSocketReadDenied=playerReader.messages.length===revokeReadBefore;
 receipt.status=receipt.checks.revokedLiveSocketDenied&&receipt.checks.revokedLiveSocketReadDenied?'passed':'failed-revocation';
}catch(e){receipt.status='failed';receipt.error=String(e.message).slice(0,350);}
finally{
 await Promise.all(channels.map(({client,channel})=>client.removeChannel(channel).catch(()=>{})));
 for(const id of created){try{const r=await owner.rpc('delete_owned_campaign',{p_campaign_id:id});receipt.cleanup.push({deleted:!r.error&&r.data===true,error:r.error?.code});}catch(e){receipt.cleanup.push({deleted:false,error:String(e.message).slice(0,120)});}}
 await Promise.allSettled(clients.map(async c=>{try{await c.auth.signOut();}finally{c.realtime.disconnect();}}));
 receipt.authCleanup='Signed out; anonymous Auth records are retained (no admin deletion credentials).';
 if(receipt.cleanup.some(r=>!r.deleted))receipt.status='cleanup-incomplete';
 fs.mkdirSync('output',{recursive:true});fs.writeFileSync('output/live-presentations-20261009.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));
}
process.exitCode=receipt.status==='passed'?0:1;
