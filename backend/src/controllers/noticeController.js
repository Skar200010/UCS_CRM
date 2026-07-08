import {
  createNotice,
  getAllNotices,
  getNoticeById,
  updateNotice,
  deleteNotice,
} from '../models/noticeModel.js';

export const addNotice = async (req, res) => {
  try {
    const { title, content, target_role } = req.body;
    if (!title || !content) {
      return res.status(400).json({ message: 'Title and content are required' });
    }
    const notice = await createNotice({
      title,
      content,
      target_role: target_role || 'all',
      ngo_id: req.user.ngo_id || req.body.ngo_id || null,
      created_by: req.user.id,
      created_by_name: req.user.name || null,
    });
    return res.status(201).json({ message: 'Notice created', notice });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const listNotices = async (req, res) => {
  try {
    const ngoId = req.user.role === 'super_admin' ? req.query.ngo_id : req.user.ngo_id;
    const notices = await getAllNotices(ngoId, req.query.target_role);
    return res.json(notices);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getNotice = async (req, res) => {
  try {
    const notice = await getNoticeById(req.params.id);
    if (!notice) return res.status(404).json({ message: 'Notice not found' });
    return res.json(notice);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const editNotice = async (req, res) => {
  try {
    const { title, content, is_active } = req.body;
    const updates = {};
    if (title) updates.title = title;
    if (content) updates.content = content;
    if (is_active !== undefined) updates.is_active = is_active;
    const notice = await updateNotice(req.params.id, updates);
    return res.json({ message: 'Notice updated', notice });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const removeNotice = async (req, res) => {
  try {
    const result = await deleteNotice(req.params.id);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
