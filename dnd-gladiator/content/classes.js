// Stable keys are persisted in saved games. Multiple classes may share a model kit.
export const CLASSES = {
  guard: {
    name: '盾卫', hp: 32, ac: 15, range: 1, die: 8,
    skill: '盾震', cooldown: 3, onHit: { push: 2 },
    kit: 'shield', color: '#397b78', trail: '#ffcd83'
  },
  bow: {
    name: '游侠', hp: 24, ac: 13, range: 3, die: 6,
    skill: '穿甲箭', cooldown: 3, accuracy: 3,
    kit: 'archer', color: '#688357', trail: '#eee1ba', trailWidth: 3
  },
  mage: {
    name: '霜法师', hp: 21, ac: 12, range: 3, die: 8,
    skill: '霜缚', cooldown: 3, onHit: { freeze: true },
    kit: 'staff', color: '#70618b', trail: '#a8f5ff'
  },
  cleric: {
    name: '晨曦祭司', hp: 25, ac: 13, range: 2, die: 6,
    skill: '曙光汲取', cooldown: 3, onHit: { heal: 4 },
    kit: 'staff', color: '#b3904e', trail: '#ffdb75'
  }
};
