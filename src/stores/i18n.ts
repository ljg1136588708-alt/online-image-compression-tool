import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export type Lang = 'zh' | 'en'

const langData = {
  zh: {
    appTitle: '在线图片压缩 | Free Image Compressor',
    pageTitle: '在线图片压缩工具',
    uploadHint: '点击或拖拽图片到此处上传',
    uploadSub: 'JPG / PNG / WebP 通用',
    quality: '压缩质量',
    original: '原图预览',
    compressed: '压缩预览',
    originalSize: '原图大小',
    compressedSize: '压缩后',
    saved: '节省空间',
    rate: '压缩率',
    download: '下载压缩图片',
    errorUnsupported: '仅支持 JPG / PNG / WebP 格式图片',
    errorCompressFailed: '压缩失败，请重试',
    empty: '-',
  },
  en: {
    appTitle: 'Free Image Compressor',
    pageTitle: 'Free Image Compressor',
    uploadHint: 'Click or drop image here',
    uploadSub: 'JPG / PNG / WebP supported',
    quality: 'Quality',
    original: 'Original',
    compressed: 'Compressed',
    originalSize: 'Original Size',
    compressedSize: 'Compressed',
    saved: 'Saved',
    rate: 'Rate',
    download: 'Download Image',
    errorUnsupported: 'Only JPG / PNG / WebP images are supported',
    errorCompressFailed: 'Compress failed. Please try again.',
    empty: '-',
  },
} as const

export const useI18nStore = defineStore('i18n', () => {
  const lang = ref<Lang>('zh')
  const t = computed(() => langData[lang.value])

  function setLang(next: Lang) {
    lang.value = next
    document.documentElement.lang = next === 'zh' ? 'zh-CN' : 'en'
    document.title = t.value.appTitle
  }

  return { lang, t, setLang }
})

