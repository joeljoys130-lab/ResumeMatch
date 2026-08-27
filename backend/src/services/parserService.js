import fs from 'fs/promises';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { ValidationError } from '../utils/errors.js';

/**
 * Extracts plain text from uploaded PDF or DOCX file buffer/path.
 * Guarantees file deletion in `finally` block.
 */
export async function extractResumeText(file) {
  if (!file || !file.path) {
    throw new ValidationError('Resume file is required.');
  }

  const filePath = file.path;
  const mimeType = file.mimetype;
  const originalName = file.originalname || 'resume';

  let extractedText = '';

  try {
    const fileBuffer = await fs.readFile(filePath);

    if (mimeType === 'application/pdf' || originalName.toLowerCase().endsWith('.pdf')) {
      const pdfData = await pdfParse(fileBuffer);
      extractedText = pdfData.text || '';
    } else if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword' ||
      originalName.toLowerCase().endsWith('.docx')
    ) {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      extractedText = result.value || '';
    } else {
      throw new ValidationError('Unsupported file format. Only PDF (.pdf) and Word (.docx) files are supported.');
    }

    // Clean up excessive whitespace
    extractedText = extractedText.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

    if (extractedText.length < 50) {
      throw new ValidationError('Extracted text is too short (under 50 characters). Please provide a valid, readable resume document.');
    }

    return extractedText;
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    console.error('❌ File parsing error:', err.message);
    throw new ValidationError(`Failed to parse resume document: ${err.message}`);
  } finally {
    // ALWAYS clean up temporary uploaded file
    try {
      await fs.unlink(filePath);
    } catch (cleanupErr) {
      // Ignore if file was already deleted or doesn't exist
    }
  }
}
