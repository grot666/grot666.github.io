import { FACILITIES, GEAR } from './content/league.js';
import { fee, recruit, upkeep } from './rules.js';

function purchase(state, price) {
  if (state.gold < price) return false;
  state.gold -= price;
  return true;
}
export function sign(state, fighter) {
  const index = state.market.indexOf(fighter);
  if (index < 0 || !purchase(state, fee(fighter))) return false;
  state.market.splice(index, 1);
  while (state.team.some(member => member.id === fighter.id)) fighter.id += 'x';
  state.team.push(fighter);
  return true;
}
export function train(state, fighter, advanced) {
  const occupied = state.team.filter(member => member.trained === state.week).length;
  if (!state.team.includes(fighter) || fighter.ready > state.week ||
      occupied >= (state.facilities.yard ? 2 : 1) || (advanced && !state.facilities.coach)) return false;
  if (!purchase(state, advanced ? 22 : 14)) return false;
  fighter[advanced ? 'mastery' : 'level']++;
  fighter.trained = state.week;
  fighter.ready = state.week + 1;
  return true;
}
export function buyGear(state, id) {
  if (!GEAR[id] || !purchase(state, GEAR[id].cost)) return false;
  state.stock.push(id);
  return true;
}
export function upgrade(state, id) {
  if (!FACILITIES[id] || state.facilities[id] || !purchase(state, FACILITIES[id].cost)) return false;
  state.facilities[id] = true;
  return true;
}
export function closeWeek(state) {
  if (state.fight) return false;
  const cost = upkeep(state);
  state.gold -= cost;
  state.history.unshift('第 '+state.week+' 周结账 · 支出 '+cost+' 金');
  state.week++;
  state.taken = [];
  state.market = [recruit(), recruit(), recruit()];
  return true;
}
