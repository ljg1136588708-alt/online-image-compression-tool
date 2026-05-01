// 双语文案
const langData = {
    zh:{
        title:"在线图片压缩工具",
        uploadText:"点击或拖拽图片到此处上传",
        qualityLabel:"压缩质量：80%",
        originImgText:"原图预览",
        compressImgText:"压缩预览",
        originText:"原图大小：",
        compressText:"压缩后：",
        saveText:"节省空间：",
        rateText:"压缩率：",
        downloadBtn:"下载压缩图片"
    },
    en:{
        title:"Free Image Compressor",
        uploadText:"Click or drop image here",
        qualityLabel:"Quality：80%",
        originImgText:"Original",
        compressImgText:"Compressed",
        originText:"Original Size: ",
        compressText:"Compressed: ",
        saveText:"Saved: ",
        rateText:"Rate: ",
        downloadBtn:"Download Image"
    }
};

let nowLang = "zh";
let originalFile = null;
let compressBlob = null;

// 语言切换（供 HTML inline onclick 调用）
function setLang(lang){
    nowLang = lang;
    const d = langData[lang];
    document.getElementById("title").innerText = d.title;
    document.getElementById("uploadText").innerText = d.uploadText;
    document.getElementById("originImgText").innerText = d.originImgText;
    document.getElementById("compressImgText").innerText = d.compressImgText;
    document.getElementById("downloadBtn").innerText = d.downloadBtn;
    updateQualityText();
    renderSizeInfo();
}

const uploadBox = document.getElementById("uploadBox");
const fileInput = document.getElementById("fileInput");
const qualityInput = document.getElementById("quality");
const downloadBtn = document.getElementById("downloadBtn");

uploadBox.onclick = ()=>fileInput.click();

// 拖拽上传
uploadBox.ondragover = e => e.preventDefault();
uploadBox.ondrop = e => {
    e.preventDefault();
    if(e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
};

fileInput.onchange = ()=>{
    if(fileInput.files.length) handleFile(fileInput.files[0]);
};

// 质量滑动
qualityInput.oninput = function(){
    updateQualityText();
    if(originalFile) compressImage();
};

function updateQualityText(){
    const val = qualityInput.value;
    document.getElementById("qualityLabel").innerText =
        nowLang==="zh" ? `压缩质量：${val}%` : `Quality：${val}%`;
}

// 处理文件
function handleFile(file){
    originalFile = file;
    document.getElementById("originImg").src = URL.createObjectURL(file);
    compressImage();
}

// 核心压缩逻辑
function compressImage(){
    const file = originalFile;
    const quality = qualityInput.value / 100;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = function(e){
        const img = new Image();
        img.src = e.target.result;
        img.onload = function(){
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img,0,0);

            canvas.toBlob(blob=>{
                compressBlob = blob;
                document.getElementById("compressImg").src = URL.createObjectURL(blob);
                downloadBtn.disabled = false;
                renderSizeInfo(file.size,blob.size);
            },file.type||"image/jpeg",quality);
        };
    };
}

// 格式化大小
function formatSize(bytes){
    if(bytes<1024) return bytes+" B";
    if(bytes<1024*1024) return (bytes/1024).toFixed(2)+" KB";
    return (bytes/(1024*1024)).toFixed(2)+" MB";
}

function renderSizeInfo(origin=0,compress=0){
    const d = langData[nowLang];
    if(origin===0){
        document.getElementById("originText").innerText = d.originText + "-";
        document.getElementById("compressText").innerText = d.compressText + "-";
        document.getElementById("saveText").innerText = d.saveText + "-";
        document.getElementById("rateText").innerText = d.rateText + "-";
        return;
    }
    const save = origin - compress;
    const rate = (save/origin*100).toFixed(1);
    document.getElementById("originText").innerText = d.originText + formatSize(origin);
    document.getElementById("compressText").innerText = d.compressText + formatSize(compress);
    document.getElementById("saveText").innerText = d.saveText + formatSize(save);
    document.getElementById("rateText").innerText = d.rateText + rate + "%";
}

// 下载
downloadBtn.onclick = function(){
    if(!compressBlob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(compressBlob);
    a.download = "compress_"+Date.now()+".jpg";
    a.click();
};

