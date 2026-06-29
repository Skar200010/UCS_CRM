import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { getWorkerByLoginId } from '../models/workerModel.js';
import { getUserByEmail, getUserByName } from '../models/userModel.js';
import { getHRByEmail } from '../models/hrModel.js';

dotenv.config();

export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (
      email === process.env.ADMIN_EMAIL &&
      password === process.env.ADMIN_PASSWORD
    ) {
      const token = jwt.sign(
        { email, role: 'super_admin', name: 'Super Admin' },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      return res.json({ token, role: 'super_admin', user: { name: 'Super Admin', email, role: 'super_admin' }, message: 'Login successful' });
    }
    return res.status(401).json({ message: 'Invalid admin credentials' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const unifiedLogin = async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ message: 'Identifier and password are required' });
    }

    const isEmail = identifier.includes('@');

    if (isEmail) {
      if (
        identifier === process.env.ADMIN_EMAIL &&
        password === process.env.ADMIN_PASSWORD
      ) {
        const token = jwt.sign(
          { email: identifier, role: 'super_admin', name: 'Super Admin' },
          process.env.JWT_SECRET,
          { expiresIn: '7d' }
        );
        return res.json({ token, role: 'super_admin', user: { name: 'Super Admin', email: identifier, role: 'super_admin' }, message: 'Login successful' });
      }

      const user = await getUserByEmail(identifier);
      if (user) {
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
          return res.status(401).json({ message: 'Invalid password' });
        }
        const token = jwt.sign(
          { id: user.id, ngo_id: user.ngo_id, email: user.email, role: user.role, name: user.name },
          process.env.JWT_SECRET,
          { expiresIn: '7d' }
        );
        const { password_hash, ...safeUser } = user;
        return res.json({ token, role: user.role, user: safeUser, message: 'Login successful' });
      }

      const hr = await getHRByEmail(identifier);
      if (hr) {
        const isMatch = await bcrypt.compare(password, hr.password_hash);
        if (!isMatch) {
          return res.status(401).json({ message: 'Invalid password' });
        }
        const token = jwt.sign(
          { id: hr.id, ngo_id: hr.ngo_id, email: hr.email, role: 'hr', name: hr.name },
          process.env.JWT_SECRET,
          { expiresIn: '7d' }
        );
        const { password_hash, ...safeHR } = hr;
        return res.json({ token, role: 'hr', user: safeHR, message: 'Login successful' });
      }

      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const userFromName = await getUserByName(identifier);
    if (userFromName) {
      const isMatch = await bcrypt.compare(password, userFromName.password_hash);
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid password' });
      }
      const token = jwt.sign(
        { id: userFromName.id, ngo_id: userFromName.ngo_id, email: userFromName.email, role: userFromName.role, name: userFromName.name },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      const { password_hash, ...safeUser } = userFromName;
      return res.json({ token, role: userFromName.role, user: safeUser, message: 'Login successful' });
    }

    const worker = await getWorkerByLoginId(identifier);
    if (!worker) {
      return res.status(401).json({ message: 'Invalid login ID' });
    }
    const isMatch = await bcrypt.compare(password, worker.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid password' });
    }
    const dept = (worker.department || '').toLowerCase().trim();
    let role;
    if (dept === 'hr') role = 'hr';
    else if (dept.includes('recruit')) role = 'recruiter';
    else if (dept === 'admin') role = 'accounts';
    else if (dept === 'fro') role = 'fro';
    else role = 'worker';
    const token = jwt.sign(
      { id: worker.id, login_id: worker.login_id, ngo_id: worker.ngo_id, role, department: worker.department },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    return res.json({
      token,
      role,
      user: { id: worker.id, name: worker.name, email: worker.email, login_id: worker.login_id, ngo_id: worker.ngo_id, gender: worker.gender, dob: worker.dob, department: worker.department },
      message: 'Login successful',
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
