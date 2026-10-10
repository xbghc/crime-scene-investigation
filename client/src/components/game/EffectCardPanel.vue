<script setup lang="ts">
import AppIcon from '../ui/AppIcon.vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type {
  EffectActionData,
  EffectCard,
  EffectResult,
  MurdererSelection,
  PendingEffect,
  Player,
  SceneBoard,
} from '../../types'

const props = withDefaults(
  defineProps<{
    card: EffectCard
    result?: EffectResult
    pendingEffect?: PendingEffect | null
    isWitness?: boolean
    players?: Player[]
    boards?: SceneBoard[]
    murdererSelection?: MurdererSelection
    submitting?: boolean
    error?: string | null
  }>(),
  {
    pendingEffect: null,
    isWitness: false,
    players: () => [],
    boards: () => [],
    submitting: false,
    error: null,
  },
)

const emit = defineEmits<{
  action: [payload: { effectId: string; data: EffectActionData }]
}>()

const selectedId = ref<string | null>(null)
const sent = ref(false)
let releaseTimer: ReturnType<typeof setTimeout> | undefined
const pending = computed(() =>
  props.isWitness && props.pendingEffect?.effectId === props.card.id ? props.pendingEffect : null,
)
const busy = computed(() => props.submitting || sent.value)
const resolved = computed(
  () =>
    !!props.result &&
    !props.result.requiresWitnessAction &&
    !!(props.result.applied || props.result.skipped || props.result.message),
)

const instructions = computed(() => {
  switch (pending.value?.effectId) {
    case 'E01':
      return '选择一名玩家暗杀。确认后，该玩家失去破案权。'
    case 'E03':
      return '选择一名玩家，向所有人公开排除其嫌疑。'
    case 'E05':
      return '选择一张场景板，移除该板上的选项物。'
    case 'E08':
      return '可以公开一张凶手所选的牌，也可以跳过。'
    default:
      return ''
  }
})

// The server's eligible IDs are authoritative. Never reconstruct eligibility from roles.
const choices = computed(() => {
  const action = pending.value
  if (!action) return []
  if (action.effectId === 'E01' || action.effectId === 'E03') {
    return (action.targetIds ?? []).flatMap((id) => {
      const player = props.players.find((entry) => entry.id === id)
      return player ? [{ id, name: player.nickname, detail: '玩家' }] : []
    })
  }
  if (action.effectId === 'E05') {
    return (action.boardIds ?? []).flatMap((id) => {
      const board = props.boards.find((entry) => entry.id === id)
      if (!board) return []
      const marker = board.marker
      const detail = marker
        ? `编号 ${marker.markerNumber} · ${board.options[marker.optionIndex] ?? '已放置选项物'}`
        : '场景板'
      return [{ id, name: board.title, detail }]
    })
  }
  if (action.effectId === 'E08') {
    const solution = props.murdererSelection
    return (action.cardIds ?? []).flatMap((id) => {
      if (solution?.meansCard.id === id) {
        return [{ id, name: solution.meansCard.name, detail: '手段牌' }]
      }
      if (solution?.clueCard.id === id) {
        return [{ id, name: solution.clueCard.name, detail: '线索牌' }]
      }
      return []
    })
  }
  return []
})

const selected = computed(() => choices.value.find((choice) => choice.id === selectedId.value))
const pointedCard = computed(() => {
  const id = props.result?.pointedCardId
  if (!id) return null
  // Only public player cards or the explicit public result may identify a revealed card.
  for (const player of props.players) {
    const means = player.meansCards.find((card) => card.id === id)
    if (means) return { name: means.name, category: '手段牌' }
    const clue = player.clueCards.find((card) => card.id === id)
    if (clue) return { name: clue.name, category: '线索牌' }
  }
  return props.result?.pointedCardName
    ? {
        name: props.result.pointedCardName,
        category: props.result.pointedCardType === 'means' ? '手段牌' : '线索牌',
      }
    : null
})
const resultMessage = computed(() => {
  if (props.result?.message) return props.result.message
  if (props.result?.skipped) return '目击者选择跳过本次效果。'
  if (props.result?.victimName) return `${props.result.victimName} 被暗杀，失去破案权。`
  const target = props.players.find((player) => player.id === props.result?.targetId)
  if (props.result?.applied && target) {
    return props.card.id === 'E01'
      ? `${target.nickname} 被暗杀，失去破案权。`
      : `${target.nickname} 已被排除嫌疑。`
  }
  if (props.result?.applied && props.result.boardId) {
    const board = props.boards.find((entry) => entry.id === props.result?.boardId)
    return board ? `已移除「${board.title}」上的选项物。` : '已移除一张场景板上的选项物。'
  }
  return props.result?.applied ? '效果已生效。' : ''
})

