import { getAdmin } from '../routes/admin-auth.routes.js';
export async function requireAdminSession(req, res, next) {
  try {
    const user = await getAdmin(req);
    if (!user) return res.status(401).json({ message: 'Administrator session required.' });
    req.user = user;
    next();
  } catch (error) {
    console.error('Admin session verification:', error);
    res.status(500).json({ message: 'Admin session verification unavailable.' });
  }
}
