import type { Player, MeansCard, ClueCard, EffectCard, SceneBoard, GameState } from '../types'

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
  { id: 'M001', name: '刀' },
  { id: 'M002', name: '毒药' },
  { id: 'M003', name: '绳索' },
  { id: 'M004', name: '手枪' },
]

export const mockClueCards: ClueCard[] = [
  { id: 'C001', name: '血迹' },
  { id: 'C002', name: '指纹' },
  { id: 'C003', name: '脚印' },
  { id: 'C004', name: '烟蒂' },
]

export const mockPlayers: Player[] = [
  {
    id: 'p1',
    nickname: '小明',
    color: PLAYER_COLORS[0]!,
    isHost: true,
    role: 'witness',
    status: 'alive',
    hasSolveRight: false,
    meansCards: [],
    clueCards: [],
  },
  {
    id: 'p2',
    nickname: '小红',
    color: PLAYER_COLORS[1]!,
    isHost: false,
    role: 'murderer',
    status: 'alive',
    hasSolveRight: true,
    meansCards: [
      { id: 'M001', name: '刀' },
      { id: 'M005', name: '斧头' },
      { id: 'M006', name: '锤子' },
      { id: 'M007', name: '枕头' },
    ],
    clueCards: [
      { id: 'C001', name: '血迹' },
      { id: 'C005', name: '纽扣' },
      { id: 'C006', name: '布料碎片' },
      { id: 'C007', name: '手套' },
    ],
  },
  {
    id: 'p3',
    nickname: '小刚',
    color: PLAYER_COLORS[2]!,
    isHost: false,
    role: 'accomplice',
    status: 'alive',
    hasSolveRight: true,
    meansCards: [
      { id: 'M008', name: '针筒' },
      { id: 'M009', name: '电击器' },
      { id: 'M010', name: '剪刀' },
      { id: 'M011', name: '砖块' },
    ],
    clueCards: [
      { id: 'C008', name: '头发' },
      { id: 'C009', name: '口红印' },
      { id: 'C010', name: '钥匙' },
      { id: 'C011', name: '手机' },
    ],
  },
  {
    id: 'p4',
    nickname: '小花',
    color: PLAYER_COLORS[3]!,
    isHost: false,
    role: 'detective',
    status: 'alive',
    hasSolveRight: true,
    meansCards: [
      { id: 'M012', name: '铁管' },
      { id: 'M013', name: '棒球棍' },
      { id: 'M014', name: '石头' },
      { id: 'M015', name: '玻璃碎片' },
    ],
    clueCards: [
      { id: 'C012', name: '照片' },
      { id: 'C013', name: '信件' },
      { id: 'C014', name: '日记本' },
      { id: 'C015', name: '处方签' },
    ],
  },
  {
    id: 'p5',
    nickname: '阿强',
    color: PLAYER_COLORS[4]!,
    isHost: false,
    role: 'detective',
    status: 'alive',
    hasSolveRight: true,
    meansCards: [
      { id: 'M016', name: '螺丝刀' },
      { id: 'M017', name: '扳手' },
      { id: 'M018', name: '钢琴线' },
      { id: 'M019', name: '弓箭' },
    ],
    clueCards: [
      { id: 'C016', name: '车票' },
      { id: 'C017', name: '收据' },
      { id: 'C018', name: '名片' },
      { id: 'C019', name: '门卡' },
    ],
  },
  {
    id: 'p6',
    nickname: '小美',
    color: PLAYER_COLORS[5]!,
    isHost: false,
    role: 'detective',
    status: 'dead',
    hasSolveRight: false,
    meansCards: [
      { id: 'M020', name: '高尔夫球杆' },
      { id: 'M021', name: '花瓶' },
      { id: 'M022', name: '灭火器' },
      { id: 'M023', name: '平底锅' },
    ],
    clueCards: [
      { id: 'C020', name: '香水味' },
      { id: 'C021', name: '汗味' },
      { id: 'C022', name: '泥土' },
      { id: 'C023', name: '花粉' },
    ],
  },
  {
    id: 'p7',
    nickname: '大壮',
    color: PLAYER_COLORS[6]!,
    isHost: false,
    role: 'detective',
    status: 'alive',
    hasSolveRight: false,
    meansCards: [
      { id: 'M024', name: '菜刀' },
      { id: 'M025', name: '冰锥' },
      { id: 'M026', name: '电锯' },
      { id: 'M027', name: '铁链' },
    ],
    clueCards: [
      { id: 'C024', name: '火柴' },
      { id: 'C025', name: '打火机' },
      { id: 'C026', name: '蜡烛' },
      { id: 'C027', name: '纸巾' },
    ],
  },
]

export const mockBoards: SceneBoard[] = [
  {
    id: 'B01',
    type: 'cause',
    title: '死亡原因',
    options: ['窒息', '失血', '中毒', '重击', '烧伤', '溺亡'],
    marker: { optionIndex: 1, markerNumber: 1 },
  },
  {
    id: 'B02',
    type: 'location',
    title: '案发地点A',
    options: ['卧室', '浴室', '客厅', '厨房', '后院', '车库'],
    marker: { optionIndex: 3, markerNumber: 2 },
  },
  {
    id: 'B03',
    type: 'scene',
    title: '作案时间',
    options: ['凌晨', '清晨', '上午', '下午', '傍晚', '深夜'],
    marker: { optionIndex: 5, markerNumber: 3 },
  },
  {
    id: 'B04',
    type: 'scene',
    title: '凶手体型',
    options: ['高大', '矮小', '健壮', '瘦弱', '普通身材', '肥胖'],
    marker: { optionIndex: 2, markerNumber: 4 },
  },
  {
    id: 'B05',
    type: 'scene',
    title: '遗留痕迹',
    options: ['脚印', '指纹', '血迹', '毛发', '气味', '划痕'],
    marker: { optionIndex: 0, markerNumber: 5 },
  },
  {
    id: 'B06',
    type: 'scene',
    title: '作案动机',
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
