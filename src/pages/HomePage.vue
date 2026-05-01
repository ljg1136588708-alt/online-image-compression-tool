<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import type { UploadProps } from 'ant-design-vue'
import { useI18nStore } from '../stores/i18n'
import { formatBytes } from '../utils/format'
import { compressImageFile } from '../utils/imageCompress'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

const i18n = useI18nStore()

const qualityPercent = ref<number>(80)
const originalFile = ref<File | null>(null)
const compressedBlob = ref<Blob | null>(null)
const isCompressing = ref(false)

const originalUrl = ref<string>('')
const compressedUrl = ref<string>('')

const originalSize = computed(() => originalFile.value?.size ?? 0)
const compressedSize = computed(() => compressedBlob.value?.size ?? 0)
const savedBytes = computed(() => originalSize.value - compressedSize.value)
const ratePercent = computed(() => {
  if (!originalSize.value || !compressedSize.value) return null
  return Number(((savedBytes.value / originalSize.value) * 100).toFixed(1))
})

// ---------------- Batch compress + ZIP ----------------
type BatchItem = {
  uid: string
  name: string
  status: 'processing' | 'done' | 'error'
  fileKey?: string
  originalSize?: number
  compressedSize?: number
  savedBytes?: number
  ratePercent?: number | null
  originalUrl?: string
  compressedUrl?: string
  blob?: Blob
  mimeType?: string
}

const batchItems = ref<BatchItem[]>([])
const isBatchWorking = ref(false)
const previewOpen = ref(false)
const previewItem = ref<BatchItem | null>(null)
const batchFilesInputEl = ref<HTMLInputElement | null>(null)
const batchFolderInputEl = ref<HTMLInputElement | null>(null)

function extFromMime(mimeType: string | undefined) {
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/webp') return 'webp'
  return 'jpg'
}

function revoke(url: string) {
  if (url) URL.revokeObjectURL(url)
}

function clearBatchUrls() {
  batchItems.value.forEach((it) => {
    if (it.originalUrl) revoke(it.originalUrl)
    if (it.compressedUrl) revoke(it.compressedUrl)
  })
}

function openPreview(item: BatchItem) {
  previewItem.value = item
  previewOpen.value = true
}

function closePreview() {
  previewOpen.value = false
  previewItem.value = null
}

function removeBatchItem(uid: string) {
  const idx = batchItems.value.findIndex((x) => x.uid === uid)
  if (idx < 0) return
  const it = batchItems.value[idx]
  if (it.originalUrl) revoke(it.originalUrl)
  if (it.compressedUrl) revoke(it.compressedUrl)

  // If current preview item removed, close modal
  if (previewItem.value?.uid === uid) closePreview()

  batchItems.value.splice(idx, 1)
}

function pickBatchFiles() {
  if (isBatchWorking.value) return
  batchFilesInputEl.value?.click()
}

function pickBatchFolder() {
  if (isBatchWorking.value) return
  batchFolderInputEl.value?.click()
}