function releaseSubmission() {
  clearTimeout(releaseTimer)
  sent.value = false
}

watch(
  () => props.pendingEffect,
  () => {
    releaseSubmission()
    // A refresh may replace this object without changing the available choice.
    if (!choices.value.some((choice) => choice.id === selectedId.value)) selectedId.value = null
  },
)
watch(
  () => [props.submitting, props.error] as const,
  ([submitting]) => {
    if (!submitting) releaseSubmission()
  },
)
watch(choices, (available) => {
  if (!available.some((choice) => choice.id === selectedId.value)) selectedId.value = null
})
onBeforeUnmount(releaseSubmission)

function submit(skip = false) {
  const action = pending.value
  if (!action || busy.value || (skip ? !action.optional : !selected.value)) return
  let data: EffectActionData
  if (skip) data = { skip: true }
  else if (action.effectId === 'E05') data = { boardId: selectedId.value! }
  else if (action.effectId === 'E08') data = { cardId: selectedId.value! }
  else data = { targetId: selectedId.value! }
  sent.value = true
  // A missing response must never leave a permanent disabled control.
  releaseTimer = setTimeout(releaseSubmission, 8000)
  emit('action', { effectId: action.effectId, data })
}
</script>

<template>
  <section class="effect-panel" aria-label="效果牌">
    <header class="effect-panel__header">
      <AppIcon name="auto_awesome" class="app-icon effect-panel__icon" aria-hidden="true" />
      <div>
        <p class="effect-panel__eyebrow">效果牌</p>
        <h3 class="effect-panel__title">{{ card.name }}</h3>
      </div>
      <span v-if="pending" class="effect-panel__badge">{{
        pending.optional ? '可跳过' : '需处理'
      }}</span>
      <span v-else-if="resolved" class="effect-panel__badge">{{
        result?.skipped ? '已跳过' : result?.applied ? '已生效' : '已结束'
      }}</span>
    </header>
    <p class="effect-panel__description">{{ card.effect }}</p>

    <div
      v-if="resultMessage || pointedCard"
      class="effect-panel__result"
      data-testid="effect-result"
      role="status"
    >
      <p v-if="resultMessage">{{ resultMessage }}</p>
      <p v-if="pointedCard" class="effect-panel__reveal">
        已公开{{ pointedCard.category }}：<strong>{{ pointedCard.name }}</strong>
      </p>
    </div>

    <div v-if="pending" class="effect-panel__action" data-testid="effect-action" :aria-busy="busy">
      <p class="effect-panel__private">
        <AppIcon name="lock" class="app-icon" aria-hidden="true" />
        仅你可见 · 目击者操作
      </p>
      <fieldset class="effect-panel__fieldset" :disabled="busy">
        <legend class="effect-panel__instruction">{{ instructions }}</legend>
        <div class="effect-panel__choices">
          <button
            v-for="choice in choices"
            :key="choice.id"
            type="button"
            class="effect-panel__choice"
            :class="{ 'effect-panel__choice--selected': selectedId === choice.id }"
            :aria-pressed="selectedId === choice.id"
            data-testid="effect-choice"
            :data-choice-id="choice.id"
            @click="selectedId = choice.id"
          >
            <span class="effect-panel__choice-name">{{ choice.name }}</span>
            <span class="effect-panel__choice-detail">{{ choice.detail }}</span>
          </button>
        </div>
      </fieldset>
      <p v-if="!choices.length" class="effect-panel__hint" role="status">
        选项正在同步，请等待恢复后重试。
      </p>
      <p v-if="selected" class="effect-panel__selection" aria-live="polite">
        已选择：{{ selected.name }} · {{ selected.detail }}
      </p>
      <p v-if="error" class="effect-panel__error" role="alert">{{ error }}</p>
      <div class="effect-panel__buttons">
        <button
          type="button"
          class="effect-panel__button effect-panel__button--primary"
          data-testid="effect-confirm"
          :disabled="!selected || busy"
          @click="submit()"
        >
          {{ busy ? '提交中…' : error ? '重试确认' : '确认效果' }}
        </button>
        <button
          v-if="selected"
          type="button"
          class="effect-panel__button"
          data-testid="effect-cancel"
          :disabled="busy"
          @click="selectedId = null"
        >
          取消选择
        </button>
        <button
          v-if="pending.optional"
          type="button"
          class="effect-panel__button"
          data-testid="effect-skip"
          :disabled="busy"
          @click="submit(true)"
        >
          跳过本次效果
        </button>
      </div>
      <p class="effect-panel__hint">
        {{ pending.optional ? '确认或跳过后，继续调整场景板。' : '完成效果后，继续调整场景板。' }}
      </p>
    </div>
    <p v-else-if="result?.requiresWitnessAction" class="effect-panel__hint" role="status">
      等待目击者处理效果牌…
    </p>
  </section>
