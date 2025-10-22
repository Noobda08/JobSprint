const crypto = require('crypto');

function methodNotAllowed(res) {
  res.setHeader('Allow', 'POST');
  res.statusCode = 405;
  res.end(JSON.stringify({ error: 'Method Not Allowed' }));
}

function missingConfig(res) {
  res.statusCode = 500;
  res.end(JSON.stringify({ error: 'Missing Razorpay configuration' }));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';

    req.on('data', (chunk) => {
      data += chunk;
    });

    req.on('end', () => {
      try {
        const parsed = data ? JSON.parse(data) : {};
        resolve(parsed);
      } catch (error) {
        reject(error);
      }
    });

    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return methodNotAllowed(res);
  }

  const { RAZORPAY_KEY_SECRET } = process.env;

  if (!RAZORPAY_KEY_SECRET) {
    return missingConfig(res);
  }

  try {
    const body = await parseBody(req);
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = body || {};

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'Missing verification payload' }));
    }

    const hmac = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const digest = hmac.digest('hex');

    const ok = digest === razorpay_signature;

    res.statusCode = 200;
    res.end(JSON.stringify({ ok }));
  } catch (error) {
    console.error('Failed to verify Razorpay signature', error);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Verification failed' }));
  }
};
