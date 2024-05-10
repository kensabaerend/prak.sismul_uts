// ============================================

const uploadBox = document.querySelector('.upload-box'),
   previewImage = uploadBox.querySelector('img'),
   fileInput = uploadBox.querySelector('input'),
   widthInput = document.querySelector('.width input'),
   heightInput = document.querySelector('.height input'),
   ratioInput = document.querySelector('.ratio input'),
   qualityInput = document.querySelector('.quality input'),
   downloadBtn = document.querySelector('.download-btn')

let ogImageRatio;

const loadFile = (e) => {
   const file = e.target.files[0];
   if (!file) return
   previewImage.src = URL.createObjectURL(file)
   previewImage.addEventListener('load', () => {
      widthInput.value = previewImage.naturalWidth;
      heightInput.value = previewImage.naturalHeight;
      ogImageRatio = previewImage.naturalWidth / previewImage.naturalHeight;
      document.querySelector('.container').classList.add('active')
   })
}

widthInput.addEventListener('keyup', () => {
   const height = ratioInput.checked ? widthInput.value / ogImageRatio : heightInput.value;
   heightInput.value = Math.floor(height);
})

heightInput.addEventListener('keyup', () => {
   const width = ratioInput.checked ? heightInput.value * ogImageRatio : widthInput.value;
   widthInput.value = Math.floor(width);
})

const resizeDownload = () => {
   const canvas = document.createElement('canvas')
   const a = document.createElement('a')
   const ctx = canvas.getContext('2d')
   const imgQuality = qualityInput.checked ? 0.7 : 1.0;

   canvas.width = widthInput.value;
   canvas.height = heightInput.value;
   ctx.drawImage(previewImage, 0, 0, canvas.width, canvas.height)

   a.href = canvas.toDataURL("image/", imgQuality)
   a.download = new Date().getTime()
   a.click()
}

downloadBtn.addEventListener('click', resizeDownload)
fileInput.addEventListener('change', loadFile)
uploadBox.addEventListener('click', () => fileInput.click())

