import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import * as util from 'util';
// Use a require() import to be robust against CJS/ESM export shapes
// eslint-disable-next-line @typescript-eslint/no-var-requires
const TurndownService = require('turndown');
// @ts-ignore
const HTMLtoDOCX = require('html-to-docx');
import { v4 as uuidv4 } from 'uuid';
// Use server-side generateHTML; require from dist path to avoid TS moduleResolution issues
// eslint-disable-next-line @typescript-eslint/no-var-requires
// Server-side HTML generation is handled by the client (editor.getHTML()).
// This service contains simple fallbacks when HTML is not provided.


const execPromise = util.promisify(exec);

@Injectable()
export class ExportService {
  private readonly tempDir = os.tmpdir();

  convertJsonToHtml(json: any): string {
    // naive fallback renderer (handles paragraph and heading and plain text)
    if (!json || !json.content) return '';

    try {
      return (json.content || [])
        .map((node: any) => {
          if (node.type === 'paragraph') {
            const text = (node.content || []).map((c: any) => c.text || '').join('');
            return `<p>${text}</p>`;
          }
          if (node.type === 'heading') {
            const level = node.attrs?.level || 1;
            const text = (node.content || []).map((c: any) => c.text || '').join('');
            return `<h${level}>${text}</h${level}>`;
          }
          // extend as needed
          return '';
        })
        .join('\n');
    } catch (e) {
      return '';
    }
  }

  async exportToMd(html: string): Promise<Buffer> {
    const turndownService = new TurndownService();
    const markdown = turndownService.turndown(html);
    return Buffer.from(markdown, 'utf-8');
  }

  async exportToDocx(html: string): Promise<Buffer> {
    try {
      const buffer = await HTMLtoDOCX(html, null, {
        table: { row: { cantSplit: true } },
        footer: true,
        pageNumber: true,
      });
      return buffer;
    } catch (error) {
      console.error('Error converting HTML to DOCX:', error);
      throw new InternalServerErrorException('Failed to convert to DOCX');
    }
  }

  async exportToPdf(html: string): Promise<Buffer> {
    const docxBuffer = await this.exportToDocx(html);
    const id = uuidv4();
    const docxPath = path.join(this.tempDir, `${id}.docx`);
    const pdfPath = path.join(this.tempDir, `${id}.pdf`);

    try {
      console.log(`Writing DOCX to ${docxPath}`);
      await fs.promises.writeFile(docxPath, docxBuffer);

      if (!fs.existsSync(docxPath)) {
         throw new Error(`Failed to write DOCX file at ${docxPath}`);
      }

      // Use flex-conv to convert DOCX to PDF
      console.log(`Converting DOCX to PDF using flex-conv`);
      // Use npx --no-install to ensure we use the local package and don't try to download
      const flexConvCmd = `npx --no-install flex-conv "${docxPath}" -t pdf`;
      
      const { stdout, stderr } = await execPromise(flexConvCmd);
      console.log('flex-conv output:', stdout);
      if (stderr) console.error('flex-conv stderr:', stderr);

      // Check if PDF exists
      if (!fs.existsSync(pdfPath)) {
        throw new Error('PDF file was not created');
      }

      const pdfBuffer = await fs.promises.readFile(pdfPath);
      return pdfBuffer;
    } catch (error) {
      console.error('Error converting DOCX to PDF:', error);
      throw new InternalServerErrorException('Failed to convert to PDF: ' + error.message);
    } finally {
      // Cleanup
      if (fs.existsSync(docxPath)) await fs.promises.unlink(docxPath);
      if (fs.existsSync(pdfPath)) await fs.promises.unlink(pdfPath);
    }
  }
}