async function startBatch(rawFiles: File[]) {
  if (isBatchWorking.value) return
  if (!rawFiles.length) return

  // Validate types
  const supportedFiles = rawFiles.filter((f) => isSupportedImage(f))
  if (!supportedFiles.length) {
    message.error(i18n.t.errorUnsupported)
    return
  }

  const existingKeys = new Set(batchItems.value.map((x) => x.fileKey).filter(Boolean) as string[])
  const uniqIncoming = new Map<string, File>()
  for (const f of supportedFiles) {
    const k = `${f.name}_${f.size}_${f.lastModified}`
    if (!existingKeys.has(k)) uniqIncoming.set(k, f)
  }

  const incomingKeys = Array.from(uniqIncoming.keys())
  const incomingFiles = Array.from(uniqIncoming.values())

  const skipped = supportedFiles.length - incomingFiles.length
  if (skipped > 0) message.info(`${i18n.t.batchSkipExisting}${skipped}`)
  if (!incomingFiles.length) return

  isBatchWorking.value = true
  const base = Date.now()
  const newItems: BatchItem[] = incomingFiles.map((f, idx) => ({
    uid: `${base}_${idx}_${f.name}`,
    name: f.name,
    status: 'processing',
    fileKey: incomingKeys[idx],
    originalSize: f.size,
    compressedSize: undefined,
    savedBytes: undefined,
    ratePercent: null,
    originalUrl: URL.createObjectURL(f),
    compressedUrl: undefined,
  }))
  batchItems.value = [...batchItems.value, ...newItems]

  for (let i = 0; i < incomingFiles.length; i++) {
    const file = incomingFiles[i]
    const uid = newItems[i].uid
    try {
      const { blob, mimeType } = await compressImageFile(file, qualityPercent.value / 100)
      const origin = file.size
      const compress = blob.size
      const saved = origin - compress
      const rate = origin ? Number(((saved / origin) * 100).toFixed(1)) : null
      const compressedUrl = URL.createObjectURL(blob)
      const idxInList = batchItems.value.findIndex((x) => x.uid === uid)
      if (idxInList >= 0) {
        const prevCompressedUrl = batchItems.value[idxInList]?.compressedUrl
        if (prevCompressedUrl) revoke(prevCompressedUrl)
        batchItems.value[idxInList] = {
          ...batchItems.value[idxInList],
          status: 'done',
          blob,
          mimeType,
          compressedSize: compress,
          savedBytes: saved,
          ratePercent: rate,
          compressedUrl,
        }
      } else {
        revoke(compressedUrl)
      }
    } catch {
      const idxInList = batchItems.value.findIndex((x) => x.uid === uid)
      if (idxInList >= 0) batchItems.value[idxInList] = { ...batchItems.value[idxInList], status: 'error' }
    }
  }

  isBatchWorking.value = false
}

function onBatchFilesPicked(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  void startBatch(files)
}

function onBatchFolderPicked(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  void startBatch(files)
}

