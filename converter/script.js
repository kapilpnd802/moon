const fileInput = document.getElementById("fileInput");
const fileName = document.getElementById("fileName");
const status = document.getElementById("status");
const convertButton = document.getElementById("convertButton");

let selectedFile = null;

fileInput.addEventListener("change", (event) => {
  const file = event.target.files[0];

  if (!file) {
    selectedFile = null;
    fileName.textContent = "No file selected yet.";
    status.textContent = "No PDF selected yet.";
    convertButton.disabled = true;
    return;
  }

  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    selectedFile = null;
    fileName.textContent = "Please choose a valid PDF file.";
    status.textContent = "Only PDF files are supported.";
    status.classList.add("error");
    convertButton.disabled = true;
    return;
  }

  selectedFile = file;
  fileName.textContent = file.name;
  status.textContent = `Selected: ${file.name}`;
  status.classList.remove("error");
  convertButton.disabled = false;
});

function extractTextLayout(textContent) {
  const items = (textContent.items || [])
    .filter((item) => item && typeof item.str === "string" && item.str.trim())
    .map((item) => {
      const transform = item.transform || [];
      const x = transform[4] || 0;
      const y = transform[5] || 0;

      return {
        text: item.str.replace(/\s+/g, " ").trim(),
        x,
        y,
      };
    });

  if (items.length === 0) {
    return [];
  }

  const sortedItems = items.slice().sort((a, b) => b.y - a.y || a.x - b.x);
  const lines = [];
  let currentLine = null;

  sortedItems.forEach((item) => {
    if (currentLine && Math.abs(item.y - currentLine.y) <= 8) {
      currentLine.items.push(item);
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = { y: item.y, items: [item] };
    }
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines
    .map((line) => line.items.sort((a, b) => a.x - b.x).map((item) => item.text).join(" "))
    .filter(Boolean);
}

function buildWordDocument(lines) {
  const { Document, Packer, Paragraph, TextRun } = window.docx;
  const paragraphs = lines.map((line) => new Paragraph({ children: [new TextRun(line)] }));

  if (paragraphs.length === 0) {
    paragraphs.push(new Paragraph({ children: [new TextRun("No text was found in the selected PDF.")] }));
  }

  return new Document({ sections: [{ properties: {}, children: paragraphs }] });
}

convertButton.addEventListener("click", async () => {
  if (!selectedFile) {
    return;
  }

  if (!window.pdfjsLib || !window.docx) {
    status.textContent = "The converter libraries could not be loaded. Please refresh the page.";
    status.classList.add("error");
    return;
  }

  status.textContent = `Preparing conversion for ${selectedFile.name}...`;
  convertButton.disabled = true;
  convertButton.textContent = "Converting...";

  try {
    const arrayBuffer = await selectedFile.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageLines = extractTextLayout(textContent);
      fullText += `${pageLines.join("\n")}\n\n`;
    }

    const doc = buildWordDocument(fullText.split(/\n{2,}/).map((entry) => entry.trim()).filter(Boolean));
    const blob = await window.docx.Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedFile.name.replace(/\.pdf$/i, "") || "converted"}.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    status.textContent = `Converted ${selectedFile.name} successfully.`;
    status.classList.remove("error");
  } catch (error) {
    console.error(error);
    status.textContent = "Conversion failed. Please try another PDF file.";
    status.classList.add("error");
  } finally {
    convertButton.textContent = "Convert to Word";
    convertButton.disabled = false;
  }
});
