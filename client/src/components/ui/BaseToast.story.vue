<script setup lang="ts">
import { ref } from 'vue'
import BaseToast from './BaseToast.vue'
import BaseButton from './BaseButton.vue'

const showInfo = ref(false)
const showSuccess = ref(false)
const showError = ref(false)
</script>

<template>
  <Story title="基础提示" group="ui">
    <Variant title="Info">
      <BaseButton variant="secondary" @click="showInfo = true">显示信息提示</BaseButton>
      <BaseToast
        v-if="showInfo"
        message="这是一条普通提示信息"
        type="info"
        @dismiss="showInfo = false"
      />
    </Variant>
    <Variant title="Success">
      <BaseButton variant="secondary" @click="showSuccess = true">显示成功提示</BaseButton>
      <BaseToast
        v-if="showSuccess"
        message="操作成功完成！"
        type="success"
        @dismiss="showSuccess = false"
      />
    </Variant>
    <Variant title="Error">
      <BaseButton variant="secondary" @click="showError = true">显示错误提示</BaseButton>
      <BaseToast
        v-if="showError"
        message="操作失败，请重试"
        type="error"
        @dismiss="showError = false"
      />
    </Variant>
  </Story>
</template>
