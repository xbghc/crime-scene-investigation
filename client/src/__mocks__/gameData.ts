import type {
  Player,
  MeansCard,
  ClueCard,
  EffectCard,
  SceneBoard,
  GameState,
} from '../types'

// 10 色调色板
export const PLAYER_COLORS = [
  '#e06c75', // 玫瑰红
  '#61afef', // 天蓝
  '#98c379', // 草绿
  '#d19a66', // 橙褐
  '#c678dd', // 紫罗兰
  '#56b6c2', // 青色
  '#e5c07b', // 暖黄
  '#be5046', // 铁锈红
  '#7ec8e3', // 浅蓝
  '#c9a0dc', // 淡紫
]

export const mockMeansCards: MeansCard[] = [
  { id: 'M01', name: '刀' },
  { id: 'M02', name: '毒药' },
  { id: 'M03', name: '绳索' },
  { id: 'M04', name: '手枪' },
]

export const mockClueCards: ClueCard[] = [
  { id: 'C01', name: '血迹' },
  { id: 'C02', name: '指纹' },
  { id: 'C03', name: '脚印' },
  { id: 'C04', name: '烟蒂' },
]

export const mockPlayers: Player[] = [
  {
    id: 'p1', nickname: '小明', color: PLAYER_COLORS[0]!, isHost: true,
    role: 'witness', status: 'alive', hasSolveRight: false,
    meansCards: [], clueCards: [],
  },
  {
    id: 'p2', nickname: '小红', color: PLAYER_COLORS[1]!, isHost: false,
    role: 'murderer', status: 'alive', hasSolveRight: true,
    meansCards: [
      { id: 'M01', name: '刀' }, { id: 'M05', name: '斧头' },
      { id: 'M06', name: '锤子' }, { id: 'M07', name: '枕头' },
    ],
    clueCards: [
      { id: 'C01', name: '血迹' }, { id: 'C05', name: '纽扣' },
      { id: 'C06', name: '布料碎片' }, { id: 'C07', name: '手套' },
    ],
  },
  {
    id: 'p3', nickname: '小刚', color: PLAYER_COLORS[2]!, isHost: false,
    role: 'accomplice', status: 'alive', hasSolveRight: true,
    meansCards: [
      { id: 'M08', name: '针筒' }, { id: 'M09', name: '电击器' },
      { id: 'M10', name: '剪刀' }, { id: 'M11', name: '砖块' },
    ],
    clueCards: [
      { id: 'C08', name: '头发' }, { id: 'C09', name: '口红印' },
      { id: 'C10', name: '钥匙' }, { id: 'C11', name: '手机' },
    ],
  },
  {
    id: 'p4', nickname: '小花', color: PLAYER_COLORS[3]!, isHost: false,
    role: 'detective', status: 'alive', hasSolveRight: true,
    meansCards: [
      { id: 'M12', name: '铁管' }, { id: 'M13', name: '棒球棍' },
      { id: 'M14', name: '石头' }, { id: 'M15', name: '玻璃碎片' },
    ],
    clueCards: [
      { id: 'C12', name: '照片' }, { id: 'C13', name: '信件' },
      { id: 'C14', name: '日记本' }, { id: 'C15', name: '处方签' },
    ],
  },
  {
    id: 'p5', nickname: '阿强', color: PLAYER_COLORS[4]!, isHost: false,
    role: 'detective', status: 'alive', hasSolveRight: true,
    meansCards: [
      { id: 'M16', name: '螺丝刀' }, { id: 'M17', name: '扳手' },
      { id: 'M18', name: '钢琴线' }, { id: 'M19', name: '弓箭' },
    ],
    clueCards: [
      { id: 'C16', name: '车票' }, { id: 'C17', name: '收据' },
      { id: 'C18', name: '名片' }, { id: 'C19', name: '门卡' },
    ],
  },
  {
    id: 'p6', nickname: '小美', color: PLAYER_COLORS[5]!, isHost: false,
    role: 'detective', status: 'dead', hasSolveRight: false,
    meansCards: [
      { id: 'M20', name: '高尔夫球杆' }, { id: 'M21', name: '花瓶' },
      { id: 'M22', name: '灭火器' }, { id: 'M23', name: '平底锅' },
    ],
    clueCards: [
      { id: 'C20', name: '香水味' }, { id: 'C21', name: '汗味' },
      { id: 'C22', name: '泥土' }, { id: 'C23', name: '花粉' },
    ],
  },
  {
    id: 'p7', nickname: '大壮', color: PLAYER_COLORS[6]!, isHost: false,
    role: 'detective', status: 'alive', hasSolveRight: false,
    meansCards: [
      { id: 'M24', name: '菜刀' }, { id: 'M25', name: '冰锥' },
      { id: 'M26', name: '电锯' }, { id: 'M27', name: '铁链' },
    ],
    clueCards: [
      { id: 'C24', name: '火柴' }, { id: 'C25', name: '打火机' },
      { id: 'C26', name: '蜡烛' }, { id: 'C27', name: '纸巾' },
    ],
  },
]

export const mockBoards: SceneBoard[] = [
  {
    id: 'B01', type: 'cause', title: '死亡原因',
    options: ['窒息', '失血', '中毒', '重击', '烧伤', '溺亡'],
    marker: { optionIndex: 1, markerNumber: 1 },
  },
  {
    id: 'B02', type: 'location', title: '案发地点A',
    options: ['卧室', '浴室', '客厅', '厨房', '后院', '车库'],
    marker: { optionIndex: 3, markerNumber: 2 },
  },
  {
    id: 'B03', type: 'scene', title: '作案时间',
    options: ['凌晨', '清晨', '上午', '下午', '傍晚', '深夜'],
    marker: { optionIndex: 5, markerNumber: 3 },
  },
  {
    id: 'B04', type: 'scene', title: '凶手体型',
    options: ['高大', '矮小', '健壮', '瘦弱', '普通身材', '肥胖'],
    marker: { optionIndex: 2, markerNumber: 4 },
  },
  {
    id: 'B05', type: 'scene', title: '遗留痕迹',
    options: ['脚印', '指纹', '血迹', '毛发', '气味', '划痕'],
    marker: { optionIndex: 0, markerNumber: 5 },
  },
  {
    id: 'B06', type: 'scene', title: '作案动机',
    options: ['仇恨', '贪财', '情杀', '灭口', '意外', '自卫'],
    marker: { optionIndex: 4, markerNumber: 6 },
  },
]

export const mockEffectCard: EffectCard = {
  id: 'E01',
  name: '暗杀',
  effect: '目击者选择一名玩家，该玩家被杀害，失去破案权（无需公开身份）',
}

export function createMockGameState(overrides?: Partial<GameState>): GameState {
  return {
    phase: 'discussion-1',
    round: 1,
    players: mockPlayers,
    boards: mockBoards,
    myRole: 'detective',
    ...overrides,
  }
}
