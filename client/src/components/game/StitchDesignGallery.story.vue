<script setup lang="ts">
import {
  getMeansCardImage,
  getClueCardImage,
  getEffectCardImage,
  getBoardImageByFile,
} from '../../types/stitch-cards'

// 手段卡名称（取前 20 张展示）
const meansCards = [
  { id: 'M001', name: '刀' }, { id: 'M002', name: '斧头' }, { id: 'M003', name: '锤子' },
  { id: 'M004', name: '绳索' }, { id: 'M005', name: '枕头' }, { id: 'M006', name: '毒药' },
  { id: 'M007', name: '针筒' }, { id: 'M008', name: '手枪' }, { id: 'M009', name: '步枪' },
  { id: 'M010', name: '电击器' }, { id: 'M011', name: '剪刀' }, { id: 'M012', name: '砖块' },
  { id: 'M013', name: '铁管' }, { id: 'M014', name: '棒球棍' }, { id: 'M015', name: '石头' },
  { id: 'M016', name: '玻璃碎片' }, { id: 'M017', name: '螺丝刀' }, { id: 'M018', name: '扳手' },
  { id: 'M019', name: '钢琴线' }, { id: 'M020', name: '弓箭' },
]

// 线索卡名称（取前 20 张展示）
const clueCards = [
  { id: 'C001', name: '头发' }, { id: 'C002', name: '指纹' }, { id: 'C003', name: '脚印' },
  { id: 'C004', name: '血迹' }, { id: 'C005', name: '纽扣' }, { id: 'C006', name: '布料碎片' },
  { id: 'C007', name: '烟蒂' }, { id: 'C008', name: '口红印' }, { id: 'C009', name: '手套' },
  { id: 'C010', name: '帽子' }, { id: 'C011', name: '眼镜' }, { id: 'C012', name: '耳环' },
  { id: 'C013', name: '戒指' }, { id: 'C014', name: '项链' }, { id: 'C015', name: '手表' },
  { id: 'C016', name: '钥匙' }, { id: 'C017', name: '钱包' }, { id: 'C018', name: '手机' },
  { id: 'C019', name: '照片' }, { id: 'C020', name: '信件' },
]

// 效果卡
const effectCards = [
  { id: 'E01', name: '暗杀' }, { id: 'E02', name: '意外死亡' }, { id: 'E03', name: '排除嫌疑' },
  { id: 'E04', name: '关键线索' }, { id: 'E05', name: '证据遗失' }, { id: 'E06', name: '目击者笔录' },
  { id: 'E07', name: '停电' }, { id: 'E08', name: '信息泄露' }, { id: 'E09', name: '混乱现场' },
  { id: 'E10', name: '案中案' },
]

// 场景板
const sceneBoards = [
  { file: 'board-cause-death.png', name: '死亡原因' },
  { file: 'board-location-a.png', name: '案发地点A' },
  { file: 'board-location-b.png', name: '案发地点B' },
  { file: 'board-location-c.png', name: '案发地点C' },
  { file: 'board-location-d.png', name: '案发地点D' },
  { file: 'board-location-e.png', name: '案发地点E' },
  { file: 'board-location-f.png', name: '案发地点F' },
  { file: 'board-location-g.png', name: '案发地点G' },
  { file: 'board-location-h.png', name: '案发地点H' },
  { file: 'board-time.png', name: '作案时间' },
  { file: 'board-weather.png', name: '天气状况' },
  { file: 'board-witness.png', name: '目击情况' },
  { file: 'board-body-type.png', name: '凶手体型' },
  { file: 'board-gender.png', name: '凶手性别特征' },
  { file: 'board-traces.png', name: '遗留痕迹' },
  { file: 'board-relationship.png', name: '与被害人关系' },
  { file: 'board-motive.png', name: '作案动机' },
  { file: 'board-scene-state.png', name: '现场状态' },
  { file: 'board-culprit-state.png', name: '凶手状态' },
  { file: 'board-social-id.png', name: '社会身份' },
  { file: 'board-clothing.png', name: '凶手衣着' },
  { file: 'board-duration.png', name: '持续时间' },
  { file: 'board-struggle.png', name: '被害人挣扎' },
  { file: 'board-sound.png', name: '现场声音' },
  { file: 'board-escape.png', name: '逃离方式' },
  { file: 'board-key-item.png', name: '关键物品位置' },
  { file: 'board-season.png', name: '案发季节' },
  { file: 'board-victim-age.png', name: '被害人年龄' },
  { file: 'board-floor.png', name: '案发楼层' },
  { file: 'board-lighting.png', name: '现场光线' },
  { file: 'board-sudden-event.png', name: '突发事件' },
]
</script>

