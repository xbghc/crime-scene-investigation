import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, reactive, type App } from 'vue'
import EffectCardPanel from '../EffectCardPanel.vue'
import type { MurdererSelection, Player, SceneBoard } from '../../../types'

let app: App | undefined
let container: HTMLDivElement | undefined
const players: Player[] = [
  {
    id: 'p1',
    nickname: '小红',
    color: '#f00',
    isHost: false,
    status: 'alive',
    hasSolveRight: true,
    meansCards: [{ id: 'M001', name: '刀' }],
    clueCards: [{ id: 'C001', name: '血迹' }],
  },
  {
    id: 'p2',
    nickname: '小花',
    color: '#0f0',
    isHost: false,
    status: 'alive',
    hasSolveRight: true,
    meansCards: [],
    clueCards: [],
  },
]
const boards: SceneBoard[] = [
  {
    id: 'B-CAUSE',
    type: 'cause',
    title: '死亡原因',
    options: ['失血'],
    marker: { markerNumber: 1, optionIndex: 0 },
  },
  {
    id: 'B-SCENE',
    type: 'scene',
    title: '现场痕迹',
    options: ['打斗'],
    marker: { markerNumber: 3, optionIndex: 0 },
  },
]
const solution: MurdererSelection = {
  meansCard: { id: 'M001', name: '刀' },
  clueCard: { id: 'C001', name: '血迹' },
}

afterEach(() => {
  app?.unmount()
  container?.remove()
  vi.useRealTimers()
})

async function mountPanel(overrides: Partial<InstanceType<typeof EffectCardPanel>['$props']> = {}) {
  const onAction = vi.fn()
  const props = reactive({
    card: { id: 'E01', name: '暗杀', effect: '选择一名玩家暗杀' },
    players,
    boards,
    isWitness: true,
    pendingEffect: { effectId: 'E01', targetIds: ['p2'], optional: false },
    submitting: false,
    error: null,
    onAction,
    ...overrides,
  })
  container = document.createElement('div')
  document.body.append(container)
  app = createApp({ render: () => h(EffectCardPanel, props) })
  app.mount(container)
  await nextTick()
  return { props, onAction }
}

function button(testId: string) {
  return container!.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)!
}
async function choose(id: string) {
  container!.querySelector<HTMLButtonElement>(`[data-choice-id="${id}"]`)!.click()
  await nextTick()
}

