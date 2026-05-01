# 在线图片压缩工具（Vue 3 + Vite + TS + Pinia + Router + Ant Design Vue）

## 开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
npm run preview
```

## 目录说明

- `src/pages/HomePage.vue`：主页面（上传、压缩、预览、下载）
- `src/utils/imageCompress.ts`：canvas 压缩逻辑（`toBlob`）
- `src/stores/i18n.ts`：轻量双语文案（中文/英文）
- `legacy/`：旧的纯静态版本备份（HTML/CSS/JS）
