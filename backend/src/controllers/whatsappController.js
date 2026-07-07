import { sendDocumentMessage, sendReceiptMessage, sendTextMessage, testConnection } from '../services/whatsappService.js';
import supabase from '../config/supabase.js';

export async function test(req, res) {
  try {
    const { to } = req.body;
    if (!to) return res.status(400).json({ message: 'Phone number is required' });

    const result = await sendTextMessage(to, 'WhatsApp API is working! - UFS CRM');
    return res.json({ success: true, message: 'Test message sent', data: result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function sendReceipt(req, res) {
  try {
    const { logId } = req.params;
    const { mobile, number, pdfBase64, receiptNo: clientReceiptNo, donorName: clientDonorName, amount: clientAmount } = req.body;
    const phone = mobile || number;

    if (!phone) return res.status(400).json({ message: 'Donor phone number is required' });

    let donorName = clientDonorName || 'Donor';
    let amount = clientAmount || 0;
    let receiptNo = clientReceiptNo || 'N/A';

    if (!clientDonorName || !clientReceiptNo) {
      const { data: log, error: logError } = await supabase
        .from('fro_donor_logs')
        .select(`
          amount_collected,
          fro_assignments(
            donor_id,
            donor_profiles(id, name, mobile_number)
          )
        `)
        .eq('id', logId)
        .single();

      if (!logError && log) {
        const assignment = Array.isArray(log.fro_assignments) ? log.fro_assignments[0] : log.fro_assignments;
        const donor = Array.isArray(assignment?.donor_profiles) ? assignment?.donor_profiles[0] : assignment?.donor_profiles;
        if (!clientDonorName) donorName = donor?.name || 'Donor';
        if (!clientAmount) amount = log.amount_collected || 0;
      }

      if (!clientReceiptNo) {
        const { data: receipt } = await supabase
          .from('receipts')
          .select('receipt_no')
          .eq('log_id', logId)
          .maybeSingle();
        receiptNo = receipt?.receipt_no || 'N/A';
      }
    }

    const date = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

    let documentUrl = null;
    if (pdfBase64) {
      try {
        const buffer = Buffer.from(pdfBase64, 'base64');
        const fileName = `receipts/${logId}_${Date.now()}.pdf`;

        let { data: uploadData, error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(fileName, buffer, { contentType: 'application/pdf', upsert: true });

        if (uploadError) {
          if (uploadError.message?.includes('bucket')) {
            await supabase.storage.createBucket('receipts', { public: true });
            const retry = await supabase.storage
              .from('receipts')
              .upload(fileName, buffer, { contentType: 'application/pdf', upsert: true });
            uploadData = retry.data;
            uploadError = retry.error;
          }
        }

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage
            .from('receipts')
            .getPublicUrl(fileName);
          documentUrl = publicUrlData?.publicUrl;
        }
      } catch (e) {
        console.error('Receipt PDF upload failed:', e.message);
      }
    }

    const results = [];
    if (documentUrl) {
      const safeName = String(receiptNo).replace(/[/\\]/g, '_');
      const docResult = await sendDocumentMessage(phone, documentUrl, `Receipt ${receiptNo} - ${date}`, `receipt_${safeName}.pdf`);
      results.push(docResult);
    } else {
      const textResult = await sendReceiptMessage(phone, donorName, amount, receiptNo, date);
      results.push(textResult);
    }

    return res.json({ success: true, message: documentUrl ? 'Receipt PDF sent via WhatsApp' : 'Receipt text sent via WhatsApp', data: results });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function status(req, res) {
  try {
    const result = await testConnection();
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