</template>

<style scoped>
.effect-panel {
  min-width: 0;
  padding: var(--space-6);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  background: var(--card);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  overflow-wrap: anywhere;
}
.effect-panel__header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.effect-panel__icon {
  color: var(--color-purple);
  font-size: 24px;
  flex-shrink: 0;
}
.effect-panel__eyebrow {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 12px;
  line-height: 16px;
  margin-bottom: var(--space-1);
}
.effect-panel__title {
  margin: 0;
  color: var(--color-text);
  font-size: 20px;
  font-weight: 600;
  line-height: 28px;
}
.effect-panel__badge {
  margin-left: auto;
  flex-shrink: 0;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-md);
  color: var(--color-text);
  background: var(--muted);
  font-size: 12px;
  border: 1px solid var(--border);
}
.effect-panel__description,
.effect-panel__hint {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 14px;
  line-height: 1.6;
}
.effect-panel__result {
  border-radius: var(--radius-md);
  padding: var(--space-4);
  background: var(--bg-primary);
  color: var(--color-text);
  font-size: 14px;
  border: 1px solid var(--border);
}
.effect-panel__result p {
  margin: 0;
}
.effect-panel__result p + p {
  margin-top: 6px;
}
.effect-panel__reveal {
  color: var(--color-amber-light);
}
.effect-panel__action {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  border-top: 1px solid var(--border-color);
  padding-top: var(--space-4);
}
.effect-panel__private {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  color: #90baff;
  font-size: 0.75rem;
}
.effect-panel__private .app-icon {
  font-size: 16px;
}
.effect-panel__fieldset {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}
.effect-panel__instruction {
  padding: 0;
  margin-bottom: 12px;
  color: var(--color-text);
  font-size: 0.875rem;
}
.effect-panel__choices {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.effect-panel__choice {
  min-width: 0;
  min-height: 64px;
  padding: var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-1);
  background: var(--bg-primary);
  text-align: left;
}
.effect-panel__choice--selected {
  border-color: var(--color-amber);
  background: rgba(212, 168, 71, 0.12);
}
.effect-panel__choice-name {
  color: var(--color-text);
  font-weight: 600;
  font-size: 14px;
}
.effect-panel__choice-detail {
  color: var(--color-text-muted);
  font-size: 0.75rem;
}
.effect-panel__selection {
  margin: 0;
  color: var(--color-amber-light);
  font-size: 14px;
}
.effect-panel__error {
  margin: 0;
  padding: var(--space-3);
  border-radius: 6px;
  background: rgba(211, 47, 47, 0.15);
  color: #ffb7b7;
  font-size: 14px;
}
.effect-panel__buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.effect-panel__button {
  flex: 1 1 120px;
  min-height: 44px;
  padding: var(--space-3);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-card);
  font-size: 14px;
  font-weight: 500;
}
.effect-panel__button--primary {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--primary-foreground);
}
.effect-panel button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.effect-panel button:focus-visible {
  outline: 3px solid var(--ring);
  outline-offset: 3px;
}

.effect-panel__choice:hover:not(:disabled) {
  border-color: var(--color-text-muted);
}
@media (max-width: 600px) {
  .effect-panel {
    padding: var(--space-4);
  }
}
</style>
