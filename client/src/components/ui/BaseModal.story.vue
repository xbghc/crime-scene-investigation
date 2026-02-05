<script setup lang="ts">
import { ref } from 'vue'
import BaseModal from './BaseModal.vue'
import BaseButton from './BaseButton.vue'

const showModal = ref(false)
const showModalWithFooter = ref(false)
</script>

<template>
  <Story title="ui/BaseModal" group="ui">
    <Variant title="Basic">
      <BaseButton @click="showModal = true">打开弹窗</BaseButton>
      <BaseModal v-model="showModal" title="提示信息">
        <p>这是一个基本的弹窗内容。点击遮罩层或关闭按钮可以关闭。</p>
      </BaseModal>
    </Variant>
    <Variant title="With Footer">
      <BaseButton @click="showModalWithFooter = true">带底栏弹窗</BaseButton>
      <BaseModal v-model="showModalWithFooter" title="确认操作">
        <p>你确定要执行这个操作吗？</p>
        <template #footer>
          <BaseButton variant="ghost" @click="showModalWithFooter = false">取消</BaseButton>
          <BaseButton @click="showModalWithFooter = false">确认</BaseButton>
        </template>
      </BaseModal>
    </Variant>
  </Story>
</template>
