// Content tables are shared by the manager, renderer and fight simulation.
const CLASSES = {
  guard: {name:'盾卫', hp:32, ac:15, range:1, die:8, skill:'盾震', color:'#397b78'},
  bow: {name:'游侠', hp:24, ac:13, range:3, die:6, skill:'穿甲箭', color:'#688357'},
  mage: {name:'霜法师', hp:21, ac:12, range:3, die:8, skill:'霜缚', color:'#70618b'}
};
const GEAR = {
  blade:{name:'精制武具',cost:42,desc:'每次命中多造成 2 点伤害'},
  plate:{name:'护心甲',cost:38,desc:'护甲 +2'},
  boots:{name:'疾行靴',cost:48,desc:'首回合可移动两格，免疫霜缚'}
};
const FACILITIES = {
  yard:{name:'第二练武场',cost:72,fee:4,desc:'每周训练名额从 1 人增至 2 人'},
  clinic:{name:'医务室',cost:65,fee:3,desc:'新产生的伤停缩短一周'},
  coach:{name:'专项教练席',cost:85,fee:5,desc:'解锁招牌技专训，强化技能伤害'}
};
const RIVALS=[
 ['铁栅','guard'],['鸦羽','bow'],['白榛','mage'],['黑鹫','bow'],['铜牙','guard'],['蓝烬','mage']
];
const NAMES=['白棘','石榴','灰雀','铜铃','寒杉','苔刃','野蜂','赤桦','银鲈','铁橡','冬鸦','红砂'];
const roll=n=>1+Math.floor(Math.random()*n);
function fighter(name,job,seed=roll(999999),rank=0){
 return {id:'g'+seed,name,job,seed,rank,wins:0,losses:0,level:0,mastery:0,wage:7+rank*2,ready:1,trained:0,gear:null};
}
function recruit(){const seed=roll(999999);return fighter(NAMES[seed%NAMES.length],Object.keys(CLASSES)[roll(3)-1],seed,roll(3)-1)}
function fee(f){return 35+f.rank*12}
function upkeep(s){return 10+Object.keys(s.facilities).reduce((n,k)=>n+FACILITIES[k].fee,0)+s.team.reduce((n,f)=>n+f.wage,0)}
function fresh(){return {version:2,week:1,gold:140,team:[fighter('铜牙新秀','guard',4731),fighter('暮羽','bow',6582)],market:[recruit(),recruit(),recruit()],facilities:{},stock:[],taken:[],history:[],fight:null,crown:false}}
function offers(s){
 const tier=['垫场赛','主赛','冠军挑战赛'];
 return tier.map((title,i)=>{
 const ix=(s.week-1+i*2)%RIVALS.length, [name,job]=RIVALS[ix];
 const rival=fighter(name,job,891+ix,i*2);
 rival.level=i*2;
 return {i,title,rival,purse:[18,32,65][i],bonus:[15,26,55][i],need:[0,1,4][i]};
 });
}
function contender(f,pos){const c=CLASSES[f.job];const max=c.hp+f.level*2;return {...f,pos,hp:max,max,ac:c.ac+(f.gear==='plate'?2:0),cd:0,frozen:false}}
function fightStart(s,f,o){
 s.taken.push(o.i);f.ready=s.week+1;
 s.fight={a:contender(f,1),b:contender(o.rival,5),offer:o,round:1,calls:3,log:['裁判挥旗，比赛开始。'],done:false};
}
function act(p,q,order,round){
 const c=CLASSES[p.job],direction=Math.sign(q.pos-p.pos);
 let dist=Math.abs(p.pos-q.pos), move=0;
 if(!p.frozen){
 if(order==='退守')move=-direction;
 else if(dist>c.range||order==='压上'&&dist>1)move=direction*Math.min(dist-1,(order==='压上'||round===1&&p.gear==='boots')?2:1);
 }
 p.pos=Math.max(0,Math.min(6,p.pos+move));p.frozen=false;
 dist=Math.abs(q.pos-p.pos);p.cd=Math.max(0,p.cd-1);
 if(dist>c.range)return {text:p.name+'调整站位，尚未进入射程。',type:'move'};
 const special=p.cd===0, d=roll(20), bonus=4+Math.floor(p.level/2)+(special&&p.job==='bow'?3:0);
 if(special)p.cd=3;
 const label=special?c.skill:'普攻';
 if(d===1||d!==20&&d+bonus<q.ac+(q.guarding?3:0))return {text:p.name+'的'+label+'落空（d20 '+d+' + '+bonus+'）。',type:'miss'};
 const dmg=roll(c.die)+2+(d===20?roll(c.die):0)+(p.gear==='blade'?2:0)+(special?p.mastery*2:0);
 q.hp=Math.max(0,q.hp-dmg);
 if(special&&p.job==='guard')q.pos=Math.max(0,Math.min(6,q.pos+direction*2));
 if(special&&p.job==='mage'&&q.gear!=='boots')q.frozen=true;
 return {text:p.name+'使用'+label+'，'+(d===20?'暴击':'命中')+' −'+dmg+' HP（d20 '+d+'）。',type:'hit'};
}
function exchange(s,order='观察'){
 const b=s.fight;if(!b||b.done)return;
 if(order!=='观察'){if(b.calls<=0)order='观察';else b.calls--}
 b.a.guarding=order==='退守';
 const events=[];
 for(const [p,q,cmd] of [[b.a,b.b,order],[b.b,b.a,'观察']]){
 if(!p.hp)break;
 const event=act(p,q,cmd,b.round);
 events.push({...event,actor:p.id,a:b.a.pos,b:b.b.pos});
 b.log.unshift(event.text);
 }
 if(!b.a.hp||!b.b.hp||b.round>=15){
 const win=b.a.hp/b.a.max>b.b.hp/b.b.max, f=s.team.find(x=>x.id===b.a.id);
 const prize=b.offer.purse+(win?b.offer.bonus:0);
 s.gold+=prize;f[win?'wins':'losses']++;if(win)f.rank++;
 if(b.a.hp/b.a.max<0.35)f.ready+=s.facilities.clinic?0:1;
 if(win&&b.offer.i===2)s.crown=true;
 b.done=true;b.result=(win?'胜出':'落败')+' · 收入 '+prize+' 金';b.log.unshift(b.result);
 s.history.unshift('第 '+s.week+' 周 · '+f.name+' 对 '+b.b.name+' · '+b.result);
 }else b.round++;
 return events;
}
