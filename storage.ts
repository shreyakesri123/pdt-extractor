import { 
  users, type User, type InsertUser,
  pdfDocuments, type PdfDocument, type InsertPdfDocument,
  extractedTables, type ExtractedTable, type InsertExtractedTable,
  type ExtractedTableData, type TableData, type TableInfo
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // PDF document methods
  getPdfDocument(id: number): Promise<PdfDocument | undefined>;
  getAllPdfDocuments(): Promise<PdfDocument[]>;
  createPdfDocument(document: InsertPdfDocument): Promise<PdfDocument>;
  
  // Extracted table methods
  getExtractedTable(id: number): Promise<ExtractedTable | undefined>;
  getExtractedTablesByDocumentId(documentId: number): Promise<ExtractedTableData[]>;
  createExtractedTable(table: InsertExtractedTable): Promise<ExtractedTable>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }
  
  // PDF document methods
  async getPdfDocument(id: number): Promise<PdfDocument | undefined> {
    const [document] = await db.select().from(pdfDocuments).where(eq(pdfDocuments.id, id));
    return document;
  }
  
  async getAllPdfDocuments(): Promise<PdfDocument[]> {
    // Sort by upload date, most recent first
    return await db.select().from(pdfDocuments).orderBy(desc(pdfDocuments.uploadDate));
  }
  
  async createPdfDocument(document: InsertPdfDocument): Promise<PdfDocument> {
    const [pdfDocument] = await db
      .insert(pdfDocuments)
      .values({
        filename: document.filename,
        filesize: document.filesize,
        userId: document.userId || null
      })
      .returning();
    return pdfDocument;
  }
  
  // Extracted table methods
  async getExtractedTable(id: number): Promise<ExtractedTable | undefined> {
    const [table] = await db.select().from(extractedTables).where(eq(extractedTables.id, id));
    return table;
  }
  
  async getExtractedTablesByDocumentId(documentId: number): Promise<ExtractedTableData[]> {
    const tables = await db
      .select()
      .from(extractedTables)
      .where(eq(extractedTables.documentId, documentId))
      .orderBy(extractedTables.tableIndex);
    
    // Convert to ExtractedTableData format
    return tables.map(table => {
      return {
        tableIndex: table.tableIndex,
        data: table.tableData as TableData,
        info: table.tableInfo as TableInfo
      };
    });
  }
  
  async createExtractedTable(table: InsertExtractedTable): Promise<ExtractedTable> {
    const [extractedTable] = await db
      .insert(extractedTables)
      .values(table)
      .returning();
    return extractedTable;
  }
}

// Use DatabaseStorage instead of MemStorage for data persistence
export const storage = new DatabaseStorage();
