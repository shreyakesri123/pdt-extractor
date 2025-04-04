import { Express, Request, Response, Router } from 'express';
import { Server } from 'http';
import multer from 'multer';
import path from 'path';
import { storage } from './storage';
// Use our new direct extraction module instead
import { extractTablesFromPdf } from './pdf-extraction/detect-tables';
import { generateExcelFile, generateConsolidatedExcel } from './excel-generation/generate-excel';
import { z } from 'zod';
import { insertPdfDocumentSchema, TableData } from '@shared/schema';

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // Only accept PDF files
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

export async function registerRoutes(app: Express): Promise<void> {
  console.log('Registering API routes');
  const router = Router();
  
  // Add request logging middleware
  router.use((req: Request, res: Response, next) => {
    console.log(`[API] ${req.method} ${req.path}`);
    next();
  });

  // Health check endpoint
  router.get('/api/health', (req: Request, res: Response) => {
    console.log('Health check requested');
    res.status(200).json({ status: 'ok' });
  });

  // Upload and extract tables from PDF
  router.post('/api/extract', upload.single('pdf'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No PDF file uploaded' });
      }

      const file = req.file;
      
      // Process the PDF file
      const pdfBuffer = file.buffer;
      const tables = await extractTablesFromPdf(pdfBuffer);
      
      // Save document and tables to storage
      const documentData = {
        filename: file.originalname,
        filesize: file.size,
        uploadDate: new Date().toISOString(),
      };
      
      // Validate document data
      const validatedDocumentData = insertPdfDocumentSchema.parse(documentData);
      
      // Save document to storage
      const savedDocument = await storage.createPdfDocument(validatedDocumentData);
      
      // Save each extracted table
      for (const table of tables) {
        await storage.createExtractedTable({
          documentId: savedDocument.id,
          tableIndex: table.tableIndex,
          pageNumber: table.info.pageNumber,
          tableData: table.data,
          tableInfo: table.info
        });
      }
      
      // Return the extracted data
      res.status(200).json({
        documentId: savedDocument.id,
        filename: savedDocument.filename,
        filesize: savedDocument.filesize,
        uploadDate: savedDocument.uploadDate,
        tables,
      });
    } catch (error) {
      console.error('Error extracting tables:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Get all documents
  router.get('/api/documents', async (req: Request, res: Response) => {
    try {
      const documents = await storage.getAllPdfDocuments();
      res.status(200).json(documents);
    } catch (error) {
      console.error('Error fetching documents:', error);
      res.status(500).json({ error: 'Failed to fetch documents' });
    }
  });

  // Get a specific document with its tables
  router.get('/api/documents/:id', async (req: Request, res: Response) => {
    try {
      const documentId = parseInt(req.params.id);
      
      if (isNaN(documentId)) {
        return res.status(400).json({ error: 'Invalid document ID' });
      }
      
      const document = await storage.getPdfDocument(documentId);
      
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }
      
      const tables = await storage.getExtractedTablesByDocumentId(documentId);
      
      res.status(200).json({
        ...document,
        tables,
      });
    } catch (error) {
      console.error('Error fetching document:', error);
      res.status(500).json({ error: 'Failed to fetch document' });
    }
  });

  // Download Excel for a specific table
  router.get('/api/tables/:id/excel', async (req: Request, res: Response) => {
    try {
      const tableId = parseInt(req.params.id);
      
      if (isNaN(tableId)) {
        return res.status(400).json({ error: 'Invalid table ID' });
      }
      
      const table = await storage.getExtractedTable(tableId);
      
      if (!table) {
        return res.status(404).json({ error: 'Table not found' });
      }
      
      // Generate Excel file
      const excelBuffer = await generateExcelFile(table.tableData as TableData);
      
      // Set response headers
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=table-${tableId}.xlsx`);
      
      // Send Excel file
      res.status(200).send(excelBuffer);
    } catch (error) {
      console.error('Error generating Excel:', error);
      res.status(500).json({ error: 'Failed to generate Excel file' });
    }
  });

  // Download consolidated Excel for all tables in a document
  router.get('/api/documents/:id/excel', async (req: Request, res: Response) => {
    try {
      const documentId = parseInt(req.params.id);
      
      if (isNaN(documentId)) {
        return res.status(400).json({ error: 'Invalid document ID' });
      }
      
      const document = await storage.getPdfDocument(documentId);
      
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }
      
      const tables = await storage.getExtractedTablesByDocumentId(documentId);
      
      if (tables.length === 0) {
        return res.status(404).json({ error: 'No tables found in document' });
      }
      
      // Generate consolidated Excel file
      const excelBuffer = await generateConsolidatedExcel(tables.map(table => table.data as TableData));
      
      // Set response headers
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=${document.filename.replace('.pdf', '')}-tables.xlsx`);
      
      // Send Excel file
      res.status(200).send(excelBuffer);
    } catch (error) {
      console.error('Error generating Excel:', error);
      res.status(500).json({ error: 'Failed to generate Excel file' });
    }
  });

  // Register the router
  app.use(router);
  
  // We no longer need to create a server here
  return;
}