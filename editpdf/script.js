import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.worker.min.mjs";

const pdfInput = document.getElementById("pdfInput");
const fileName = document.getElementById("fileName");
const status = document.getElementById("status");
const editorTools = document.getElementById("editorTools");
const editButton = document.getElementById("editButton");
const doneButton = document.getElementById("doneButton");
const removeButton = document.getElementById("removeButton");
const fontSelect = document.getElementById("fontSelect");
const fontSizeInput = document.getElementById("fontSizeInput");
const fontSizeValue = document.getElementById("fontSizeValue");
const viewer = document.getElementById("pdfViewer");
const canvas = document.getElementById("pdfCanvas");
const textLayer = document.getElementById("textLayer");
const downloadWrap = document.getElementById("downloadWrap");
const downloadButton = document.getElementById("downloadButton");

let selectedFile = null;
let originalPdfBytes = null;
let isEditing = false;
let selectedBox = null;
const textBoxes = [];

const setStatus = (message, isError = false) => {
  if (!status) return;
  status.textContent = message;
  status.className = `status${isError ? " error" : ""}`;
};

const clearTextBoxes = () => {
  if (textLayer) {
    textLayer.innerHTML = "";
  }
  textBoxes.length = 0;
  selectedBox = null;
};

const updateFontSizeLabel = (value) => {
  if (fontSizeValue) {
    fontSizeValue.textContent = `${value}px`;
  }
};

const selectTextBox = (box) => {
  if (!isEditing || !box) return;

  textBoxes.forEach((entry) => entry.classList.remove("selected"));
  box.classList.add("selected");
  selectedBox = box;

  const fontFamily = box.style.fontFamily || getComputedStyle(box).fontFamily;
  const fontSize = parseInt(box.style.fontSize || getComputedStyle(box).fontSize, 10) || 24;

  if (fontSelect) {
    fontSelect.value = fontFamily;
  }
  if (fontSizeInput) {
    fontSizeInput.value = fontSize;
    updateFontSizeLabel(fontSize);
  }
};

const setEditingMode = (enabled) => {
  isEditing = enabled;

  if (editButton) {
    editButton.textContent = enabled ? "Editing On" : "Edit Text";
  }

  textBoxes.forEach((box) => {
    box.classList.toggle("editing", enabled);
    box.contentEditable = enabled;
    box.setAttribute("tabindex", enabled ? "0" : "-1");
    box.style.pointerEvents = enabled ? "auto" : "none";
    if (!enabled) {
      box.classList.remove("selected");
    }
  });

  if (!enabled) {
    selectedBox = null;
  }
};

const resetEditorView = () => {
  if (editorTools) {
    editorTools.hidden = true;
  }
  if (viewer) {
    viewer.hidden = true;
  }
  if (downloadWrap) {
    downloadWrap.hidden = true;
  }
  clearTextBoxes();
};

const renderTextLayer = (textContent, viewport) => {
  clearTextBoxes();

  const items = textContent.items.filter((item) => item && typeof item.str === "string" && item.str.trim());

  items.forEach((item, index) => {
    const transform = pdfjsLib.Util.transform(viewport.transform, item.transform);
    const x = transform[4];
    const y = transform[5];
    const height = item.height || 16;

    const box = document.createElement("div");
    box.className = "text-box";
    box.textContent = item.str.trim();
    box.style.left = `${x}px`;
    box.style.top = `${y}px`;
    box.style.fontSize = `${Math.max(14, Math.round(height * 1.2))}px`;
    box.style.fontFamily = "Arial";
    box.dataset.index = index;

    box.addEventListener("click", () => selectTextBox(box));
    box.addEventListener("focus", () => selectTextBox(box));
    box.addEventListener("input", () => selectTextBox(box));

    textLayer.appendChild(box);
    textBoxes.push(box);
  });
};

const renderPdf = async (file) => {
  try {
    setStatus("Loading PDF...");
    const arrayBuffer = await file.arrayBuffer();
    originalPdfBytes = arrayBuffer;

    const pdfDocument = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdfDocument.getPage(1);
    const viewport = page.getViewport({ scale: 1.35 });

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;

    const context = canvas.getContext("2d");
    await page.render({ canvasContext: context, viewport }).promise;

    const textContent = await page.getTextContent();
    renderTextLayer(textContent, viewport);

    viewer.hidden = false;
    editorTools.hidden = false;
    downloadWrap.hidden = true;
    setStatus(`Loaded ${file.name}. Click Edit Text to start changing the text.`);
  } catch (error) {
    console.error(error);
    setStatus("Unable to load this PDF. Please try another file.", true);
  }
};

