// Admin authorization middleware
// Assumes jwtAuth has already run and set req.user

/**
 * Verify the authenticated user has admin role.
 * Must be used after jwtAuth middleware.
 */
function adminAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Authentication required'
    })
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Admin privileges required'
    })
  }

  next()
}

module.exports = adminAuth
