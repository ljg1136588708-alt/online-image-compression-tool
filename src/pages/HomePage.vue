<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import type { UploadProps } from 'ant-design-vue'
import { useI18nStore } from '../stores/i18n'
import { formatBytes } from '../utils/format'
import { compressImageFile } from '../utils/imageCompress'

const i18n = useI18nStore()

const qualityPercent = ref<number>(80)
const originalFile = ref<File | null>(null)
const compressedBlob = ref<Blob | null>(null)
const isCompressing = ref(false)

const originalUrl = ref<string>('')
const compressedUrl = ref<string>('')

const originalSize = computed(() => originalFile.value?.size ?? 0)
const compressedSize = computed(() => compressedBlob.value?.size ?? 0)
const savedBytes = computed(() => Math.max(0, originalSize.value - compressedSize.value))
const ratePercent = computed(() => {
  if (!originalSize.value || !compressedSize.value) return null
  return Number(((savedBytes.value / originalSize.value) * 100).toFixed(1))
})

function revoke(url: string) {
  if (url) URL.revokeObjectURL(url)
}

async function doCompress() {
  if (!originalFile.value) return
  isCompressing.value = true
  try {
    const { blob } = await compressImageFile(originalFile.value, qualityPercent.value / 100)
    compressedBlob.value = blob
    revoke(compressedUrl.value)
    compressedUrl.value = URL.createObjectURL(blob)
  } catch (e) {
    message.error((e as Error).message || i18n.t.errorCompressFailed)
  } finally {
    isCompressing.value = false
  }
}

function setFile(file: File) {
  originalFile.value = file
  compressedBlob.value = null

  revoke(originalUrl.value)
  originalUrl.value = URL.createObjectURL(file)

  revoke(compressedUrl.value)
  compressedUrl.value = ''

  void doCompress()
}

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const allowedExts = new Set(['jpg', 'jpeg', 'png', 'webp'])

function isSupportedImage(file: File): boolean {
  if (file.type && allowedMimeTypes.has(file.type)) return true
  const name = file.name || ''
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : ''
  return allowedExts.has(ext)
}

const uploadProps: UploadProps = {
  multiple: false,
  showUploadList: false,
  accept: '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp',
  beforeUpload: (file) => {
    if (!isSupportedImage(file as File)) {
      message.error(i18n.t.errorUnsupported)
      return false
    }
    setFile(file as File)
    return false
  },
}

let compressTimer: number | null = null
watch(qualityPercent, () => {
  if (!originalFile.value) return
  if (compressTimer != null) window.clearTimeout(compressTimer)
  compressTimer = window.setTimeout(() => {
    void doCompress()
  }, 120)
})

function download() {
  if (!compressedBlob.value || !originalFile.value) return
  const a = document.createElement('a')
  const url = URL.createObjectURL(compressedBlob.value)

  const type = compressedBlob.value.type || originalFile.value.type
  const extFromType =
    type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : type === 'image/jpeg' ? 'jpg' : 'jpg'

  a.href = url
  a.download = `compress_${Date.now()}.${extFromType}`
  a.click()

  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

onMounted(() => {
  i18n.setLang(i18n.lang)
})

onBeforeUnmount(() => {
  if (compressTimer != null) window.clearTimeout(compressTimer)
  revoke(originalUrl.value)
  revoke(compressedUrl.value)
})
</script>

<template>
  <div class="page-container">
    <a-card :title="i18n.t.pageTitle" :bordered="false">
      <a-space direction="vertical" style="width: 100%" :size="16">
        <a-upload-dragger v-bind="uploadProps">
          <p class="ant-upload-drag-icon">
            <span style="font-size: 28px">+</span>
          </p>
          <p class="ant-upload-text">{{ i18n.t.uploadHint }}</p>
          <p class="ant-upload-hint">{{ i18n.t.uploadSub }}</p>
        </a-upload-dragger>

        <div>
          <div class="row-between">
            <span>{{ i18n.t.quality }}：{{ qualityPercent }}%</span>
          </div>
          <a-slider v-model:value="qualityPercent" :min="10" :max="100" />
        </div>

        <a-row :gutter="[16, 16]">
          <a-col :xs="24" :sm="12">
            <a-card size="small" :title="i18n.t.original">
              <a-spin :spinning="isCompressing" :delay="120">
                <template v-if="originalUrl">
                  <img class="preview-img" :src="originalUrl" alt="original" />
                </template>
                <template v-else>
                  <a-empty />
                </template>
              </a-spin>
            </a-card>
          </a-col>
          <a-col :xs="24" :sm="12">
            <a-card size="small" :title="i18n.t.compressed">
              <a-spin :spinning="isCompressing" :delay="120">
                <template v-if="compressedUrl">
                  <img class="preview-img" :src="compressedUrl" alt="compressed" />
                </template>
                <template v-else>
                  <a-empty />
                </template>
              </a-spin>
            </a-card>
          </a-col>
        </a-row>

        <a-descriptions bordered size="small" :column="2">
          <a-descriptions-item :label="i18n.t.originalSize">
            {{ originalFile ? formatBytes(originalSize) : i18n.t.empty }}
          </a-descriptions-item>
          <a-descriptions-item :label="i18n.t.compressedSize">
            {{ compressedBlob ? formatBytes(compressedSize) : i18n.t.empty }}
          </a-descriptions-item>
          <a-descriptions-item :label="i18n.t.saved">
            {{ compressedBlob ? formatBytes(savedBytes) : i18n.t.empty }}
          </a-descriptions-item>
          <a-descriptions-item :label="i18n.t.rate">
            {{ ratePercent == null ? i18n.t.empty : `${ratePercent}%` }}
          </a-descriptions-item>
        </a-descriptions>

        <a-button
          type="primary"
          block
          :loading="isCompressing"
          :disabled="!compressedBlob || isCompressing"
          @click="download"
        >
          {{ i18n.t.download }}
        </a-button>
      </a-space>
    </a-card>
  </div>
</template>

<style scoped>
.row-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.preview-img {
  width: 100%;
  display: block;
  border-radius: 8px;
}
</style>