<template>
  <Story title="Stitch 设计预览" group="game" icon="lucide:image">
    <!-- 手段卡 -->
    <Variant title="手段卡 (红色主题)">
      <div class="gallery-container">
        <h2 class="gallery-title" style="color: #dc2626;">手段卡 Means Cards</h2>
        <p class="gallery-subtitle">共 90 张 · 展示前 20 张</p>
        <div class="card-grid">
          <div v-for="card in meansCards" :key="card.id" class="card-item">
            <img
              :src="getMeansCardImage(card.id)"
              :alt="card.name"
              class="card-img"
              loading="lazy"
            />
            <span class="card-label">{{ card.id }} {{ card.name }}</span>
          </div>
        </div>
      </div>
    </Variant>

    <!-- 线索卡 -->
    <Variant title="线索卡 (蓝色主题)">
      <div class="gallery-container">
        <h2 class="gallery-title" style="color: #3b82f6;">线索卡 Clue Cards</h2>
        <p class="gallery-subtitle">已生成 83/220 张 · 展示前 20 张</p>
        <div class="card-grid">
          <div v-for="card in clueCards" :key="card.id" class="card-item">
            <img
              :src="getClueCardImage(card.id)"
              :alt="card.name"
              class="card-img"
              loading="lazy"
            />
            <span class="card-label">{{ card.id }} {{ card.name }}</span>
          </div>
        </div>
      </div>
    </Variant>

    <!-- 效果卡 -->
    <Variant title="效果卡 (紫色主题)">
      <div class="gallery-container">
        <h2 class="gallery-title" style="color: #8b5cf6;">效果卡 Effect Cards</h2>
        <p class="gallery-subtitle">共 10 张 · 全部展示</p>
        <div class="card-grid">
          <div v-for="card in effectCards" :key="card.id" class="card-item">
            <img
              :src="getEffectCardImage(card.id)"
              :alt="card.name"
              class="card-img"
              loading="lazy"
            />
            <span class="card-label">{{ card.id }} {{ card.name }}</span>
          </div>
        </div>
      </div>
    </Variant>

    <!-- 场景板 -->
    <Variant title="场景板 (多色主题)">
      <div class="gallery-container">
        <h2 class="gallery-title" style="color: #d4a847;">场景板 Scene Boards</h2>
        <p class="gallery-subtitle">共 31 张 · 全部展示</p>
        <div class="board-grid">
          <div v-for="board in sceneBoards" :key="board.file" class="board-item">
            <img
              :src="getBoardImageByFile(board.file)"
              :alt="board.name"
              class="board-img"
              loading="lazy"
            />
            <span class="card-label">{{ board.name }}</span>
          </div>
        </div>
      </div>
    </Variant>

    <!-- 全部卡片一览 -->
    <Variant title="全部卡片一览">
      <div class="gallery-container">
        <h2 class="gallery-title" style="color: var(--color-text);">全部卡片设计总览</h2>

        <h3 class="section-title" style="color: #dc2626;">手段卡 (20/90)</h3>
        <div class="card-grid card-grid--small">
          <div v-for="card in meansCards" :key="card.id" class="card-item">
            <img :src="getMeansCardImage(card.id)" :alt="card.name" class="card-img" loading="lazy" />
          </div>
        </div>

        <h3 class="section-title" style="color: #3b82f6;">线索卡 (20/83)</h3>
        <div class="card-grid card-grid--small">
          <div v-for="card in clueCards" :key="card.id" class="card-item">
            <img :src="getClueCardImage(card.id)" :alt="card.name" class="card-img" loading="lazy" />
          </div>
        </div>

        <h3 class="section-title" style="color: #8b5cf6;">效果卡 (10/10)</h3>
        <div class="card-grid card-grid--small">
          <div v-for="card in effectCards" :key="card.id" class="card-item">
            <img :src="getEffectCardImage(card.id)" :alt="card.name" class="card-img" loading="lazy" />
          </div>
        </div>
      </div>
    </Variant>
  </Story>
</template>

<style scoped>
.gallery-container {
  padding: 24px;
  background: #0d1117;
  min-height: 100vh;
}

.gallery-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 4px;
}

.gallery-subtitle {
  color: #8b949e;
  font-size: 0.85rem;
  margin-bottom: 20px;
}

.section-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-top: 28px;
  margin-bottom: 12px;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 16px;
}

.card-grid--small {
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 10px;
}

.board-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.card-item,
.board-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.card-img {
  width: 100%;
  border-radius: 8px;
  border: 1px solid #30363d;
  transition: transform 0.2s, box-shadow 0.2s;
  background: #161b22;
}

.card-img:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  z-index: 10;
  position: relative;
}

.board-img {
  width: 100%;
  border-radius: 8px;
  border: 1px solid #30363d;
  transition: transform 0.2s, box-shadow 0.2s;
  background: #161b22;
}

.board-img:hover {
  transform: scale(1.03);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

.card-label {
  font-size: 0.75rem;
  color: #8b949e;
  text-align: center;
}
</style>
