<script setup lang="ts">
import { computed } from 'vue'
import { useI18nStore } from './stores/i18n'

const i18n = useI18nStore()
const langValue = computed({
  get: () => i18n.lang,
  set: (v) => i18n.setLang(v),
})
</script>

<template>
  <a-layout class="app-layout">
    <a-layout-header class="app-header">
      <div class="brand">
        <span class="brand-title">{{ i18n.t.appTitle }}</span>
      </div>

      <a-segmented
        v-model:value="langValue"
        :options="[
          { label: '中文', value: 'zh' },
          { label: 'English', value: 'en' },
        ]"
      />
    </a-layout-header>

    <a-layout-content class="app-content">
      <router-view />
    </a-layout-content>
  </a-layout>
</template>

<style scoped>
.app-layout {
  min-height: 100vh;
}
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-inline: 20px;
}
.brand-title {
  font-weight: 600;
  color: #fff;
}
.app-content {
  padding: 20px;
}
</style>