async function doCompress() {
  if (!originalFile.value) return
  isCompressing.value = true
  try {
    const { blob } = await compressImageFile(originalFile.value, qualityPercent.value / 100)
    compressedBlob.value = blob
    revoke(compressedUrl.value)
    compressedUrl.value = URL.createObjectURL(blob)
  } catch {
    message.error(i18n.t.errorCompressFailed)
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

const zipDisabled = computed(() => {
  if (isBatchWorking.value) return true
  return batchItems.value.filter((x) => x.status === 'done' && x.blob).length === 0
})

async function downloadZip() {
  const ok = batchItems.value.filter((x) => x.status === 'done' && x.blob) as Required<BatchItem>[]
  if (!ok.length) return

  try {
    const zip = new JSZip()
    ok.forEach((it, idx) => {
      const ext = extFromMime(it.mimeType)
      zip.file(`compressed_${idx + 1}.${ext}`, it.blob)
    })
    const content = await zip.generateAsync({ type: 'blob' })
    saveAs(content, `compressed_images_${Date.now()}.zip`)
  } catch {
    message.error(i18n.t.errorZipFailed)
  }
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
  clearBatchUrls()
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

        <!-- Batch -->
        <a-card class="batch-box" :title="i18n.t.batchTitle" :bordered="false">
          <a-space direction="vertical" style="width: 100%" :size="12">
            <div class="batch-actions">
              <a-button block :loading="isBatchWorking" @click="pickBatchFiles">{{ i18n.t.batchSelectImages }}</a-button>
              <a-button block :loading="isBatchWorking" @click="pickBatchFolder">{{ i18n.t.batchSelectFolder }}</a-button>
            </div>

            <input
              ref="batchFilesInputEl"
              type="file"
              multiple
              accept="image/*"
              style="display: none"
              @change="onBatchFilesPicked"
            />
            <input
              ref="batchFolderInputEl"
              type="file"
              multiple
              webkitdirectory
              directory
              style="display: none"
              @change="onBatchFolderPicked"
            />

            <a-list v-if="batchItems.length" size="small" bordered :data-source="batchItems">
              <template #renderItem="{ item }">
                <a-list-item class="batch-item">
                  <div class="batch-left">
                    <div class="batch-name">{{ item.name }}</div>
                    <div class="batch-metrics" v-if="item.originalSize != null">
                      <span class="m">
                        {{ i18n.t.batchOriginal }}: {{ formatBytes(item.originalSize) }}
                      </span>
                      <span class="m" v-if="item.compressedSize != null">
                        {{ i18n.t.batchCompressed }}: {{ formatBytes(item.compressedSize) }}
                      </span>
                      <span class="m" v-if="item.savedBytes != null">
                        {{ i18n.t.saved }}: {{ formatBytes(item.savedBytes) }}
                      </span>
                      <span class="m" v-if="item.ratePercent != null">
                        {{ i18n.t.rate }}: {{ item.ratePercent }}%
                      </span>
                    </div>
                  </div>

                  <div class="batch-right">
                    <span
                      class="batch-status"
                      :class="{
                        done: item.status === 'done',
                        err: item.status === 'error',
                      }"
                    >
                      {{
                        item.status === 'processing'
                          ? i18n.t.batchProcessing
                          : item.status === 'done'
                            ? i18n.t.batchDone
                            : i18n.t.batchError
                      }}
                    </span>
                    <a-button
                      size="small"
                      :disabled="item.status !== 'done' || !item.originalUrl || !item.compressedUrl"
                      @click="openPreview(item)"
                    >
                      {{ i18n.t.batchPreview }}
                    </a-button>
                    <a-button size="small" danger @click="removeBatchItem(item.uid)">{{ i18n.t.batchDelete }}</a-button>
                  </div>
                </a-list-item>
              </template>
            </a-list>

            <a-button type="primary" block :loading="isBatchWorking" :disabled="zipDisabled" @click="downloadZip">
              {{ i18n.t.batchZipDownload }}
            </a-button>
          </a-space>
        </a-card>

        <a-modal
          v-model:open="previewOpen"
          :title="i18n.t.batchPreview"
          :footer="null"
          :width="920"
          centered
          @cancel="closePreview"
        >
          <a-space direction="vertical" style="width: 100%" :size="12">
            <a-descriptions v-if="previewItem" bordered size="small" :column="2">
              <a-descriptions-item :label="i18n.t.batchOriginal">
                {{ previewItem.originalSize != null ? formatBytes(previewItem.originalSize) : i18n.t.empty }}
              </a-descriptions-item>
              <a-descriptions-item :label="i18n.t.batchCompressed">
                {{ previewItem.compressedSize != null ? formatBytes(previewItem.compressedSize) : i18n.t.empty }}
              </a-descriptions-item>
              <a-descriptions-item :label="i18n.t.saved">
                {{ previewItem.savedBytes != null ? formatBytes(previewItem.savedBytes) : i18n.t.empty }}
              </a-descriptions-item>
              <a-descriptions-item :label="i18n.t.rate">
                {{ previewItem.ratePercent == null ? i18n.t.empty : `${previewItem.ratePercent}%` }}
              </a-descriptions-item>
            </a-descriptions>

            <a-row :gutter="[12, 12]">
            <a-col :xs="24" :sm="12">
              <a-card size="small" :title="i18n.t.batchOriginal">
                <template v-if="previewItem?.originalUrl">
                  <img class="preview-img" :src="previewItem.originalUrl" alt="batch-original" />
                </template>
                <template v-else><a-empty /></template>
              </a-card>
            </a-col>
            <a-col :xs="24" :sm="12">
              <a-card size="small" :title="i18n.t.batchCompressed">
                <template v-if="previewItem?.compressedUrl">
                  <img class="preview-img" :src="previewItem.compressedUrl" alt="batch-compressed" />
                </template>
                <template v-else><a-empty /></template>
              </a-card>
            </a-col>
            </a-row>
          </a-space>
        </a-modal>
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
.batch-box {
  background: #f0f7ff;
}
.batch-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.batch-actions :deep(.ant-btn) {
  height: 40px;
}
.batch-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.batch-left {
  min-width: 0;
  flex: 1;
}
.batch-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
.batch-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin-top: 4px;
  color: rgba(0, 0, 0, 0.65);
  font-size: 12px;
}
.batch-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.batch-status.done {
  color: #52c41a;
}
.batch-status.err {
  color: #ff4d4f;
}
</style>

