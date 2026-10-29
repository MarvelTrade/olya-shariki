// Снимает снапшот уровней 1..120 со СТАРОГО генератора (tests/fixtures/legacy-index.html).
// Запуск: node tools/snapshot-legacy-levels.mjs  → tests/fixtures/levels-legacy.json
import { writeFileSync } from 'node:fs';
import { legacyGenLevel } from '../tests/legacy/legacy.mjs';

const { genLevel } = legacyGenLevel();
const out = [];
for (let n = 1; n <= 120; n++) out.push(JSON.parse(JSON.stringify(genLevel(n))));
writeFileSync(new URL('../tests/fixtures/levels-legacy.json', import.meta.url), JSON.stringify(out));
console.log('Сохранено уровней:', out.length);
