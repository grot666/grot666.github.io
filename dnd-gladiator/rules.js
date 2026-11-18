// 职业与对手由数据定义。射程以格计，伤害骰和命中加值独立配置。
const JOBS = {
 fighter:{name:'盾卫',hp:26,ac:15,range:1,die:8,skill:'盾击',reach:1,effect:'push',color:'#619aa3'},
 ranger:{name:'游侠',hp:21,ac:13,range:3,die:6,skill:'穿甲箭',reach:4,effect:'pierce',color:'#83a86b'},
 mage:{name:'法师',hp:18,ac:12,range:3,die:8,skill:'霜缚',reach:3,effect:'root',color:'#a78bc6'}
};
const FOES=[
 {name:'铜环斗士',hp:17,ac:12,range:1,die:6},
 {name:'灰羽弩手',hp:20,ac:13,range:3,die:6},
 {name:'赤砂冠军',hp:28,ac:15,range:1,die:8}
];
const EFFECTS={push:'命中后击退两格',pierce:'命中检定额外 +4',root:'命中后封锁对手下一回合的移动'};
const dice=n=>1+Math.floor(Math.random()*n);
function strike(attacker,target,bonus=4){
 const roll=dice(20), hit=roll===20||(roll!==1&&roll+bonus>=target.ac);
 const damage=hit?dice(attacker.die)+(roll===20?dice(attacker.die):0)+2:0;
 target.hp=Math.max(0,target.hp-damage);
 return {hit,text:'d20 掷出 '+roll+' + '+bonus+' 对 AC '+target.ac+'，'+(hit?(roll===20?'暴击':'命中')+'，造成 '+damage+' 点伤害':'落空')};
}
