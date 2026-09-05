// Shared session contract; dependencies are injected for isolated verification.
export async function verifySessionToken(token, { verifyJwt, findUser }) {
  const fail = (statusCode, message) => { throw Object.assign(new Error(message), { statusCode }); };
  if (!token) fail(401, 'Access token required');
  let decoded;
  try {
    decoded = verifyJwt(token);
    if (!Number.isInteger(decoded?.id) || decoded.id < 1) throw new Error('Invalid identity');
  } catch { fail(403, 'Invalid or expired token'); }
  let current;
  try { current = await findUser(decoded.id); }
  catch { fail(503, 'Authorization service unavailable'); }
  if (!current || !current.active) fail(403, 'Account is inactive or no longer exists');
  if (Number(decoded.tokenVersion || 0) !== current.tokenVersion) {
    fail(403, 'Session has been revoked. Please sign in again.');
  }
  return { ...decoded, ...current };
}
