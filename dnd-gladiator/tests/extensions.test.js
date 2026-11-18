import test from 'node:test';
import assert from 'node:assert/strict';
import { CLASSES } from '../content/classes.js';
import { KITS } from '../content/kits.js';
import { act, contender, fighter, fresh, recruit, upkeep } from '../rules.js';
import { train, closeWeek, upgrade, sign } from '../management.js';

test('a new catalog entry can be recruited, rendered and use composed effects', t => {
  CLASSES.guest = {...CLASSES.cleric, onHit:{push:1,heal:4}};
  t.after(() => delete CLASSES.guest);
  t.mock.method(Math,'random',()=>0.99);
  const f = recruit();
  assert.equal(f.job,'guest');
  let parts=0;
  KITS[CLASSES[f.job].kit](()=>parts++, {cloth:'#ffffff'});
  assert.ok(parts);
  const a=contender(f,2), b=contender(fighter('对手','guard'),3);
  a.hp-=6;
  act(a,b,'观察',1);
  assert.equal(a.hp,a.max-2);
  assert.equal(b.pos,4);
});
test('signature effects apply only on a hit and never heal above maximum',t=>{
  const a=contender(fighter('祭司','cleric'),1), b=contender(fighter('盾卫','guard'),2);
  a.hp--;
  const rng=t.mock.method(Math,'random',()=>0);
  act(a,b,'观察',1);
  assert.equal(a.hp,a.max-1);
  a.cd=0; rng.mock.mockImplementation(()=>0.99);
  act(a,b,'观察',2);
  assert.equal(a.hp,a.max);
});
test('signing, training slots and payroll use the same commands as the UI',()=>{
  const s=fresh();s.gold=400;
  const f=s.market[0];
  assert.equal(sign(s,f),true);
  assert.equal(sign(s,f),false);
  assert.equal(train(s,f,false),true);
  assert.equal(train(s,s.team[0],false),false);
  assert.equal(upgrade(s,'yard'),true);
  assert.equal(upgrade(s,'yard'),false);
  assert.equal(train(s,s.team[0],false),true);
  const expected=s.gold-upkeep(s);
  closeWeek(s);
  assert.equal(s.gold,expected);
  assert.equal(s.week,f.ready);
});
