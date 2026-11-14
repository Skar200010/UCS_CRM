import { Router } from 'express';
import {
  sendReceipt,
  sendDirect,
  serveReceiptFile,
  test,
  status,
  sendNgoInfo,
  sendCustomTemplate,
  listTemplates,
  sendBulkTemplate,
  listBulkRecipientStatuses,
  getAccountHealth,
  listCampaigns,
  getCampaign,
  createCampaign,
  getCampaignProgress,
  cancelCampaign,
  resumeCampaign,
  validateWhatsAppContacts,
  getConversationByPhone,
  listChats,
  markChatRead,
  sendText,
  sendMedia,
} from '../controllers/whatsappController.js';
import { getStations, getDonorsByStation, getAccessibleNgos } from '../controllers/ngoAdminController.js';
import { authenticateRole } from '../middleware/authMiddleware.js';

const router = Router();

const whatsappUser = authenticateRole('accounts', 'super_admin', 'admin', 'master', 'user');
const whatsappAdmin = authenticateRole('accounts', 'super_admin');

router.post('/send-receipt/:logId', whatsappAdmin, sendReceipt);
router.post('/send-direct', whatsappAdmin, sendDirect);

// Connection test / health for the Templates & Settings screen.
router.post('/test', whatsappAdmin, test);
router.get('/status', whatsappAdmin, status);

// Ad-hoc sends kept for the older receipt / NGO-info flows.
router.post('/send-ngo-info', whatsappAdmin, sendNgoInfo);
router.post('/send-template', whatsappAdmin, sendCustomTemplate);

// Templates used by the WhatsApp Center (Bulk send, Campaigns, Delivery log).
router.get('/templates', authenticateRole('accounts', 'super_admin', 'admin'), listTemplates);

// Bulk send + campaigns.
router.post('/send-bulk-template', whatsappUser, sendBulkTemplate);
router.post('/validate-contacts', authenticateRole('accounts', 'super_admin', 'admin', 'master', 'user', 'fro', 'agent'), validateWhatsAppContacts);
router.get('/bulk/statuses', whatsappUser, listBulkRecipientStatuses);

// Recipient pickers for the "Station / Donor" mode of Bulk send.
router.get('/bulk/stations', whatsappUser, getStations);
router.get('/bulk/ngos', whatsappUser, getAccessibleNgos);
router.get('/bulk/donors-by-station', whatsappUser, getDonorsByStation);

router.post('/campaigns', whatsappUser, createCampaign);
router.get('/campaigns', whatsappUser, listCampaigns);
router.get('/campaigns/:id', whatsappUser, getCampaign);
router.get('/campaigns/:id/progress', whatsappUser, getCampaignProgress);
router.post('/campaigns/:id/cancel', whatsappUser, cancelCampaign);
router.post('/campaigns/:id/resume', whatsappUser, resumeCampaign);

// Chats tab: conversation list, thread fetch and free-text / media replies.
router.get('/chats', whatsappUser, listChats);
router.post('/chats/:phone/read', whatsappUser, markChatRead);
router.post('/send-text', whatsappUser, sendText);
router.post('/send-media', whatsappUser, sendMedia);
router.get('/conversations/:phone', whatsappUser, getConversationByPhone);

// Per-account health card shown in Bulk send.
router.get('/accounts/:accountId/health', authenticateRole('accounts', 'super_admin', 'admin', 'master', 'user', 'fro', 'agent'), getAccountHealth);

// Meta fetches the template's HEADER document with a plain GET and cannot
// present a session token, so this route is deliberately unauthenticated. The
// HMAC-signed, expiring token in the URL is the authorisation -- it is verified
// before any storage call, and a rejected token answers 404 so the endpoint
// cannot be used to probe which receipt keys exist.
router.get('/receipt-file/:token', serveReceiptFile);

export default router;
