/**
 * Stitch 卡片图片路径工具
 * 基于实际生成的 PNG 文件命名
 */

// Vite 在构建时会把 BASE_URL 替换成配置的 base（以 `/` 结尾）；
// 这样 app 在根路径 `/` 运行、Histoire 在 `/crime-scene-investigation/` 子路径
// 运行时，都能拿到正确的资源前缀。
const BASE = import.meta.env.BASE_URL

// === 卡片图片 URL 函数 ===

/** 手段卡图片 (M001.png ~ M090.png) */
export function getMeansCardImage(id: string): string {
  return `${BASE}assets/cards/means/${id}.png`
}

/** 线索卡图片 (C001.png ~ C220.png) */
export function getClueCardImage(id: string): string {
  return `${BASE}assets/cards/clues/${id}.png`
}

/** 效果卡图片 (E01.png ~ E10.png) */
export function getEffectCardImage(id: string): string {
  return `${BASE}assets/cards/effects/${id}.png`
}

/** 通用：根据卡片类型和 ID 获取图片 */
export function getCardImage(type: 'means' | 'clue', id: string): string {
  return type === 'means' ? getMeansCardImage(id) : getClueCardImage(id)
}

// === 卡背图片 ===

export const CARD_BACKS = {
  means: `${BASE}assets/cards/means/means-card-back.png`,
  clue: `${BASE}assets/cards/clues/clue-card-back.png`,
  effect: `${BASE}assets/cards/effects/effect-card-back.png`,
} as const

// === 场景板图片 ===

const BOARD_FILE_MAP: Record<string, string> = {
  'B-CAUSE': 'board-cause-death.png',
  'B-LOC-A': 'board-location-a.png',
  'B-LOC-B': 'board-location-b.png',
  'B-LOC-C': 'board-location-c.png',
  'B-LOC-D': 'board-location-d.png',
  'B-LOC-E': 'board-location-e.png',
  'B-LOC-F': 'board-location-f.png',
  'B-LOC-G': 'board-location-g.png',
  'B-LOC-H': 'board-location-h.png',
  'B-SCN-01': 'board-time.png',
  'B-SCN-02': 'board-weather.png',
  'B-SCN-03': 'board-witness.png',
  'B-SCN-04': 'board-body-type.png',
  'B-SCN-05': 'board-gender.png',
  'B-SCN-06': 'board-traces.png',
  'B-SCN-07': 'board-relationship.png',
  'B-SCN-08': 'board-motive.png',
  'B-SCN-09': 'board-scene-state.png',
  'B-SCN-10': 'board-culprit-state.png',
  'B-SCN-11': 'board-social-id.png',
  'B-SCN-12': 'board-clothing.png',
  'B-SCN-13': 'board-duration.png',
  'B-SCN-14': 'board-struggle.png',
  'B-SCN-15': 'board-sound.png',
  'B-SCN-16': 'board-escape.png',
  'B-SCN-17': 'board-key-item.png',
  'B-SCN-18': 'board-season.png',
  'B-SCN-19': 'board-victim-age.png',
  'B-SCN-20': 'board-floor.png',
  'B-SCN-21': 'board-lighting.png',
  'B-SCN-22': 'board-sudden-event.png',
}

/** 场景板图片 */
export function getBoardImage(id: string): string | undefined {
  const file = BOARD_FILE_MAP[id]
  return file ? `${BASE}assets/cards/boards/${file}` : undefined
}

/** 场景板图片（按文件名） */
export function getBoardImageByFile(file: string): string {
  return `${BASE}assets/cards/boards/${file}`
}
