// Effects run only after a signature skill hits. Handlers return visible feedback.
import { GEAR } from './league.js';

const handlers = {
  push(distance, attacker, target) {
    const before = target.pos;
    target.pos = Math.max(0, Math.min(6, before + Math.sign(before - attacker.pos) * distance));
    return '击退 ' + Math.abs(target.pos - before) + ' 格';
  },
  freeze(enabled, attacker, target) {
    if (GEAR[target.gear]?.frostproof) return '目标免疫霜缚';
    target.frozen = enabled;
    return '目标被霜缚';
  },
  heal(amount, attacker) {
    const recovered = Math.min(amount, attacker.max - attacker.hp);
    attacker.hp += recovered;
    return '恢复 ' + recovered + ' HP';
  }
};

export function applyEffects(effects, attacker, target) {
  return Object.entries(effects || {}).map(([id, value]) => handlers[id](value, attacker, target));
}
