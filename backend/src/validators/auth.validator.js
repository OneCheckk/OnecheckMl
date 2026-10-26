function validateLogin(req) {
  const errors = [];
  const { email, password } = req.body || {};

  if (!email || typeof email !== 'string' || !email.trim()) {
    errors.push({ field: 'email', message: 'Email is required' });
  } else if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
    errors.push({ field: 'email', message: 'Invalid email address format' });
  }

  const env = require('../config/env');
  if (!password || typeof password !== 'string' || !password.trim()) {
    if (!env.DEMO_MODE) {
      errors.push({ field: 'password', message: 'Password is required' });
    }
  }

  return errors;
}

module.exports = {
  validateLogin
};
