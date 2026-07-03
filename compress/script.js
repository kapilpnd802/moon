document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("imageInput");
  const status = document.getElementById("status");
  const previewWrap = document.getElementById("previewWrap");
  const previewImage = document.getElementById("previewImage");
  const downloadLink = document.getElementById("downloadLink");
  const sliderWrap = document.getElementById("sliderWrap");
  const qualityRange = document.getElementById("qualityRange");
  const qualityValue = document.getElementById("qualityValue");
  const sliderBubble = document.getElementById("sliderBubble");
  const sizeInfo = document.getElementById("sizeInfo");
  let currentObjectUrl = null;
  let currentFile = null;
  let lastResult = null;

  const setStatus = (message, isError = false) => {
    if (!status) return;
    status.textContent = message;
    status.className = `status${isError ? " error" : ""}`;
  };

  const formatBytes = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(2)} MB`;
  };

  const revokeOldUrl = () => {
    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = null;
    }
  };

  const readImage = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("The selected file is not a valid image."));
        img.src = event.target.result;
      };
      reader.onerror = () => reject(new Error("Unable to read the selected file."));
      reader.readAsDataURL(file);
    });

  const updateResultView = () => {
    if (!lastResult || !previewImage || !downloadLink || !sizeInfo) return;

    const { blob, url, width, height, mimeType, fileName } = lastResult;
    revokeOldUrl();
    currentObjectUrl = url;
    previewImage.src = url;
    previewImage.alt = fileName;
    previewWrap.hidden = false;

    const extension = mimeType === "image/png" ? "png" : "jpg";
    downloadLink.href = url;
    downloadLink.download = `compressed-${fileName.replace(/\.[^.]+$/, "")}.${extension}`;
    downloadLink.hidden = false;

    const originalSize = currentFile ? currentFile.size : 0;
    const saved = originalSize > 0 ? Math.round(((originalSize - blob.size) / originalSize) * 100) : 0;
    sizeInfo.textContent = `Original: ${formatBytes(originalSize)} → Compressed: ${formatBytes(blob.size)} (${saved}% smaller)`;
  };

  const compressImage = async (file, qualityLevel) => {
    const image = await readImage(file);
    const maxSize = 1600;
    let width = image.width;
    let height = image.height;

    if (width > maxSize || height > maxSize) {
      const scale = Math.min(maxSize / width, maxSize / height, 1);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0, width, height);

    const mimeType = file.type.includes("png") ? "image/png" : "image/jpeg";
    const quality = qualityLevel / 100;

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) {
          resolve(result);
        } else {
          reject(new Error("Compression failed. Please try another image."));
        }
      }, mimeType, quality);
    });

    const url = URL.createObjectURL(blob);
    return { blob, url, width, height, mimeType, fileName: file.name };
  };

  const updateSliderBubble = (value) => {
    if (!sliderBubble || !qualityRange) return;
    const percent = Number(value);
    sliderBubble.textContent = `${percent}%`;
    const leftPercent = ((percent - Number(qualityRange.min)) / (Number(qualityRange.max) - Number(qualityRange.min))) * 100;
    sliderBubble.style.left = `${leftPercent}%`;
  };

  const handleCompression = async () => {
    if (!currentFile) return;

    const qualityLevel = Number(qualityRange.value);
    qualityValue.textContent = `${qualityLevel}%`;
    updateSliderBubble(qualityLevel);
    setStatus("Compressing image...");

    try {
      lastResult = await compressImage(currentFile, qualityLevel);
      updateResultView();
      setStatus(`Compressed successfully. ${lastResult.width} × ${lastResult.height}px`);
    } catch (error) {
      setStatus(error.message, true);
    }
  };

  if (input) {
    input.addEventListener("change", async () => {
      const file = input.files && input.files[0];

      if (!file) {
        currentFile = null;
        lastResult = null;
        setStatus("No image selected yet.");
        previewWrap.hidden = true;
        downloadLink.hidden = true;
        sliderWrap.hidden = true;
        sizeInfo.textContent = "Adjust the slider to change compression strength.";
        revokeOldUrl();
        return;
      }

      if (!file.type.startsWith("image/")) {
        currentFile = null;
        lastResult = null;
        setStatus("Please choose an image file.", true);
        previewWrap.hidden = true;
        downloadLink.hidden = true;
        sliderWrap.hidden = true;
        revokeOldUrl();
        return;
      }

      currentFile = file;
      sliderWrap.hidden = false;
      qualityRange.value = "80";
      qualityValue.textContent = "80%";
      updateSliderBubble(80);
      sizeInfo.textContent = "Adjust the slider to change compression strength.";
      await handleCompression();
    });
  }

  if (qualityRange) {
    qualityRange.addEventListener("input", () => {
      const value = qualityRange.value;
      qualityValue.textContent = `${value}%`;
      updateSliderBubble(value);
      if (currentFile) {
        handleCompression();
      }
    });
  }
});
