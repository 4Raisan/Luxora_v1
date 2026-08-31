const USERS = [
  {
    id: 'usr_admin_01',
    email: 'admin@luxora.lk',
    password: 'admin123',
    name: 'Luxora Operations Admin',
    role: 'admin',
    redirectUrl: '/admin.html'
  },
  {
    id: 'usr_cust_01',
    email: 'customer@luxora.lk',
    password: 'customer123',
    name: 'Kausika & Family',
    role: 'customer',
    redirectUrl: '/dashboard.html'
  },
  {
    id: 'usr_cust_02',
    email: 'alexander@luxora.lk',
    password: 'admin123', // Allow standard test password too
    name: 'Alexander Wright',
    role: 'customer',
    redirectUrl: '/dashboard.html'
  }
];

// Active sessions in memory
const activeSessions = new Map();

module.exports = {
  login: (email, password) => {
    const cleanEmail = (email || '').trim().toLowerCase();
    const user = USERS.find(u => u.email.toLowerCase() === cleanEmail && u.password === password);

    if (!user) {
      return { success: false, error: 'Invalid email or password' };
    }

    const token = 'tok_' + Math.random().toString(36).substring(2) + Date.now();
    const sessionData = {
      token,
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      redirectUrl: user.redirectUrl,
      createdAt: new Date().toISOString()
    };

    activeSessions.set(token, sessionData);

    return {
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      redirectUrl: user.redirectUrl
    };
  },

  verifyToken: (token) => {
    if (!token) return null;
    return activeSessions.get(token) || null;
  },

  logout: (token) => {
    if (token) {
      activeSessions.delete(token);
    }
    return { success: true };
  }
};
