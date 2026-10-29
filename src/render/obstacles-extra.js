// Отрисовка новых препятствий (шоколад, соски Маши, телепорты).
// Владелец файла — level-designer; art-director вызывает эти функции из board-view.js.
// Контракт: drawCellUnder — под фишкой (телепорты), drawCellOver — поверх фишки (шоколад),
// drawTileExtra — для фишки-соски вместо обычной фишки. Возвращает true, если нарисовал сам.
export function drawCellUnder(ctx, state, x, y, px, py, s, t) {}
export function drawCellOver(ctx, state, x, y, px, py, s, t) {}
export function drawTileExtra(ctx, tile, cx, cy, r, t) { return false; }
