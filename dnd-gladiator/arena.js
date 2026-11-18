const $=id=>document.getElementById(id);
const key='grey-sand.hero.v1';
let hero, player, enemy, stage, turn, moved, cooldown, rooted, ended;
const job=()=>JOBS[hero.job];
for(const [value,data] of Object.entries(JOBS)) $('job').add(new Option(data.name,value));
function generate(){
 const names=['灰雀','铁橡','赤鸦','白棘','夜砾','青隼'];
 return {name:names[dice(names.length)-1],job:$('job').value,seed:Math.floor(Math.random()*0xffffffff)};
}
function draw(){
 const ctx=$('portrait').getContext('2d');
 let state=hero.seed>>>0;
 function pick(list){state=(Math.imul(state,1664525)+1013904223)>>>0;return list[Math.floor(state/4294967296*list.length)]}
 function box(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(x*4,y*4,w*4,h*4)}
 const skin=pick(['#c58563','#945f49','#dfa37e','#ab745c']), hair=pick(['#39302b','#a86342','#ded1aa','#473c42']);
 box(0,0,24,24,pick(['#414c50','#554449','#454e42']));box(3,21,18,3,'#181e22');box(5,19,14,5,job().color);
 box(10,16,4,4,skin);box(7,6,10,10,skin);box(8,15,8,2,skin);box(6,5,12,3,hair);box(6,8,pick([1,2,3]),5,hair);
 box(9,10,2,1,'#372e2c');box(14,10,2,1,'#372e2c');box(11,14,3,1,'#754e42');
 if(hero.job==='fighter'){box(6,4,12,4,'#939d99');box(5,7,14,1,'#e3ce9d');box(11,2,2,4,'#b65841')}
 if(hero.job==='ranger'){box(8,3,8,3,job().color);box(5,6,14,2,'#58764c');box(16,3,2,4,'#ddac69')}
 if(hero.job==='mage'){box(9,3,7,3,job().color);box(12,1,3,3,job().color);box(4,6,15,2,'#675583')}
 box(7,20,3,4,'#513f32');box(9,20,2,2,'#e2c382');
 $('summary').textContent=job().name+' · 生命 '+job().hp+' · 护甲 '+job().ac+' · 普攻射程 '+job().range+' 格。'+job().skill+'：'+EFFECTS[job().effect]+'。';
}
function showHero(){ $('job').value=hero.job;$('heroName').value=hero.name;draw() }
hero=generate();
try{const h=JSON.parse(localStorage.getItem(key));if(h&&Object.hasOwn(JOBS,h.job)&&typeof h.name==='string'&&Number.isInteger(h.seed))hero=h}catch{}
showHero();
$('roll').onclick=()=>{hero=generate();showHero()};
$('job').onchange=()=>{hero.job=$('job').value;draw()};
$('png').onclick=()=>{const a=document.createElement('a');a.download=($('heroName').value.trim()||'角斗士')+'.png';a.href=$('portrait').toDataURL();a.click()};
$('start').onclick=()=>{hero.name=$('heroName').value.trim()||'无名客';let saved=true;try{localStorage.setItem(key,JSON.stringify(hero))}catch{saved=false}
 $('forge').hidden=true;$('arena').hidden=false;bout(0);if(!saved)note('浏览器未允许保存角色。')};
function note(s){let li=document.createElement('li');li.textContent=s;$('log').prepend(li)}
function bout(n){stage=n;turn=1;moved=false;ended=false;cooldown=0;rooted=false;player={...job(),pos:1};enemy={...FOES[n],pos:5};$('log').replaceChildren();note('号角响起。你先行动。');render()}
const distance=()=>Math.abs(player.pos-enemy.pos);
function enemyTurn(){
 if(!rooted&&distance()>enemy.range)enemy.pos+=Math.sign(player.pos-enemy.pos);
 rooted=false;
 if(distance()<=enemy.range)note(enemy.name+'出手：'+strike(enemy,player).text);else note(enemy.name+'逼近，仍在射程外。');
 turn++;moved=false;cooldown=Math.max(0,cooldown-1);render()
}
function attack(skill){
 const result=strike(player,enemy,skill&&job().effect==='pierce'?8:4);
 note((skill?job().skill:'普攻')+'：'+result.text);
 if(skill){cooldown=3;if(result.hit&&job().effect==='push')enemy.pos=Math.max(0,Math.min(6,enemy.pos+2*Math.sign(enemy.pos-player.pos)));
 if(result.hit&&job().effect==='root')rooted=true}
 if(enemy.hp)enemyTurn();else render()
}
function button(text,fn,disabled=false){const b=document.createElement('button');b.textContent=text;b.disabled=disabled;b.onclick=fn;$('actions').append(b)}
function render(){
 ended=!player.hp||!enemy.hp;
 $('round').textContent='第 '+(stage+1)+' / '+FOES.length+' 场　·　第 '+turn+' 回合';
 $('title').textContent=ended?(player.hp?(stage===FOES.length-1?'夺得灰砂桂冠':'赢下此场'):'落败于沙场'):enemy.name;
 $('vitals').replaceChildren();for(const [name,h] of [[hero.name,player],[enemy.name,enemy]]){let s=document.createElement('span');s.textContent=name+' · HP '+h.hp+' / '+(h===player?job().hp:FOES[stage].hp);$('vitals').append(s)}
 $('track').replaceChildren();for(let i=0;i<7;i++){const c=document.createElement('div');c.className='cell';if(i===player.pos){let img=new Image();img.src=$('portrait').toDataURL();img.alt='我方';c.append(img)}if(i===enemy.pos){const b=document.createElement('b');b.textContent='敌';c.append(b)}const s=document.createElement('small');s.textContent=i+1;c.append(s);$('track').append(c)}
 $('actions').replaceChildren();$('hint').textContent=ended?'':(moved?'本回合已移动':'每回合可先移动一格')+'。攻击或待机会结束回合。相距 '+distance()+' 格。';
 if(ended){if(player.hp&&stage<FOES.length-1)button('恢复生命，进入下一场',()=>bout(stage+1));else button('重新挑战',()=>bout(0));button('返回角色登记',()=>{$('arena').hidden=true;$('forge').hidden=false;showHero()});return}
 for(const delta of [-1,1]){let dest=player.pos+delta;button(delta<0?'← 左移':'右移 →',()=>{player.pos=dest;moved=true;render()},moved||dest<0||dest>6||dest===enemy.pos)}
 button('攻击 · '+job().range+'格',()=>attack(false),distance()>job().range);
 button(job().skill+(cooldown?' · 冷却 '+cooldown:' · '+job().reach+'格'),()=>attack(true),cooldown>0||distance()>job().reach);
 button('待机',enemyTurn)
}
