import express from "express";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas } from "canvas";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import * as docx from "docx";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/legacy/build/pdf.worker.mjs",
  import.meta.url
).toString();

app.use(express.static(__dirname));
app.use(express.json());

function extractTextLines(textContent) {
  const items = (textContent.items || [])
    .filter((item) => item && typeof item.str === "string" && item.str.trim())
    .map((item) => {
      const transform = item.transform || [];
      const x = transform[4] || 0;
      const y = transform[5] || 0;
      const fontSize = item.height || 12;
      return {
        text: item.str.replace(/\s+/g, " ").trim(),
        x,
        y,
        fontSize,
        hasEOL: Boolean(item.hasEOL),
      };
    });

  if (items.length === 0) {
    return [];
  }

  const sortedItems = items.slice().sort((a, b) => b.y - a.y || a.x - b.x);
  const lines = [];
  let currentLine = null;

  sortedItems.forEach((item) => {
    if (currentLine && Math.abs(item.y - currentLine.y) <= 10) {
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
    .map((line) => {
      const sortedLineItems = line.items.sort((a, b) => a.x - b.x);
      return {
        text: sortedLineItems.map((item) => item.text).join(" "),
        fontSize: sortedLineItems[0] ? sortedLineItems[0].fontSize : 12,
        hasEOL: sortedLineItems[sortedLineItems.length - 1]?.hasEOL || false,
      };
    })
    .filter((entry) => entry.text);
}

async function renderPageToImage(page, scale = 1.8) {
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext("2d");

  await page.render({ canvasContext: context, viewport }).promise;
  return canvas.toBuffer("image/png");
}

function buildWordDocument(pageEntries) {
  const { Document, Paragraph, TextRun, ImageRun } = docx;
  const children = [];

  pageEntries.forEach((entry, pageIndex) => {
    if (entry.imageBuffer) {
      children.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: entry.imageBuffer,
              transformation: { width: 500, height: 700 },
            }),
          ],
          spacing: { before: 120, after: 180 },
        })
      );
    }

    (entry.lines || []).forEach((line) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: line.text,
              size: Math.max(20, Math.round((line.fontSize || 12) * 2.2)),
            }),
          ],
          spacing: { before: 40, after: 40 },
        })
      );
    });

    if (pageIndex < pageEntries.length - 1) {
      children.push(new Paragraph({ children: [new TextRun("")], spacing: { after: 240 } }));
    }
  });

  if (children.length === 0) {
    children.push(new Paragraph({ children: [new TextRun("No text was found in the selected PDF.")] }));
  }

  return new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/math2/verify", express.json(), (req, res) => {
  const submittedPassword = req.body?.password;
  const expectedPassword = process.env.MATH2_PASSWORD;

  if (submittedPassword === expectedPassword) {
    return res.json({ ok: true });
  }

  return res.status(401).json({ ok: false, message: "Incorrect password" });
});

app.get("/api/math2/book", (req, res) => {
  const pdfPath = path.join(__dirname, "MATH2", "book1.pdf");
  res.sendFile(pdfPath, (error) => {
    if (error) {
      res.status(404).send("PDF not found");
    }
  });
});

app.post("/api/convert", upload.single("pdf"), async (req, res) => {
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: "Please upload a PDF file." });
  }

  if (!file.originalname.toLowerCase().endsWith(".pdf") && file.mimetype !== "application/pdf") {
    return res.status(400).json({ error: "Only PDF files are supported." });
  }

  try {
    const pdf = await pdfjsLib.getDocument({ data: file.buffer }).promise;
    const pageEntries = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const lines = extractTextLines(textContent);
      const imageBuffer = await renderPageToImage(page);
      pageEntries.push({ lines, imageBuffer });
    }

    const document = buildWordDocument(pageEntries);
    const buffer = await docx.Packer.toBuffer(document);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${(file.originalname || "converted").replace(/\.pdf$/i, "") || "converted"}.docx`
    );
    return res.send(buffer);
  } catch (error) {
    console.error(error);
    return res.status(400).json({
      error: error?.message || "The uploaded PDF could not be processed. Please upload a valid PDF.",
    });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Converter server listening on http://localhost:${port}`);
});
