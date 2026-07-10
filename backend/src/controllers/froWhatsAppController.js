import {
  getFroConversations,
  getConversationMessages,
  sendFroReply,
  sendDirectMessage,
  markConversationRead,
  getFroUnreadCount,
} from '../services/froWhatsAppService.js';

export async function listConversations(req, res) {
  try {
    const conversations = await getFroConversations(req.user.id);
    return res.json(conversations);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function listMessages(req, res) {
  try {
    const { id } = req.params;
    const messages = await getConversationMessages(id);
    return res.json(messages);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function sendMessage(req, res) {
  try {
    const { id } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Message text is required' });
    }

    const message = await sendFroReply(id, req.user.id, text.trim());
    return res.json({ success: true, message });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function sendDirect(req, res) {
  try {
    const { phone, text } = req.body;
    if (!phone || !text || !text.trim()) {
      return res.status(400).json({ message: 'Phone and text are required' });
    }

    const result = await sendDirectMessage(req.user.id, phone, text.trim());
    return res.json({ success: true, ...result });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function markRead(req, res) {
  try {
    const { id } = req.params;
    await markConversationRead(id, req.user.id);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

export async function unreadCount(req, res) {
  try {
    const count = await getFroUnreadCount(req.user.id);
    return res.json({ count });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}
