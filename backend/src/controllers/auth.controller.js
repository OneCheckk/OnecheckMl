const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/auth.service');

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const requestId = res.locals.requestId || req.id;
  const result = await authService.login(email, password, requestId);

  res.status(200).json({
    success: true,
    data: result,
    meta: {
      requestId
    }
  });
});

const getMe = asyncHandler(async (req, res) => {
  const requestId = res.locals.requestId || req.id;
  const user = await authService.getCurrentUser(req.user._id);

  res.status(200).json({
    success: true,
    data: { user },
    meta: {
      requestId
    }
  });
});

module.exports = {
  login,
  getMe
};
