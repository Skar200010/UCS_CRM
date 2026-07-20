import { getAllUserSettings, upsertUserSetting } from '../models/userSettingsModel.js';

export const getUserSettings = async (req, res) => {
  try {
    const settings = await getAllUserSettings(req.user.id);
    return res.json(settings);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateUserSettings = async (req, res) => {
  try {
    const updates = req.body;
    for (const [key, value] of Object.entries(updates)) {
      await upsertUserSetting(req.user.id, key, String(value));
    }
    const settings = await getAllUserSettings(req.user.id);
    return res.json({ message: 'Settings updated', settings });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