if (pdfInput) {
  pdfInput.addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];

    if (!file) {
      selectedFile = null;
      originalPdfBytes = null;
      fileName.textContent = "No file selected yet.";
      setStatus("No PDF selected yet.");
      resetEditorView();
      return;
    }

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      selectedFile = null;
      originalPdfBytes = null;
      fileName.textContent = "Please choose a valid PDF file.";
      setStatus("Only PDF files are supported.", true);
      resetEditorView();
      return;
    }

    selectedFile = file;
    fileName.textContent = file.name;
    await renderPdf(file);
  });
}

if (editButton) {
  editButton.addEventListener("click", () => {
    if (!selectedFile) {
      setStatus("Please upload a PDF first.", true);
      return;
    }

    setEditingMode(!isEditing);
  });
}

if (doneButton) {
  doneButton.addEventListener("click", () => {
    if (!selectedFile) {
      setStatus("Please upload a PDF first.", true);
      return;
    }

    setEditingMode(false);
    if (downloadWrap) {
      downloadWrap.hidden = false;
    }
    setStatus("Editing complete. You can now download your updated PDF.");
  });
}

if (removeButton) {
  removeButton.addEventListener("click", () => {
    if (!selectedBox) {
      setStatus("Select a text box first.", true);
      return;
    }

    selectedBox.remove();
    const index = textBoxes.indexOf(selectedBox);
    if (index >= 0) {
      textBoxes.splice(index, 1);
    }
    selectedBox = null;
    setStatus("Selected text removed.");
  });
}

if (fontSelect) {
  fontSelect.addEventListener("change", () => {
    if (selectedBox) {
      selectedBox.style.fontFamily = fontSelect.value;
    }
  });
}

if (fontSizeInput) {
  fontSizeInput.addEventListener("input", () => {
    const value = Number(fontSizeInput.value);
    updateFontSizeLabel(value);

    if (selectedBox) {
      selectedBox.style.fontSize = `${value}px`;
    }
  });
}

if (downloadButton) {
  downloadButton.addEventListener("click", async () => {
    if (!selectedFile || !originalPdfBytes || !window.PDFLib) {
      setStatus("Please upload a valid PDF first.", true);
      return;
    }

    try {
      const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
      const pdfDoc = await PDFDocument.load(originalPdfBytes);
      const page = pdfDoc.getPages()[0];
      const pageWidth = page.getWidth();
      const pageHeight = page.getHeight();
      const canvasWidth = canvas.width || 1;
      const canvasHeight = canvas.height || 1;

      const fontMap = {
        Arial: StandardFonts.Helvetica,
        "Times New Roman": StandardFonts.TimesRoman,
        Georgia: StandardFonts.TimesRoman,
        Verdana: StandardFonts.Helvetica,
        Helvetica: StandardFonts.Helvetica,
        Calibri: StandardFonts.Helvetica,
        Cambria: StandardFonts.TimesRoman,
        "Trebuchet MS": StandardFonts.Helvetica,
        "Courier New": StandardFonts.Courier,
        Tahoma: StandardFonts.Helvetica,
        Poppins: StandardFonts.Helvetica,
        Inter: StandardFonts.Helvetica,
      };

      const font = fontMap[fontSelect?.value || "Arial"] || StandardFonts.Helvetica;

      textBoxes.forEach((box) => {
        const text = box.textContent.trim();
        if (!text) return;

        const x = (box.offsetLeft / canvasWidth) * pageWidth;
        const y = pageHeight - ((box.offsetTop + 4) / canvasHeight) * pageHeight;
        const size = Math.max(8, (parseFloat(box.style.fontSize || "24px") / canvasHeight) * pageHeight);

        page.drawText(text, {
          x,
          y,
          size,
          font,
          color: rgb(0, 0, 0),
        });
      });

      const outputBytes = await pdfDoc.save();
      const blob = new Blob([outputBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${selectedFile.name.replace(/\.pdf$/i, "") || "edited"}-edited.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setStatus("Your updated PDF has been downloaded.");
    } catch (error) {
      console.error(error);
      setStatus("Unable to create the updated PDF right now.", true);
    }
  });
}

updateFontSizeLabel(Number(fontSizeInput?.value || 24));