describe('interactive effect controls', () => {
  it.each(['E01', 'E03'])(
    'uses only server targets for %s, with named accessible choices and safe repeated submit',
    async (effectId) => {
      const { onAction } = await mountPanel({
        card: { id: effectId, name: '测试效果', effect: '选择玩家' },
        pendingEffect: { effectId, targetIds: ['p2'], optional: false },
      })
      expect(container!.querySelectorAll('[data-testid="effect-choice"]')).toHaveLength(1)
      expect(button('effect-choice').textContent).toContain('小花')
      expect(button('effect-confirm').disabled).toBe(true)
      await choose('p2')
      expect(button('effect-choice').getAttribute('aria-pressed')).toBe('true')
      button('effect-confirm').click()
      button('effect-confirm').click()
      expect(onAction).toHaveBeenCalledTimes(1)
      expect(onAction).toHaveBeenCalledWith({ effectId, data: { targetId: 'p2' } })
      expect(container!.querySelector('[data-testid="effect-skip"]')).toBeNull()
    },
  )

  it('cancels a selection without consuming or skipping the effect', async () => {
    const { onAction } = await mountPanel()
    await choose('p2')
    button('effect-cancel').click()
    await nextTick()
    expect(button('effect-confirm').disabled).toBe(true)
    expect(button('effect-choice').getAttribute('aria-pressed')).toBe('false')
    expect(onAction).not.toHaveBeenCalled()
    await choose('p2')
    expect(button('effect-confirm').disabled).toBe(false)
  })

  it('shows marked-board name, option, and marker for E05 and emits the board ID', async () => {
    const { onAction } = await mountPanel({
      card: { id: 'E05', name: '证据遗失', effect: '移除选项物' },
      pendingEffect: { effectId: 'E05', boardIds: ['B-SCENE'], optional: false },
    })
    expect(button('effect-choice').textContent).toContain('现场痕迹')
    expect(button('effect-choice').textContent).toContain('编号 3 · 打斗')
    await choose('B-SCENE')
    button('effect-confirm').click()
    expect(onAction).toHaveBeenCalledWith({ effectId: 'E05', data: { boardId: 'B-SCENE' } })
  })

  it('labels both solution categories for E08 and reveals only the chosen card on submit', async () => {
    const { onAction } = await mountPanel({
      card: { id: 'E08', name: '信息泄露', effect: '公开一张牌' },
      pendingEffect: { effectId: 'E08', cardIds: ['M001', 'C001'], optional: true },
      murdererSelection: solution,
    })
    expect(container!.textContent).toContain('手段牌')
    expect(container!.textContent).toContain('线索牌')
    await choose('C001')
    button('effect-confirm').click()
    expect(onAction).toHaveBeenCalledWith({ effectId: 'E08', data: { cardId: 'C001' } })
  })

  it('explicitly skips E08 without requiring or sending a card selection', async () => {
    const { onAction } = await mountPanel({
      card: { id: 'E08', name: '信息泄露', effect: '公开一张牌' },
      pendingEffect: { effectId: 'E08', cardIds: ['M001'], optional: true },
      murdererSelection: solution,
    })
    button('effect-skip').click()
    expect(onAction).toHaveBeenCalledWith({ effectId: 'E08', data: { skip: true } })
  })

  it('keeps selected choice on rejection and allows retry', async () => {
    const { props, onAction } = await mountPanel()
    await choose('p2')
    button('effect-confirm').click()
    props.submitting = true
    await nextTick()
    expect(button('effect-confirm').disabled).toBe(true)
    props.submitting = false
    props.error = '服务器拒绝，请重试'
    await nextTick()
    expect(container!.querySelector('[role="alert"]')!.textContent).toContain('请重试')
    expect(button('effect-confirm').disabled).toBe(false)
    button('effect-confirm').click()
    expect(onAction).toHaveBeenCalledTimes(2)
  })

  it('releases the local duplicate-submit guard if no parent response arrives', async () => {
    vi.useFakeTimers()
    const { onAction } = await mountPanel()
    await choose('p2')
    button('effect-confirm').click()
    await nextTick()
    vi.advanceTimersByTime(8000)
    await nextTick()
    expect(button('effect-confirm').disabled).toBe(false)
    button('effect-confirm').click()
    expect(onAction).toHaveBeenCalledTimes(2)
  })

  it('drops an invalid selection after reconnect updates eligible IDs', async () => {
    const { props } = await mountPanel()
    await choose('p2')
    props.pendingEffect = { effectId: 'E01', targetIds: ['p1'], optional: false }
    await nextTick()
    expect(button('effect-confirm').disabled).toBe(true)
    expect(container!.textContent).not.toContain('已选择')
  })

  it('never renders private controls or solution cards for non-witnesses', async () => {
    await mountPanel({
      isWitness: false,
      card: { id: 'E08', name: '信息泄露', effect: '公开一张牌' },
      pendingEffect: { effectId: 'E08', cardIds: ['M001', 'C001'], optional: true },
      murdererSelection: solution,
    })
    expect(container!.querySelector('[data-testid="effect-action"]')).toBeNull()
    expect(container!.textContent).not.toContain('血迹')
    expect(container!.textContent).not.toContain('刀')
    expect(container!.textContent).not.toContain('仅你可见')
  })

  it('renders persisted public E08 card name/category without any private selection', async () => {
    await mountPanel({
      isWitness: false,
      pendingEffect: null,
      card: { id: 'E08', name: '信息泄露', effect: '公开一张牌' },
      result: { applied: true, pointedCardId: 'M001' },
    })
    const result = container!.querySelector('[data-testid="effect-result"]')!
    expect(result.textContent).toContain('已公开手段牌：刀')
    expect(result.textContent).not.toContain('血迹')
    expect(container!.querySelector('[data-testid="effect-action"]')).toBeNull()
  })
  it('shows the ended no-target E05 outcome without waiting or action controls', async () => {
    await mountPanel({
      pendingEffect: null,
      card: { id: 'E05', name: '证据遗失', effect: '移除选项物' },
      result: { applied: false, message: '没有可移除的选项物，此效果已结束' },
    })
    expect(container!.textContent).toContain('此效果已结束')
    expect(container!.querySelector('.effect-panel__badge')?.textContent).toBe('已结束')
    expect(container!.textContent).not.toContain('等待目击者')
    expect(container!.querySelector('[data-testid="effect-action"]')).toBeNull()
  })

  it('shows a public waiting status only while the server requires a witness action', async () => {
    await mountPanel({
      isWitness: false,
      pendingEffect: null,
      result: { applied: false, requiresWitnessAction: true },
    })
    expect(container!.textContent).toContain('等待目击者处理效果牌')
  })
})
