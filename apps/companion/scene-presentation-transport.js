"use strict";
// Authenticated, private per-author lanes. No Scene writes, persistence or retry queue.
window.DAWN_PRESENTATION_TRANSPORT=Object.freeze({create({client,getScene,emit,status,now=Date.now,rpc=(name,args)=>client.rpc(name,args)}){
  let generation=0,room=null,user=null,ready=false,busy=false,outTokens=4,outAt=now(),channels=new Map(),roster=new Map(),limits=new Map(),latest=new Map();
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  function notify(value){ready=value;status(value);}
  async function stop(){generation++;busy=false;notify(false);const old=[...channels.values()];channels.clear();roster.clear();limits.clear();latest.clear();room=null;user=null;await Promise.allSettled(old.map(ch=>client.removeChannel(ch)));}
  function accept(author,payload){
    const M=window.DAWN_PRESENTATION_MODEL,member=roster.get(author),scene=getScene();
    if(!ready||!member||!scene||!payload||typeof payload!=='object')return false;
    const row={id:payload.id,scene_id:room,user_id:author,display_name:member.display_name,color_slot:member.color_slot,policy_epoch:payload.epoch,space_id:payload.spaceId,kind:payload.kind,cells:payload.cells,created_at:payload.createdAt,expires_at:payload.expiresAt};
    const frame=M?.frame(scene,row,{roomId:room,now:now()});if(!frame)return false;
    const lane=`${author}:${frame.kind==='ping'?'ping':'drawing'}`,prior=latest.get(lane);
    if(prior&&(prior.created>frame.created||prior.id===frame.id))return false;
    const time=now(),bucket=limits.get(author)||{tokens:4,at:time};bucket.tokens=Math.min(4,bucket.tokens+Math.max(0,time-bucket.at)*3/1000);bucket.at=time;limits.set(author,bucket);if(bucket.tokens<1)return false;bucket.tokens--;
    latest.set(lane,{id:frame.id,created:frame.created});emit(row);return true;
  }
  async function start(sceneId,userId){
    const stopping=stop(),gen=generation;await stopping;if(gen!==generation||!uuid.test(sceneId)||!uuid.test(userId))return false;
    room=sceneId;user=userId;
    try{
      const response=await rpc('presentation_roster',{target_scene_id:sceneId});
      if(gen!==generation)return false;
      if(response.error||!Array.isArray(response.data)||response.data.length>12)throw Error('Presentation roster unavailable');
      for(const member of response.data){if(!uuid.test(member.user_id)||!Number.isInteger(member.color_slot)||member.color_slot<0||member.color_slot>=12||typeof member.display_name!=='string'||member.display_name.length>80)throw Error('Invalid presentation roster');roster.set(member.user_id,member);}
      if(!roster.has(userId))throw Error('Presentation membership unavailable');
      const subscribed=new Set();
      for(const author of roster.keys()){
        const ch=client.channel(`dawn-present:${sceneId}:${author}`,{config:{private:true,broadcast:{self:false,ack:true}}});channels.set(author,ch);
        ch.on('broadcast',{event:'gesture'},message=>{if(gen===generation)accept(author,message?.payload);}).subscribe(value=>{
          if(gen!==generation)return;
          if(value==='SUBSCRIBED'){subscribed.add(author);notify(subscribed.size===roster.size);}
          else if(['CLOSED','CHANNEL_ERROR','TIMED_OUT'].includes(value)){subscribed.delete(author);notify(false);}
        });
      }
      return true;
    }catch{if(gen===generation)await stop();return false;}
  }
  async function send(request){
    if(!ready||busy||!channels.has(user))return false;const gen=generation,M=window.DAWN_PRESENTATION_MODEL,time=now();
    const payload={id:request.clientId,epoch:request.epoch,spaceId:request.spaceId,kind:request.kind,cells:request.cells,createdAt:new Date(time).toISOString(),expiresAt:new Date(time+(request.kind==='ping'?M.PING_TTL:M.TTL)).toISOString()};
    const member=roster.get(user);
    if(!M.frame(getScene(),{id:payload.id,scene_id:room,user_id:user,display_name:member.display_name,color_slot:member.color_slot,policy_epoch:payload.epoch,space_id:payload.spaceId,kind:payload.kind,cells:payload.cells,created_at:payload.createdAt,expires_at:payload.expiresAt},{roomId:room,now:time}))return false;
    outTokens=Math.min(4,outTokens+Math.max(0,time-outAt)*3/1000);outAt=time;if(outTokens<1)return false;outTokens--;
    busy=true;try{const result=await channels.get(user).send({type:'broadcast',event:'gesture',payload});if(gen!==generation||result!=='ok')return false;return accept(user,payload);}catch{return false;}finally{if(gen===generation)busy=false;}
  }
  async function refresh(){
    if(!room||!user)return false;const gen=generation,sid=room,uid=user;
    try{const result=await rpc('presentation_roster',{target_scene_id:sid});if(gen!==generation)return false;if(result.error){await stop();return false;}
      const signature=rows=>JSON.stringify(rows.map(m=>[m.user_id,m.color_slot,m.display_name]).sort());
      if(!Array.isArray(result.data)||signature(result.data)!==signature([...roster.values()])||!ready)return start(sid,uid);
      return true;
    }catch{if(gen===generation)await stop();return false;}
  }
  return Object.freeze({start,stop,send,refresh,isReady:()=>ready});
}});
