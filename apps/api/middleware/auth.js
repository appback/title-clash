// simple auth middleware to assign anonymous voterId via cookie
const { v4: uuidv4 } = require('uuid')

module.exports = function(req, res, next){
  try{
    const cookie = req.cookies && req.cookies['voterId']
    if (cookie) { req.voterId = cookie; return next() }
    const id = uuidv4()
    res.cookie('voterId', id, { httpOnly: true, sameSite: 'lax' })
    req.voterId = id
    next()
  } catch (e) { next() }
}
