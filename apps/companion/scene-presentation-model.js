"use strict";
// Ephemeral geometry only. Nothing here reads actors, pays resources or writes Scene.
(function(root){
  const TTL=6000,PING_TTL=1200;
  const COLORS=Object.freeze(["#65c8d0","#dfb657","#cf5274","#809dde","#b193d3","#75b9a0","#df9570","#c0c873","#79b4cb","#c791b5","#a4b5c8","#ba9e70"]);
  const KINDS=new Set(["ping","line","rectangle","cells"]);
  function point(value,space){return value&&Number.isSafeInteger(value.x)&&Number.isSafeInteger(value.y)&&value.x>=0&&value.y>=0&&value.x<space.width&&value.y<space.height;}
  function line(a,b){
    const cells=[];let x=a.x,y=a.y;const dx=Math.abs(b.x-x),sx=x<b.x?1:-1,dy=-Math.abs(b.y-y),sy=y<b.y?1:-1;let error=dx+dy;
    for(let guard=0;guard<128;guard++){
      cells.push(`${x},${y}`);if(x===b.x&&y===b.y)return cells;
      const twice=2*error;if(twice>=dy){error+=dy;x+=sx}if(twice<=dx){error+=dx;y+=sy}
    }
    throw new Error("Presentation line exceeds board capacity");
  }
  function geometry(kind,a,b,space,trail=[]){
    if(!KINDS.has(kind)||!space||!point(a,space)||!point(b||a,space))throw new Error("Invalid presentation geometry");
    if(kind==="ping")return [`${a.x},${a.y}`];
    if(kind==="line")return line(a,b);
    if(kind==="rectangle"){
      const cells=[];for(let y=Math.min(a.y,b.y);y<=Math.max(a.y,b.y);y++)for(let x=Math.min(a.x,b.x);x<=Math.max(a.x,b.x);x++)cells.push(`${x},${y}`);
      if(cells.length>128)throw new Error("Presentation exceeds board capacity");return cells;
    }
    return validateCells([...new Set([...trail,...line(a,b)])],space);
  }
  function validateCells(cells,space){
    if(!Array.isArray(cells)||!cells.length||cells.length>128||new Set(cells).size!==cells.length)throw new Error("Invalid presentation cells");
    for(const key of cells){if(typeof key!=="string"||!/^(0|[1-9][0-9]?),(0|[1-9][0-9]?)$/u.test(key))throw new Error("Invalid presentation cell");const[x,y]=key.split(',').map(Number);if(!point({x,y},space))throw new Error("Presentation cell outside board");}
    return [...cells];
  }
  function frame(scene,row,{roomId,now=Date.now()}={}){
    if(!row||row.scene_id!==roomId||!KINDS.has(row.kind)||typeof row.id!=="string"||!row.id||row.id.length>80||typeof row.user_id!=="string"||!row.user_id||row.user_id.length>80)return null;
    if(row.policy_epoch!==(scene.tablePolicy?.epoch||0)||!Number.isSafeInteger(row.color_slot)||row.color_slot<0||row.color_slot>=COLORS.length||typeof row.display_name!=="string"||row.display_name.length>80)return null;
    const created=Date.parse(row.created_at),expires=Date.parse(row.expires_at),space=(scene.spaces||[]).find(s=>s.id===row.space_id);
    if(!space||!Number.isFinite(created)||!Number.isFinite(expires)||created>now+2000||expires<=now||expires-created<=0||expires-created>(row.kind==='ping'?PING_TTL:TTL)+1)return null;
    try{const cells=validateCells(row.cells,space);if(row.kind==="ping"&&cells.length!==1)return null;return {id:row.id,userId:row.user_id,roomId,spaceId:row.space_id,kind:row.kind,cells,colorSlot:row.color_slot,name:row.display_name,created,expires};}catch{return null;}
  }
  root.DAWN_PRESENTATION_MODEL=Object.freeze({TTL,PING_TTL,COLORS,geometry,validateCells,frame});
})(typeof window==="object"?window:globalThis);
