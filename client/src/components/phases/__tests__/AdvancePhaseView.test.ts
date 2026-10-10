import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick, reactive, type App } from 'vue'
import AdvancePhaseView from '../AdvancePhaseView.vue'

let app: App | undefined
let container: HTMLDivElement | undefined

afterEach(() => {
  app?.unmount()
  container?.remove()
})

async function mountAdvance(accomplicePrompted: boolean) {
  const props = reactive({
    boards: [],
    newBoards: [],
    isWitness: false,
    isAccomplice: true,
    isAdvance1: true,
    accomplicePrompted,
  })
  container = document.createElement('div')
  document.body.append(container)
  app = createApp({ render: () => h(AdvancePhaseView, props) })
  app.mount(container)
  await nextTick()
  return props
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
