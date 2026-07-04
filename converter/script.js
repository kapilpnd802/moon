const fileInput = document.getElementById("fileInput");
const fileName = document.getElementById("fileName");
const status = document.getElementById("status");
const convertButton = document.getElementById("convertButton");
const progressBar = document.getElementById("progressBar");
const downloadButton = document.getElementById("downloadButton");

let selectedFile = null;
let downloadUrl = null;

function resetProgress() {
  progressBar.style.width = "0%";
  progressBar.textContent = "0%";
}

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function updateProgress(percent, label) {
  progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  progressBar.textContent = label || `${Math.round(percent)}%`;
}

function clearDownloadLink() {
  if (downloadUrl) {
    URL.revokeObjectURL(downloadUrl);
    downloadUrl = null;
  }
  downloadButton.hidden = true;
  downloadButton.removeAttribute("href");
  downloadButton.setAttribute("download", "converted.docx");
}

fileInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  clearDownloadLink();
  resetProgress();

  if (!file) {
    selectedFile = null;
    fileName.textContent = "No file selected yet.";
    setStatus("No PDF selected yet.");
    convertButton.disabled = true;
    return;
  }

  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    selectedFile = null;
    fileName.textContent = "Please choose a valid PDF file.";
    setStatus("Only PDF files are supported.", true);
    convertButton.disabled = true;
    return;
  }

  selectedFile = file;
  fileName.textContent = file.name;
  setStatus(`Selected: ${file.name}`);
  convertButton.disabled = false;
});

convertButton.addEventListener("click", async () => {
  if (!selectedFile) {
    return;
  }

  clearDownloadLink();
  setStatus(`Uploading ${selectedFile.name}...`);
  convertButton.disabled = true;
  convertButton.textContent = "Converting...";
  updateProgress(10, "10%");

  const formData = new FormData();
  formData.append("pdf", selectedFile);

  try {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/convert", true);
    xhr.responseType = "blob";

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        updateProgress(percent, `${percent}%`);
        if (percent < 100) {
          setStatus(`Uploading ${selectedFile.name}...`);
        }
      }
    });

    xhr.addEventListener("load", async () => {
      if (xhr.status >= 400) {
        let message = "Conversion failed. Please try another PDF file.";
        try {
          const parsed = JSON.parse(await xhr.response.text());
          if (parsed?.error) {
            message = parsed.error;
          }
        } catch (error) {
          console.error(error);
        }

        setStatus(message, true);
        updateProgress(0, "0%");
        convertButton.disabled = false;
        convertButton.textContent = "Convert to Word";
        return;
      }

      updateProgress(100, "Done");
      setStatus("Conversion complete. Preparing download...");

      const blob = xhr.response;
      if (!blob || blob.size === 0) {
        setStatus("The server did not return a DOCX file.", true);
        convertButton.disabled = false;
        convertButton.textContent = "Convert to Word";
        return;
      }

      downloadUrl = URL.createObjectURL(blob);
      downloadButton.href = downloadUrl;
      downloadButton.download = `${selectedFile.name.replace(/\.pdf$/i, "") || "converted"}.docx`;
      downloadButton.hidden = false;
      setStatus("Conversion complete. Download your DOCX file.");

      convertButton.disabled = false;
      convertButton.textContent = "Convert to Word";
    });

    xhr.addEventListener("error", () => {
      setStatus("The upload failed. Please check your connection and try again.", true);
      updateProgress(0, "0%");
      convertButton.disabled = false;
      convertButton.textContent = "Convert to Word";
    });

    xhr.addEventListener("timeout", () => {
      setStatus("The conversion timed out. Please try a smaller or simpler PDF.", true);
      updateProgress(0, "0%");
      convertButton.disabled = false;
      convertButton.textContent = "Convert to Word";
    });

    xhr.timeout = 600000;
    xhr.send(formData);
  } catch (error) {
    console.error(error);
    setStatus("Conversion failed. Please try another PDF file.", true);
    updateProgress(0, "0%");
    convertButton.disabled = false;
    convertButton.textContent = "Convert to Word";
  }
});
