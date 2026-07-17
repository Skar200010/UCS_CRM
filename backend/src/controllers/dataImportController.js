import { v4 as uuidv4 } from 'uuid';
import { insertNewDataBatch, getImportBatches, getBatchRecords, getBatchCount, getBatchById, updateNewDataStatus, getAllExistingMobiles } from '../models/newDataModel.js';
import { upsertDonorProfile } from '../models/donorProfileModel.js';
import supabase from '../config/supabase.js';
import {
  parseImportFile,
  getSheetNames,
  dedupRows,
  normalizeDate,
} from '../services/fileParser.js';

export const inspectImport = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'File is required' });
    }
    const sheets = getSheetNames(req.file.buffer);
    return res.json({ sheets });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const uploadImport = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'File is required' });
    }
    const { date, data_source_id, sheets, ngo_ids } = req.body;
    if (!date || !data_source_id) {
      return res.status(400).json({ message: 'Date and data source are required' });
    }

    const sheetFilter = sheets ? (Array.isArray(sheets) ? sheets : sheets.split(',').map(s => s.trim())) : undefined;
    const { rows: extracted, fullSheet } = parseImportFile(req.file.buffer, { sheets: sheetFilter });
    if (extracted.length === 0) {
      return res.status(400).json({ message: 'File is empty or has no data rows' });
    }

    if (fullSheet) {
      for (const r of extracted) {
        r.transaction_date = normalizeDate(r.transaction_date);
        r.birth_date = normalizeDate(r.birth_date);
        r.receipt_date = normalizeDate(r.receipt_date);
      }
    }

    const { deduped, duplicatesRemoved } = dedupRows(extracted);

    // Cross-batch dedup: remove mobiles already existing in any previous import
    const existingMobiles = await getAllExistingMobiles();
    const trulyNew = deduped.filter(r => !existingMobiles.has(r.mobile_number));
    const crossBatchDups = deduped.length - trulyNew.length;

    const { data: allNgos, error: nErr } = await supabase
      .from('ngos')
      .select('id, name')
      .eq('is_active', true);
    if (nErr) throw nErr;

    // Filter NGOs by selected ngo_ids if provided
    let selectedNgos = allNgos;
    if (ngo_ids) {
      const ids = Array.isArray(ngo_ids) ? ngo_ids.map(Number) : ngo_ids.split(',').map(s => Number(s.trim()));
      selectedNgos = allNgos.filter(n => ids.includes(n.id));
    }

    const importBatchId = uuidv4();

    // Send each record to selected NGOs (one row per NGO)
    const ngoNames = selectedNgos.length > 0 ? selectedNgos.map(n => n.name) : ['Default'];
    const dbRows = [];

    for (const r of trulyNew) {
      for (const ngo of ngoNames) {
        const row = {
          data_source_id,
          import_date: date,
          import_batch_id: importBatchId,
          mobile_number: r.mobile_number,
          name: r.name || null,
          category: r.category || '',
          amount: r.amount || 0,
          ngo,
        };
        if (fullSheet) {
          Object.assign(row, {
            transaction_date: r.transaction_date || null,
            bank_donor_name: r.bank_donor_name || null,
            agent_donor_name: r.agent_donor_name || null,
            mobile_2: r.mobile_2 || null,
            address_1: r.address_1 || null,
            address_2: r.address_2 || null,
            city: r.city || null,
            pin_code: r.pin_code || null,
            pan_number: r.pan_number || null,
            email: r.email || null,
            birth_date: r.birth_date || null,
            data_category: r.data_category || null,
            team: r.team || null,
            agent_name: r.agent_name || null,
            mop: r.mop || null,
            received_bank: r.received_bank || null,
            payment_id_no: r.payment_id_no || null,
            donors_bank_name: r.donors_bank_name || null,
            receipt_no: r.receipt_no || null,
            receipt_date: r.receipt_date || null,
            receipt_time: r.receipt_time || null,
            project_supported: r.project_supported || null,
            account_of: r.account_of || null,
            branch: r.branch || null,
            station: r.station || null,
          });
        }
        dbRows.push(row);
      }
    }

    const inserted = await insertNewDataBatch(dbRows);

    // Build per-NGO stats
    const ngoCounts = {};
    for (const row of dbRows) {
      ngoCounts[row.ngo] = (ngoCounts[row.ngo] || 0) + 1;
    }
    const distribution = Object.entries(ngoCounts).map(([name, count]) => `${count} → ${name}`);

    return res.status(201).json({
      message: selectedNgos.length < allNgos.length
        ? `Data imported for ${selectedNgos.length} NGO(s) successfully`
        : 'Data imported and replicated to all active NGOs successfully',
      batch_id: importBatchId,
      total_in_file: extracted.length,
      duplicates_removed: duplicatesRemoved,
      cross_batch_duplicates: crossBatchDups,
      imported: inserted.length,
      distribution: distribution.join('; '),
      ngo_counts: ngoCounts,
      ngos_used: ngoNames.length,
      per_ngo_count: trulyNew.length,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const uploadOldDataImport = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'File is required' });
    }
    const { date, data_source_id, sheets } = req.body;
    if (!date || !data_source_id) {
      return res.status(400).json({ message: 'Date and data source are required' });
    }

    const sheetFilter = sheets ? (Array.isArray(sheets) ? sheets : sheets.split(',').map(s => s.trim())) : undefined;
    const { rows: extracted, fullSheet } = parseImportFile(req.file.buffer, { sheets: sheetFilter });
    if (extracted.length === 0) {
      return res.status(400).json({ message: 'File is empty or has no data rows' });
    }

    if (fullSheet) {
      for (const r of extracted) {
        r.transaction_date = normalizeDate(r.transaction_date);
        r.birth_date = normalizeDate(r.birth_date);
        r.receipt_date = normalizeDate(r.receipt_date);
      }
    }

    // Cross-batch dedup
    const existingMobiles = await getAllExistingMobiles();
    const trulyNew = extracted.filter(r => !existingMobiles.has(r.mobile_number));
    const crossBatchDups = extracted.length - trulyNew.length;

    const { data: ngos, error: nErr } = await supabase
      .from('ngos')
      .select('id, name')
      .eq('is_active', true);
    if (nErr) throw nErr;

    const importBatchId = uuidv4();

    // Send to ALL active NGOs
    const ngoNames = ngos && ngos.length > 0 ? ngos.map(n => n.name) : ['Default'];
    const dbRows = [];

    for (const r of trulyNew) {
      for (const ngo of ngoNames) {
        const row = {
          data_source_id,
          import_date: date,
          import_batch_id: importBatchId,
          mobile_number: r.mobile_number,
          name: r.name || null,
          category: r.category || '',
          amount: r.amount || 0,
          ngo,
        };
        if (fullSheet) {
          Object.assign(row, {
            transaction_date: r.transaction_date || null,
            bank_donor_name: r.bank_donor_name || null,
            agent_donor_name: r.agent_donor_name || null,
            mobile_2: r.mobile_2 || null,
            address_1: r.address_1 || null,
            address_2: r.address_2 || null,
            city: r.city || null,
            pin_code: r.pin_code || null,
            pan_number: r.pan_number || null,
            email: r.email || null,
            birth_date: r.birth_date || null,
            data_category: r.data_category || null,
            team: r.team || null,
            agent_name: r.agent_name || null,
            mop: r.mop || null,
            received_bank: r.received_bank || null,
            payment_id_no: r.payment_id_no || null,
            donors_bank_name: r.donors_bank_name || null,
            receipt_no: r.receipt_no || null,
            receipt_date: r.receipt_date || null,
            receipt_time: r.receipt_time || null,
            project_supported: r.project_supported || null,
            account_of: r.account_of || null,
            branch: r.branch || null,
            station: r.station || null,
          });
        }
        dbRows.push(row);
      }
    }

    const inserted = await insertNewDataBatch(dbRows);

    let profilesCreated = 0;
    const errors = [];
    const BATCH_SIZE = 10;
    // Only create profiles for first NGO entry to avoid duplicates
    const firstNgoName = ngoNames[0] || 'Default';
    for (let i = 0; i < trulyNew.length; i += BATCH_SIZE) {
      const batch = trulyNew.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(row => {
          const profile = {
            mobile_number: row.mobile_number,
            name: row.name || null,
            bank_donor_name: row.bank_donor_name || null,
            agent_donor_name: row.agent_donor_name || null,
            mobile_2: row.mobile_2 || null,
            address_1: row.address_1 || null,
            address_2: row.address_2 || null,
            city: row.city || null,
            pin_code: row.pin_code || null,
            pan_number: row.pan_number || null,
            email: row.email || null,
            birth_date: row.birth_date || null,
            data_category: row.data_category || null,
            team: row.team || null,
            agent_name: row.agent_name || null,
            mop: row.mop || null,
            donors_bank_name: row.donors_bank_name || null,
            project_supported: row.project_supported || null,
            account_of: row.account_of || null,
            raw_data: row,
            import_batch_id: importBatchId,
            category: row.category || '',
            amount: row.amount || 0,
            transaction_date: row.transaction_date || null,
            station: row.station || null,
            ngo: firstNgoName,
          };
          return upsertDonorProfile(profile);
        })
      );
      for (const r of results) {
        if (r.status === 'fulfilled') {
          if (r.value && r.value.first_import_batch_id === importBatchId) profilesCreated++;
        } else {
          errors.push({ row: 'batch item', reason: r.reason?.message || 'Unknown error' });
        }
      }
    }

    return res.status(201).json({
      message: 'Old data imported successfully',
      type: fullSheet ? 'full' : 'quick',
      batch_id: importBatchId,
      total_in_file: extracted.length,
      cross_batch_duplicates: crossBatchDups,
      valid_rows: trulyNew.length,
      imported: inserted.length,
      profiles_created: profilesCreated,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const listImportBatches = async (req, res) => {
  try {
    const batches = await getImportBatches();
    const enriched = await Promise.all(
      batches.map(async (b) => {
        const count = await getBatchCount(b.import_batch_id);
        return { ...b, record_count: count };
      })
    );
    return res.json(enriched);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getImportBatch = async (req, res) => {
  try {
    const batch = await getBatchById(req.params.id);
    if (!batch) return res.status(404).json({ message: 'Batch not found' });
    const records = await getBatchRecords(req.params.id);
    return res.json({ ...batch, records });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const exportBatch = async (req, res) => {
  try {
    const records = await getBatchRecords(req.params.id);
    if (records.length === 0) {
      return res.status(404).json({ message: 'No records found for this batch' });
    }

    const exportData = records.map((r) => ({
      Name: r.name || '',
      Mobile: r.mobile_number,
      Category: r.category,
      Amount: r.amount,
      'Transaction Date': r.transaction_date || '',
      'Bank Donor Name': r.bank_donor_name || '',
      'Agent Donor Name': r.agent_donor_name || '',
      'Mobile 2': r.mobile_2 || '',
      Address: r.address_1 || '',
      City: r.city || '',
      'Pin Code': r.pin_code || '',
      'PAN No': r.pan_number || '',
      Email: r.email || '',
      'Birth Date': r.birth_date || '',
      Team: r.team || '',
      'Agent Name': r.agent_name || '',
      MOP: r.mop || '',
      'Received Bank': r.received_bank || '',
      'Payment ID': r.payment_id_no || '',
      "Donor's Bank": r.donors_bank_name || '',
      'Receipt No': r.receipt_no || '',
      'Receipt Date': r.receipt_date || '',
      Project: r.project_supported || '',
      'Account Of': r.account_of || '',
      Branch: r.branch || '',
    }));

    const XLSX = (await import('xlsx')).default;
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Exported');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=import-batch-${req.params.id}.xlsx`);
    return res.send(buf);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const downloadTestSheet = async (req, res) => {
  try {
    const XLSX = (await import('xlsx')).default;
    const data = [
      { Name: 'Amit Sharma', Mobile: '9876543210', Category: 'NGO001', Amount: 15000 },
      { Name: 'Priya Verma', Mobile: '9876543211', Category: 'NGO002', Amount: 12000 },
      { Name: 'Rahul Singh', Mobile: '9876543212', Category: 'NGO001', Amount: 8000 },
      { Name: 'Sneha Patel', Mobile: '9876543213', Category: 'NGO003', Amount: 20000 },
      { Name: 'Vikram Joshi', Mobile: '9876543214', Category: 'NGO002', Amount: 5000 },
      { Name: 'Amit Sharma', Mobile: '9876543210', Category: 'NGO001', Amount: 18000 },
      { Name: 'Neha Gupta', Mobile: '9876543215', Category: 'NGO001', Amount: 7500 },
      { Name: 'Rahul Singh', Mobile: '9876543212', Category: 'NGO001', Amount: 6000 },
      { Name: 'Deepak Kumar', Mobile: '9876543216', Category: 'NGO003', Amount: 22000 },
      { Name: 'Pooja Mehta', Mobile: '9876543217', Category: 'NGO002', Amount: 3000 },
      { Name: 'Priya Verma', Mobile: '9876543211', Category: 'NGO002', Amount: 14000 },
      { Name: 'Ankit Tiwari', Mobile: '9876543218', Category: 'NGO001', Amount: 9500 },
      { Name: 'Sneha Patel', Mobile: '9876543213', Category: 'NGO003', Amount: 16000 },
      { Name: 'Ravi Desai', Mobile: '9876543219', Category: 'NGO002', Amount: 11000 },
      { Name: 'Kiran Rao', Mobile: '9876543220', Category: 'NGO001', Amount: 6500 },
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Test Data');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=data-import-test.xlsx');
    return res.send(buf);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const copyDonorsToNgos = async (req, res) => {
  try {
    const { source_ngo_id, target_ngo_ids, filter, mobile_numbers } = req.body;
    if (!source_ngo_id || !target_ngo_ids || target_ngo_ids.length === 0) {
      return res.status(400).json({ message: 'source_ngo_id and target_ngo_ids are required' });
    }

    // Get source NGO name
    const { data: sourceNgo } = await supabase.from('ngos').select('name').eq('id', source_ngo_id).single();
    if (!sourceNgo) return res.status(404).json({ message: 'Source NGO not found' });
    const sourceNgoName = sourceNgo.name;

    // Get target NGO names
    const { data: targetNgos } = await supabase.from('ngos').select('id, name').in('id', target_ngo_ids.map(Number));
    if (!targetNgos || targetNgos.length === 0) {
      return res.status(400).json({ message: 'No valid target NGOs found' });
    }

    // Determine which mobiles to copy
    let mobilesToCopy = [];

    if (mobile_numbers && mobile_numbers.length > 0) {
      mobilesToCopy = mobile_numbers;
    } else {
      // Fetch from donor_profiles that have fro_assignments for source NGO
      const { data: donorProfiles } = await supabase
        .from('donor_profiles')
        .select('mobile_number');

      if (!donorProfiles || donorProfiles.length === 0) {
        return res.json({ message: 'No donors found in source NGO', copied: 0, details: [] });
      }

      const allMobiles = donorProfiles.map(d => d.mobile_number).filter(Boolean);
      const uniqueMobiles = [...new Set(allMobiles)];

      if (uniqueMobiles.length === 0) {
        return res.json({ message: 'No donors with mobile numbers found', copied: 0, details: [] });
      }

      // If filter is 'assigned', only include mobiles with fro_assignments for source NGO
      if (filter === 'assigned') {
        const { data: sourceAssignments } = await supabase
          .from('fro_assignments')
          .select('donor_id')
          .eq('ngo_id', source_ngo_id)
          .not('status', 'eq', 'reassigned');

        const assignedDonorIds = new Set((sourceAssignments || []).map(a => a.donor_id));
        const { data: assignedProfiles } = await supabase
          .from('donor_profiles')
          .select('mobile_number')
          .in('id', [...assignedDonorIds]);

        mobilesToCopy = [...new Set((assignedProfiles || []).map(d => d.mobile_number).filter(Boolean))];
      } else if (filter === 'new') {
        const { data: sourceAssignments } = await supabase
          .from('fro_assignments')
          .select('donor_id')
          .eq('ngo_id', source_ngo_id)
          .not('status', 'eq', 'reassigned');

        const assignedDonorIds = new Set((sourceAssignments || []).map(a => a.donor_id));
        const { data: unassignedProfiles } = await supabase
          .from('donor_profiles')
          .select('mobile_number')
          .not('id', 'in', [...assignedDonorIds]);

        mobilesToCopy = [...new Set((unassignedProfiles || []).map(d => d.mobile_number).filter(Boolean))];
      } else {
        mobilesToCopy = uniqueMobiles;
      }
    }

    if (mobilesToCopy.length === 0) {
      return res.json({ message: 'No donors to copy', copied: 0, details: [] });
    }

    // Fetch source new_data rows for these mobiles
    const { data: sourceRows } = await supabase
      .from('new_data')
      .select('*')
      .eq('ngo', sourceNgoName)
      .in('mobile_number', mobilesToCopy);

    if (!sourceRows || sourceRows.length === 0) {
      return res.json({ message: 'No new_data rows found for source NGO', copied: 0, details: [] });
    }

    // Group by mobile to dedup (keep latest row per mobile)
    const latestPerMobile = {};
    for (const row of sourceRows) {
      if (!latestPerMobile[row.mobile_number]) latestPerMobile[row.mobile_number] = row;
    }

    const importBatchId = uuidv4();
    const results = [];

    for (const targetNgo of targetNgos) {
      // Check which mobiles already exist for target NGO
      const { data: existingTarget } = await supabase
        .from('new_data')
        .select('mobile_number')
        .eq('ngo', targetNgo.name);

      const existingTargetMobiles = new Set((existingTarget || []).map(r => r.mobile_number));

      const toInsert = [];
      for (const mobile of mobilesToCopy) {
        if (!existingTargetMobiles.has(mobile)) {
          const sourceRow = latestPerMobile[mobile];
          if (sourceRow) {
            const row = { ...sourceRow };
            delete row.id;
            delete row.created_at;
            row.ngo = targetNgo.name;
            row.import_batch_id = importBatchId;
            row.status = null;
            toInsert.push(row);
          }
        }
      }

      if (toInsert.length > 0) {
        await insertNewDataBatch(toInsert);
      }
      results.push({ ngo: targetNgo.name, ngo_id: targetNgo.id, copied: toInsert.length });
    }

    return res.json({
      message: `Copied donors to ${targetNgos.length} NGO(s)`,
      batch_id: importBatchId,
      total_mobiles: mobilesToCopy.length,
      details: results,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const downloadSample = async (req, res) => {
  try {
    const XLSX = (await import('xlsx')).default;
    const full = [
      {
        'Transaction Date': '01-04-2025',
        'Bank Donar Name': 'Rajesh Kumar',
        'Agent donar name': 'Amit Sharma',
        'Mobile No.': '9876543210',
        'Address-1': '123, MG Road',
        'Address-2': 'Near Market',
        City: 'Mumbai',
        'Pin Code': '400001',
        'Pan. No.': 'ABCDE1234F',
        'Mail Id': 'rajesh@email.com',
        'Birth Date': '15-08-1985',
        'Data Category': 'NGO001',
        Amount: 15000,
      },
    ];
    const ws = XLSX.utils.json_to_sheet(full);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sample');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=data-import-sample.xlsx');
    return res.send(buf);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};


