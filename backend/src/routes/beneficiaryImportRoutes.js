import { Router } from 'express';
import { authenticateRole, authenticate } from '../middleware/authMiddleware.js';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { createImportBatch, getImportBatch, updateImportBatch, addImportRows, getImportRows, updateImportRow, listImportBatches } from '../models/importBatchModel.js';
import { generateBeneficiaryCode, createBeneficiary } from '../models/beneficiaryModel.js';
import { addSourceRecord, findByOriginalData } from '../models/beneficiarySourceModel.js';
import { logAuditEvent } from '../models/auditLogModel.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const router = Router();

// Upload and parse Excel
router.post('/upload', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetNames = workbook.SheetNames;

    // Parse each sheet and count rows
    const sheets = {};
    for (const name of sheetNames) {
      const data = XLSX.utils.sheet_to_json(workbook.Sheets[name]);
      sheets[name] = { rows: data.length, headers: data.length > 0 ? Object.keys(data[0]) : [] };
    }

    // Create import batch
    const batch = await createImportBatch({
      file_name: req.file.originalname,
      total_rows: Object.values(sheets).reduce((sum, s) => sum + s.rows, 0),
      status: 'PENDING',
      imported_by: req.user?.name || req.user?.email || 'system',
    });

    return res.status(201).json({
      batch,
      sheets: Object.entries(sheets).map(([name, info]) => ({
        name, rows: info.rows, headers: info.headers,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// Map columns and preview
router.post('/:batchId/preview', authenticate, async (req, res) => {
  try {
    const batch = await getImportBatch(req.params.batchId);
    if (!batch) return res.status(404).json({ message: 'Batch not found' });

    const { sheet_name, column_mapping } = req.body;
    // column_mapping: { beneficiary_full_name: 'A', mobile: 'B', ... }

    // Re-read the file to get data
    // For now, return placeholder - full implementation would re-read from S3
    return res.json({
      batch,
      message: 'Preview ready',
      column_mapping,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// Import rows from batch
router.post('/:batchId/confirm', authenticate, async (req, res) => {
  try {
    const batch = await getImportBatch(req.params.batchId);
    if (!batch) return res.status(404).json({ message: 'Batch not found' });

    const { rows } = req.body;
    if (!rows || !Array.isArray(rows)) {
      return res.status(400).json({ message: 'rows array is required' });
    }

    const created_by = req.user?.name || req.user?.email || 'system';
    let validCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;
    const importedBeneficiaries = [];

    for (const row of rows) {
      try {
        // Check for duplicates
        const duplicates = await findByOriginalData({
          mobile: row.mobile,
          full_name: row.full_name,
          date_of_birth: row.date_of_birth,
        });

        if (duplicates.length > 0) {
          duplicateCount++;
          await addImportRows([{
            batch_id: batch.id,
            row_number: row._rowNumber || 0,
            raw_data: JSON.stringify(row),
            mapped_data: JSON.stringify(row),
            status: 'DUPLICATE',
            validation_errors: JSON.stringify({ duplicates: duplicates.map(d => d.beneficiary_code) }),
          }]);
          continue;
        }

        const beneficiary_code = await generateBeneficiaryCode();
        const beneficiary = await createBeneficiary({
          beneficiary_code,
          full_name: row.full_name || row.name || '',
          first_name: row.first_name,
          last_name: row.last_name,
          date_of_birth: row.date_of_birth || null,
          gender: row.gender,
          mobile: row.mobile,
          alternate_mobile: row.alternate_mobile,
          email: row.email,
          address_line_1: row.address || row.address_line_1,
          city: row.city,
          district: row.district,
          state: row.state,
          pincode: row.pincode,
          status: row.status || 'ACTIVE',
          ngo_id: req.user?.ngo_id || null,
          created_by, updated_by: created_by,
        });

        await addSourceRecord(beneficiary.id, {
          source_type: 'IMPORT',
          source_file: batch.file_name,
          original_name: row.full_name || row.name,
          original_data: JSON.stringify(row),
          import_batch_id: batch.id,
        });

        await logAuditEvent({
          entity_type: 'beneficiary', entity_id: beneficiary.id,
          beneficiary_id: beneficiary.id, action: 'IMPORTED',
          details: { batch_id: batch.id, beneficiary_code },
          performed_by: created_by,
        });

        validCount++;
        importedBeneficiaries.push(beneficiary);
      } catch (err) {
        errorCount++;
        await addImportRows([{
          batch_id: batch.id,
          row_number: row._rowNumber || 0,
          raw_data: JSON.stringify(row),
          status: 'ERROR',
          validation_errors: JSON.stringify({ error: err.message }),
        }]);
      }
    }

    await updateImportBatch(batch.id, {
      valid_rows: validCount,
      duplicate_rows: duplicateCount,
      error_rows: errorCount,
      status: 'COMPLETED',
      imported_at: new Date().toISOString(),
    });

    return res.json({
      message: 'Import completed',
      valid: validCount,
      duplicates: duplicateCount,
      errors: errorCount,
      beneficiaries: importedBeneficiaries,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// List batches
router.get('/', authenticate, async (req, res) => {
  try {
    const { page, pageSize } = req.query;
    const result = await listImportBatches({ page: parseInt(page) || 1, pageSize: parseInt(pageSize) || 25 });
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// Get batch detail
router.get('/:batchId', authenticate, async (req, res) => {
  try {
    const batch = await getImportBatch(req.params.batchId);
    if (!batch) return res.status(404).json({ message: 'Batch not found' });
    const rows = await getImportRows(batch.id);
    return res.json({ batch, rows });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

export default router;
