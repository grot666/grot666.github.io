import { sign, train as scheduleTraining, buyGear, upgrade, closeWeek } from './management.js';
import { CLASSES } from './content/classes.js';
import { GEAR, FACILITIES } from './content/league.js';
import { fresh, fighter, recruit, fee, upkeep, offers, fightStart, exchange } from './rules.js';
import { paint } from './models.js';
const $=id=>document.getElementById(id);
const SAVE='greysand.manager.v2';
let state;
try{state=JSON.parse(localStorage.getItem(SAVE))}catch{}
if(!state||state.version!==2){
 state=fresh();
 try{
 const old=JSON.parse(localStorage.getItem('grey-sand.hero.v1'));
 const job={fighter:'guard',ranger:'bow',mage:'mage'}[old?.job];
 if(job&&Number.isInteger(old.seed))state.team[0]=fighter(String(old.name).slice(0,16),job,old.seed);
 }catch{}
}
let page=state.fight?'比赛':'馆务', selected=state.team[0].id, angle=0, timer=0, animation=0, busy=false;
const tabs=['馆务','角斗士','签约市场','装备与设施','赛事'];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function save(){try{localStorage.setItem(SAVE,JSON.stringify(state))}catch{$('notice').textContent='当前浏览器无法保存，请在关闭前完成本场。'}}
const active=()=>state.team.find(f=>f.id===selected)||state.team[0];
const ready=f=>f.ready<=state.week;
const status=f=>ready(f)?'可出赛':'第 '+f.ready+' 周复出';
function btn(label,fn,off=false){const b=document.createElement('button');b.textContent=label;b.disabled=off;b.onclick=fn;return b}
function add(id,label,fn,off=false){$(id).append(btn(label,fn,off))}
function commit(msg){render();$('notice').textContent=msg||'';save()}
function go(next){page=next;render()}
function card(title,body,id){return '<article class="card"><h3>'+esc(title)+'</h3>'+body+'<div id="'+id+'"></div></article>'}
function model(id,f){paint($(id),[{f,pos:3}],false,angle)}
function pic(id){return '<canvas id="'+id+'" width="380" height="225" aria-label="三维选手形象"></canvas>'}
function portrait(id,f){const a=document.createElement('a');a.download=f.name+'.png';a.href=$(id).toDataURL('image/png');a.click()}
function render(){
 clearTimeout(timer);cancelAnimationFrame(animation);
 $('notice').textContent='';$('nav').replaceChildren();$('cash').innerHTML='第 '+state.week+' 周<br><strong>'+state.gold+' 金</strong>';
 for(const t of tabs){const b=btn(t,()=>go(t),!!state.fight);if(t===page)b.className='active';$('nav').append(b)}
 if(state.fight)return fightView();
 ({'馆务':office,'角斗士':roster,'签约市场':market,'装备与设施':shop,'赛事':events})[page]();
}
function office(){
 const wages=state.team.reduce((n,f)=>n+f.wage,0),cost=upkeep(state);
 $('view').innerHTML='<div class="line"><h2>本周馆务</h2><small>'+ (state.crown?'已夺联赛冠军':'联赛目标 · 赢得冠军挑战赛')+'</small></div><canvas class="scene" id="hall" width="960" height="300"></canvas><div class="grid">'+card('比赛日','<p>'+state.team.filter(ready).length+' 人可出赛 · 已接 '+state.taken.length+' / 3 场</p>','book')+card('周末账单','<p>选手底薪 '+wages+' 金 + 场馆 '+(cost-wages)+' 金</p><strong>合计 '+cost+' 金</strong>','week')+'</div><h2>角斗馆纪事</h2><p>'+state.history.slice(0,8).map(esc).join('<br>')+'</p>';
 if(!state.history.length)$('view').lastElementChild.textContent='开馆日。两名选手已登记，可以安排首场比赛。';
 paint($('hall'),state.team.slice(0,5).map((f,i)=>({f,pos:1+i,enemy:i%2})));add('book','查看比赛合同',()=>go('赛事'));
 add('week','支付周费，进入下周',()=>{closeWeek(state);commit('新一周的合同和候选选手已到。')});
}
function roster(){
 const f=active(),c=CLASSES[f.job];selected=f.id;
 $('view').innerHTML='<h2>角斗士名册</h2><div class="line"><select aria-label="选择角斗士" id="pick"></select></div><div class="grid"><div class="card">'+pic('portrait')+'<div id="photo"></div></div>'+card(f.name,'<p>'+c.name+' · '+status(f)+' · 底薪 '+f.wage+' 金</p><p>'+f.wins+' 胜 '+f.losses+' 负 · 排名积分 '+f.rank+'</p><p>训练等级 '+f.level+' · 专训 '+f.mastery+' · 招牌技 '+c.skill+'</p><p>装备：'+(GEAR[f.gear]?.name||'基础装备')+'</p>','manage')+'</div>';
 for(const g of state.team)$('pick').add(new Option(g.name+' · '+CLASSES[g.job].name,g.id));$('pick').value=f.id;$('pick').onchange=()=>{selected=$('pick').value;render()};
 model('portrait',f);add('photo','旋转',()=>{angle+=.65;model('portrait',f)});add('photo','保存肖像 PNG',()=>portrait('portrait',f));
 function train(spec){if(!scheduleTraining(state,f,spec))return;commit('训练完成，本周休赛。')}
 const full=state.team.filter(g=>g.trained===state.week).length>=(state.facilities.yard?2:1);
 add('manage','基础训练 · 14 金（本周休赛）',()=>train(false),!ready(f)||full||state.gold<14);
 if(state.facilities.coach)add('manage','招牌技专训 · 22 金',()=>train(true),!ready(f)||full||state.gold<22);
 for(const k of new Set(state.stock))add('manage','装备'+GEAR[k].name,()=>{state.stock.splice(state.stock.indexOf(k),1);if(f.gear)state.stock.push(f.gear);f.gear=k;commit('装备已更换。')});
 if(f.gear)add('manage','卸下装备',()=>{state.stock.push(f.gear);f.gear=null;commit()});
}
function market(){
 $('view').innerHTML='<h2>签约市场</h2><p class="muted">每周更新候选人。签约当日即可出赛，底薪从本周起计。</p><div class="grid">'+state.market.map((f,i)=>card(f.name,pic('m'+i)+'<p>'+CLASSES[f.job].name+' · '+CLASSES[f.job].skill+' · 周薪 '+f.wage+' 金</p>','sign'+i)).join('')+'</div><div class="panel"><h3>自建角斗士</h3><label>擂台名 <input id="name" maxlength="16" placeholder="输入称号"></label><label>职业 <select id="class"></select></label><div id="custom"></div></div>';
 state.market.forEach((f,i)=>{model('m'+i,f);add('sign'+i,'签约 · '+fee(f)+' 金',()=>{if(!sign(state,f))return;selected=f.id;page='角斗士';commit('已签约。')},state.gold<fee(f))});
 for(const [k,v] of Object.entries(CLASSES))$('class').add(new Option(v.name,k));
 add('custom','生成试训形象',()=>{const f=recruit();f.job=$('class').value;f.name=$('name').value.trim()||f.name;state.market.unshift(f);commit('新形象已加入候选名单，可查看后签约。')});
}
function shop(){
 $('view').innerHTML='<h2>装备铺</h2><div class="grid">'+Object.entries(GEAR).map(([k,g])=>card(g.name,'<p>'+g.desc+' · 库存 '+state.stock.filter(x=>x===k).length+'</p>','g'+k)).join('')+'</div><h2>训练馆升级</h2><div class="grid">'+Object.entries(FACILITIES).map(([k,g])=>card(g.name,'<p>'+g.desc+'</p><p>维护费 +'+g.fee+' 金 / 周</p>','u'+k)).join('')+'</div>';
 for(const [k,g] of Object.entries(GEAR))add('g'+k,'购买 · '+g.cost+' 金',()=>{if(!buyGear(state,k))return;commit('已入库，到角斗士名册中装备。')},state.gold<g.cost);
 for(const [k,g] of Object.entries(FACILITIES))add('u'+k,state.facilities[k]?'已启用':'升级 · '+g.cost+' 金',()=>{if(!upgrade(state,k))return;commit('场馆升级完成。')},state.facilities[k]||state.gold<g.cost);
}
function events(){
 const list=offers(state);
 $('view').innerHTML='<h2>本周比赛合同</h2><p class="muted">每名选手每周可打一场。出场费保底，获胜另有奖金。</p><div class="grid">'+list.map(o=>card(o.title,'<p>对手 · '+o.rival.name+' / '+CLASSES[o.rival.job].name+'</p><p>出场 '+o.purse+' 金 · 胜奖 '+o.bonus+' 金</p><small>需要排名积分 '+o.need+'</small><label><select aria-label="出赛选手" id="entry'+o.i+'"></select></label>','o'+o.i)).join('')+'</div>';
 for(const o of list){const el=$('entry'+o.i),available=state.team.filter(f=>ready(f)&&f.rank>=o.need);for(const f of available)el.add(new Option(f.name,f.id));if(!available.length)el.add(new Option('无符合条件的选手',''));
 const taken=state.taken.includes(o.i);add('o'+o.i,taken?'本周已接赛':'签约入场',()=>{fightStart(state,state.team.find(f=>f.id===el.value),o);page='比赛';commit()},taken||!available.length)}
}
function fightView(){
 const b=state.fight;busy=false;
 $('view').innerHTML='<div class="line"><h2>'+b.offer.title+'</h2><small>回合 '+b.round+' / 15</small></div><canvas class="scene" id="ring" width="960" height="340"></canvas><div class="meters">'+[b.a,b.b].map(p=>'<div><b>'+esc(p.name)+'</b> · '+p.hp+'/'+p.max+'<progress value="'+p.hp+'" max="'+p.max+'"></progress></div>').join('')+'</div><div class="panel"><strong>'+ (b.done?b.result:'场边指挥 · 剩余 '+b.calls+' 次')+'</strong><div id="orders"></div><small>'+ (b.done?'比赛收入已到账，战绩已保存。':'自动交手。压上可抢两格，退守可拉开并获得 +3 护甲。15 回合按剩余生命比例判定。')+'</small></div><ol class="log">'+b.log.slice(0,10).map(l=>'<li>'+esc(l)+'</li>').join('')+'</ol>';
 const draw=(a,bpos,who,phase)=>paint($('ring'),[{f:b.a,pos:a,phase:who===b.a.id?phase:0},{f:b.b,pos:bpos,enemy:true,phase:who===b.b.id?phase:0}]);draw(b.a.pos,b.b.pos);
 if(b.done){add('orders','返回角斗馆',()=>{state.fight=null;page='馆务';commit()});return}
 function advance(order){
 if(busy)return;busy=true;clearTimeout(timer);
 const start={a:b.a.pos,b:b.b.pos}, motion=exchange(state,order);save();
 const since=performance.now(),duration=600;
 function frame(now){const elapsed=(now-since)/duration,i=Math.floor(elapsed);
 if(i>=motion.length){render();return}
 const prev=i?motion[i-1]:start,next=motion[i],t=elapsed-i;
 const aPos=prev.a+(next.a-prev.a)*t, bPos=prev.b+(next.b-prev.b)*t;
 draw(aPos,bPos,next.actor,t);
 if(next.type!=='move'){
 const canvas=$('ring'),ctx=canvas.getContext('2d'),actor=next.actor===b.a.id?b.a:b.b;
 const scale=Math.min(canvas.width/9.4,canvas.height/3.6);
 const px=pos=>canvas.width/2+(pos-3)*1.04*scale;
 const from=px(actor===b.a?aPos:bPos),to=px(actor===b.a?bPos:aPos);
 const y=canvas.height*.69-scale, travel=Math.min(1,t*1.6);
 ctx.save();ctx.strokeStyle=CLASSES[actor.job].trail;
 ctx.lineWidth=CLASSES[actor.job].trailWidth || 5;ctx.beginPath();
 ctx.moveTo(from+(to-from)*Math.max(0,travel-.20),y+5);
 ctx.lineTo(from+(to-from)*travel,y-5);ctx.stroke();
 if(t>.55){ctx.fillStyle=ctx.strokeStyle;ctx.font='bold 20px sans-serif';ctx.textAlign='center';ctx.fillText(next.type==='hit'?'命中':'闪避',to,y-scale*.95)}
 ctx.restore();
 }
 animation=requestAnimationFrame(frame)}
 animation=requestAnimationFrame(frame);
 }
 for(const order of ['压上','退守','观察'])add('orders',order,()=>advance(order),order!=='观察'&&b.calls<=0);
 timer=setTimeout(()=>advance('观察'),3400);
}
render();save();
