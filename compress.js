// Konstanta
const BITS_PER_BYTE = 8
const BYTES_PER_KILOBYTE = 1024
const BYTES_PER_MEGABYTE = BYTES_PER_KILOBYTE * 1024
const MIN_FRAME_RATE = 1
const SAFETY_FACTOR = 0.95

/**
 * Calculates the file size of a WAV audio in kilobytes.
 * @param {number} frameRate - The frame rate of the audio.
 * @param {number} bitDepth - The bit depth of the audio.
 * @param {number} channels - The number of audio channels.
 * @param {number} durationSec - The duration of the audio in seconds.
 * @return {number} The file size in kilobytes.
 */
function calculateFileSizeInKb(frameRate, bitDepth, channels, durationSec) {
  const sizeInBits = frameRate * bitDepth * channels * durationSec
  return sizeInBits / (BITS_PER_BYTE * BYTES_PER_KILOBYTE)
}

/**
 * Calculates the new frame rate to achieve the target file size in megabytes.
 * @param {number} currentFrameRate - The current frame rate of the audio.
 * @param {number} targetSizeMb - The target file size in megabytes.
 * @param {number} currentSizeKb - The current file size in kilobytes.
 * @return {number} The new frame rate.
 */
function calculateNewFrameRate(currentFrameRate, targetSizeMb, currentSizeKb) {
  const targetSizeKb = (targetSizeMb * BYTES_PER_MEGABYTE) / BYTES_PER_KILOBYTE
  let reductionFactor = targetSizeKb / currentSizeKb
  reductionFactor *= SAFETY_FACTOR
  return Math.max(
    Math.floor(currentFrameRate * reductionFactor),
    MIN_FRAME_RATE
  )
}

/**
 * Compresses an audio file to a target size and triggers a download.
 * @param {File} file - The audio file to compress.
 * @param {number} targetSizeMb - The target file size in megabytes.
 */
async function compressAudioFile(file, targetSizeMb) {
  try {
    console.log(`Starting compression for ${file.name}`)
    const audioContext = new(window.AudioContext ||
      window.webkitAudioContext)()
    const fileData = await file.arrayBuffer()
    const audioBuffer = await audioContext.decodeAudioData(fileData)

    // Hitung frame rate baru
    const currentFrameRate = audioBuffer.sampleRate
    const currentSizeKb = calculateFileSizeInKb(
      currentFrameRate,
      16, // Mengasumsikan kedalaman bit 16, ganti dengan bit berbeda
      audioBuffer.numberOfChannels,
      audioBuffer.duration
    )
    const newFrameRate = calculateNewFrameRate(
      currentFrameRate,
      targetSizeMb,
      currentSizeKb
    )
    console.log(`New frame rate calculated: ${newFrameRate} Hz`)

    // Modifikasi data audio untuk mengurangi sample rate
    const newAudioBuffer = await changeSampleRate(audioBuffer, newFrameRate)

    // Encode data audio yang telah dimodifikasi ke format file WAV
    const processedWavBlob = encodeAudioBufferToWav(newAudioBuffer)

    // Buat tautan unduhan untuk file WAV yang telah diproses
    const downloadLink = document.createElement('a')
    downloadLink.href = URL.createObjectURL(processedWavBlob)
    downloadLink.download = file.name.replace('.wav', '_compressed.wav')
    document.body.appendChild(downloadLink) 
    downloadLink.click()
    document.body.removeChild(downloadLink) 
    URL.revokeObjectURL(downloadLink.href) 

    console.log(
      `Compressed and downloaded ${file.name} with new frame rate: ${newFrameRate} Hz`
    )
  } catch (e) {
    console.error(`Error processing file: ${e}`)
  }
}

/**
 * Sets up the file selector and compression button event listeners.
 */
function setupFileSelector() {
  const fileInput = document.getElementById('fileInput')
  const compressButton = document.getElementById('compressButton')

  compressButton.addEventListener('click', (event) => {
    event.preventDefault()
    const files = fileInput.files
    const targetSizeMb = 3
    if (isNaN(targetSizeMb) || targetSizeMb <= 0) {
      console.error('Invalid target size. Please enter a positive number.')
      return
    }
    for (const file of files) {
      compressAudioFile(file, targetSizeMb)
    }
  })
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('Starting the audio compression application...')
  setupFileSelector()
})

/**
 * Changes the sample rate of an audio buffer.
 * @param {AudioBuffer} audioBuffer - The original audio buffer.
 * @param {number} newSampleRate - The new sample rate to apply.
 * @return {AudioBuffer} The audio buffer with the new sample rate.
 */
async function changeSampleRate(audioBuffer, newSampleRate) {
  // Buat konteks offline dengan sample rate baru.
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    (audioBuffer.length * newSampleRate) / audioBuffer.sampleRate,
    newSampleRate
  )

  // Buat sumber buffer untuk audioBuffer yang ada.
  const bufferSource = offlineContext.createBufferSource()
  bufferSource.buffer = audioBuffer

  // Hubungkan sumber ke konteks offline.
  bufferSource.connect(offlineContext.destination)

  // Mulai sumber.
  bufferSource.start()

  // Render audio dari konteks offline.
  const renderedBuffer = await offlineContext.startRendering()

  console.log(`Sample rate changed to ${newSampleRate} Hz`)
  return renderedBuffer
}

/**
 * Encodes an audio buffer into a WAV file blob.
 * @param {AudioBuffer} audioBuffer - The audio buffer to encode.
 * @return {Blob} The WAV file blob.
 */
function encodeAudioBufferToWav(audioBuffer) {
  // Buat file WAV menggunakan fungsi bawaan dan kodekannya menjadi Blob
  const bufferLength = audioBuffer.length
  const numberOfChannels = audioBuffer.numberOfChannels
  const sampleRate = audioBuffer.sampleRate
  const bitsPerSample = 16 // Nilai khas untuk file WAV

  // Buat DataView dengan buffer seukuran yang diperlukan untuk file WAV
  const wavHeaderSize = 44 // 44 byte untuk header WAV
  const wavBufferSize =
    (bufferLength * numberOfChannels * bitsPerSample) / 8 + wavHeaderSize
  const wavBuffer = new ArrayBuffer(wavBufferSize)
  const view = new DataView(wavBuffer)

  // Write the WAV container headers
  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + bufferLength * numberOfChannels * 2, true)
  writeString(view, 8, 'WAVE')
  // FMT sub-chunk
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true) // AudioFormat (1 for PCM)
  view.setUint16(22, numberOfChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, (sampleRate * numberOfChannels * bitsPerSample) / 8, true) // ByteRate
  view.setUint16(32, (numberOfChannels * bitsPerSample) / 8, true) // BlockAlign
  view.setUint16(34, bitsPerSample, true)
  // Data sub-chunk
  writeString(view, 36, 'data')
  view.setUint32(40, bufferLength * numberOfChannels * 2, true)

  // Write the PCM samples
  let offset = 44
  for (let i = 0; i < bufferLength; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = Math.max(
        -1,
        Math.min(1, audioBuffer.getChannelData(channel)[i])
      ) // Batasi sampel ke rentang -1 hingga 1
      const intSample = sample < 0 ? sample * 32768 : sample * 32767 // Convert to 16-bit integer
      view.setInt16(offset, intSample, true)
      offset += 2
    }
  }

  // Buat dan kembalikan Blob dengan data file WAV
  const wavBlob = new Blob([view], {
    type: 'audio/wav'
  })
  console.log('WAV file encoding complete.')
  return wavBlob
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i))
  }
}