import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, reactive, type App } from 'vue'
import AdvancePhaseView from '../AdvancePhaseView.vue'
import type { SceneBoard } from '../../../types'

let app: App | undefined
let container: HTMLDivElement | undefined

afterEach(() => {
  app?.unmount()
  container?.remove()
})

async function mountAdvance(
  accomplicePrompted: boolean,
  overrides: Partial<InstanceType<typeof AdvancePhaseView>['$props']> = {},
) {
  const props = reactive({
    boards: [] as SceneBoard[],
    newBoards: [] as SceneBoard[],
    isWitness: false,
    isAccomplice: true,
    isAdvance1: true,
    advanceReady: false,
    accomplicePrompted,
    ...overrides,
  })
  container = document.createElement('div')
  document.body.append(container)
  app = createApp({ render: () => h(AdvancePhaseView, props) })
  app.mount(container)
  await nextTick()
  return props
}

function findContinue() {
  return [...container!.querySelectorAll<HTMLButtonElement>('button')].find(
    (button) => button.textContent?.trim() === '继续',
  )
}

function makeBoard(id: string): SceneBoard {
  return { id, type: 'scene', title: '测试场景板', options: ['选项A', '选项B'] }
}

describe('Advance-phase reconnect', () => {
  it('does not offer the accomplice choice again after it was completed on the server', async () => {
    await mountAdvance(false)
    expect(container!.textContent).not.toContain('是否更换凶手的线索牌')
    expect(container!.textContent).toContain('目击者正在调整线索')
  })

  it('restores a still-pending accomplice choice from an authoritative refresh', async () => {
    const props = await mountAdvance(false)
    props.accomplicePrompted = true
    await nextTick()
    expect(container!.textContent).toContain('是否更换凶手的线索牌')
    container!.querySelector<HTMLButtonElement>('button')!.click()
    await nextTick()
    expect(container!.textContent).not.toContain('是否更换凶手的线索牌')
    props.accomplicePrompted = false
    await nextTick()
    props.accomplicePrompted = true
    await nextTick()
    expect(container!.textContent).toContain('是否更换凶手的线索牌')
  })
})

describe('Witness advance readiness', () => {
  it('waits for the accomplice and effects instead of treating no boards as completion', async () => {
    const onFinish = vi.fn()
    await mountAdvance(false, {
      isWitness: true,
      isAccomplice: false,
      'onWitness-finish-advance': onFinish,
    })

    expect(container!.textContent).toContain('请等待推进阶段准备完成')
    expect(container!.textContent).not.toContain('推进阶段完成')
    expect(findContinue()).toBeUndefined()
    expect(onFinish).not.toHaveBeenCalled()
  })

  it.each([1, 2])(
    'allows Continue only after all %i replacements and server readiness',
    async (count) => {
      const onFinish = vi.fn()
      const props = await mountAdvance(false, {
        isWitness: true,
        isAccomplice: false,
        boards: [makeBoard('old-1'), makeBoard('old-2')],
        newBoards: Array.from({ length: count }, (_, i) => makeBoard(`new-${i}`)),
        'onWitness-finish-advance': onFinish,
      })

      for (let remaining = count; remaining > 0; remaining--) {
        expect(findContinue()).toBeUndefined()
        expect(container!.textContent).toContain('选择替换的场景板')
        props.newBoards = props.newBoards.slice(1)
        await nextTick()
      }

      // Even the final board acknowledgement must not infer server readiness.
      expect(findContinue()).toBeUndefined()
      props.advanceReady = true
      await nextTick()
      expect(findContinue()).toBeDefined()
      findContinue()!.click()
      expect(onFinish).toHaveBeenCalledTimes(1)
    },
  )

  it('keeps pending replacements visible even if readiness arrives first', async () => {
    const props = await mountAdvance(false, {
      isWitness: true,
      isAccomplice: false,
      newBoards: [makeBoard('pending')],
      advanceReady: true,
    })
    expect(findContinue()).toBeUndefined()
    expect(container!.textContent).toContain('选择替换的场景板')

    props.newBoards = []
    await nextTick()
    expect(findContinue()).toBeDefined()
  })

  it('restores Continue from a ready snapshot and hides it when readiness is reset', async () => {
    const props = await mountAdvance(false, {
      isWitness: true,
      isAccomplice: false,
      advanceReady: true,
    })
    expect(findContinue()).toBeDefined()

    props.advanceReady = false
    props.isAdvance1 = false
    await nextTick()
    expect(findContinue()).toBeUndefined()
    expect(container!.textContent).toContain('请等待推进阶段准备完成')
  })

  it('never offers Continue to another role', async () => {
    await mountAdvance(false, { isAccomplice: false, advanceReady: true })
    expect(findContinue()).toBeUndefined()
  })
})

describe('effect sequencing', () => {
  it.each(['E01', 'E03', 'E05', 'E08'])(
    'keeps %s ahead of board replacement and Continue',
    async (effectId) => {
      const props = await mountAdvance(false, {
        isWitness: true,
        isAccomplice: false,
        advanceReady: true,
        boards: [makeBoard('old')],
        newBoards: [makeBoard('new')],
        effectCard: { id: effectId, name: '待处理效果', effect: '处理效果' },
        pendingEffect: { effectId, targetIds: [], optional: effectId === 'E08' },
      })
      expect(container!.querySelector('[data-testid="effect-action"]')).not.toBeNull()
      expect(container!.textContent).not.toContain('选择替换的场景板')
      expect(findContinue()).toBeUndefined()
      props.pendingEffect = null
      await nextTick()
      expect(container!.textContent).toContain('选择替换的场景板')
      props.newBoards = []
      await nextTick()
      expect(findContinue()).toBeDefined()
    },
  )
})
