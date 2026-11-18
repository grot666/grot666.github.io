// Meshes are generated in world space, lit per face and projected onto canvas.
function paint(canvas, figures, scene=true, angle=0, time=0){
 const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
 const scale=scene?Math.min(w/9.4,h/3.6):h/2.7, faces=[];
 const bg=ctx.createLinearGradient(0,0,0,h);bg.addColorStop(0,'#142525');bg.addColorStop(.63,'#776650');bg.addColorStop(1,'#3b302a');
 ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
 function point(x,y,z){return [w/2+(x+.18*z)*scale,h*(scene?.69:.92)+(.40*z-.92*y)*scale]}
 function mesh(x,y,z,rx,rz,height,color,n=8,top=1,rot=0,tilt=0){
 const base=[],cap=[];
 for(let i=0;i<n;i++){
 const a=i*2*Math.PI/n+rot,dx=rx*Math.cos(a),dz=rz*Math.sin(a);
 base.push([x+dx,y,z+dz]);cap.push([x+dx*top+tilt,y+height,z+dz*top]);
 }
 function face(points,light){
 const depth=points.reduce((sum,v)=>sum+v[2]-.17*v[0]+.39*v[1],0)/points.length;
 const rgb=parseInt(color.slice(1),16);
 const fill='rgb('+[16,8,0].map(k=>Math.min(255,Math.floor((rgb>>k&255)*light))).join(',')+')';
 faces.push({depth,points:points.map(v=>point(...v)),fill});
 }
 for(let i=0;i<n;i++){let j=(i+1)%n;face([base[i],base[j],cap[j],cap[i]],.72+.24*Math.cos(rot+(i+.5)*2*Math.PI/n+2.2))}
 face(cap,1.16);
 }
 if(scene){
 for(let tier=0;tier<3;tier++)for(let i=-7;i<8;i++){
 const z=-1.8-tier*.72;mesh(i*.84,.04,z,.65,.59,.48+tier*.24,i%3?'#766c57':'#8c795f',4,1,Math.PI/4);
 for(let j=0;j<3;j++)mesh(i*.84+j*.21-.24,.47+tier*.24,z,.075,.085,.14,['#393c36','#575044','#604b42'][(i+9+j)%3],5,.66);
 }
 for(let i=0;i<7;i++)mesh((i-3)*1.04,-.21,0,.714,.95,.21,i%2?'#a8906d':'#b59b75',4,1,Math.PI/4);
 }
 for(const v of figures){
 const f=v.f, baseX=scene?(v.pos-3)*1.04:0, facing=scene?(v.enemy?-1:1):1;
 const phase=v.phase||0, gait=Math.sin(phase*Math.PI), turn=angle+(scene?facing*.78:0);
 const skin=['#cc926d','#98644e','#d6a47d','#b78163'][f.seed%4],hair=['#373330','#684437','#ac9270'][f.seed%3],cloth=CLASSES[f.job].color;
 function part(x,y,z,rx,rz,ht,col,n=8,top=1,lean=0){
 const xx=x*Math.cos(turn)+z*Math.sin(turn),zz=z*Math.cos(turn)-x*Math.sin(turn);
 mesh(baseX+xx+facing*gait*.11,y,zz,rx,rz,ht,col,n,top,turn,lean);
 }
 part(0,.005,0,.38,.22,.018,'#574934');
 for(const side of [-1,1]){
 part(side*.15,.03,.03+side*gait*.10,.115,.16,.16,'#473831');
 part(side*.14,.16,side*gait*.08,.10,.11,.48,'#5b5348',6,1.2);
 }
 part(0,.56,0,.31,.21,.36,cloth,8,.77);
 part(0,.90,0,.245,.18,.36,f.gear==='plate'?'#bbc7bf':cloth,8,1.32);
 part(0,.86,0,.26,.19,.08,'#75543a');part(0,1.25,0,.108,.10,.17,skin);
 part(0,1.39,0,.19,.16,.27,skin,8,1.06);part(0,1.61,-.01,.20,.17,.12,hair,8,.85);
 for(const side of [-1,1]){
 part(side*.32,1.12,0,.145,.14,.17,f.job==='guard'?'#9faea3':cloth);
 part(side*.34,.87,.04,.085,.10,.27,skin,6,1.12);part(side*.34,.81,.07,.10,.10,.11,'#674f3d');
 }
 if(f.job==='guard'){
 part(0,1.59,0,.22,.18,.15,'#9aab9e',8,.78);part(0,1.72,0,.055,.15,.14,'#a64c38');
 part(-.37,.69,.17,.22,.09,.51,'#557777',6,.85);
 part(.39,.84,.14,.12,.05,.045,'#cbac62');part(.39,.89,.14,.05,.035,.57,'#ced0bd',4,.16,facing*gait*.40);
 }else if(f.job==='mage'){
 part(0,1.66,0,.27,.23,.08,cloth);part(0,1.73,0,.18,.16,.30,cloth,7,.04);
 part(.39,.08,.13,.035,.035,1.44,'#886347');part(.39,1.51,.13,.09,.08,.21,'#9dd5d4',5,.2);
 }else{
 part(0,1.58,-.04,.21,.18,.23,cloth,7,.55);
 for(let i=0;i<7;i++)part(.34,.52+i*.13,.12+.15*Math.sin(Math.PI*i/6),.032,.035,.15,'#c59b6b');
 }
 }
 faces.sort((a,b)=>a.depth-b.depth);
 for(const face of faces){ctx.beginPath();face.points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=face.fill;ctx.fill()}
}
