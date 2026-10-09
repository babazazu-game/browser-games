import { writeFileSync } from 'node:fs';
const states = [['archer_idle', 4], ['archer_walk', 6], ['archer_attack', 4], ['goblin_walk', 6], ['goblin_death', 6]];
const frames = {}; let index = 0;
for (const [state, count] of states) for (let i = 0; i < count; i++, index++) {
  frames[`${state}_${String(i).padStart(2, '0')}`] = {
    frame: { x: (index % 6) * 192, y: Math.floor(index / 6) * 192, w: 192, h: 192 }, rotated: false, trimmed: false,
    spriteSourceSize: { x: 0, y: 0, w: 192, h: 192 }, sourceSize: { w: 192, h: 192 }, pivot: { x: .5, y: .9 }
  };
}
writeFileSync('assets/characters.json', JSON.stringify({ frames, meta: { app: 'merge-defense atlas builder', version: '1.0', image: 'characters.png', format: 'RGBA8888', size: { w: 1152, h: 960 }, scale: '1' } }, null, 2));
