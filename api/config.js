function methodNotAllowed(res) {
  res.setHeader('Allow', 'GET');
  res.statusCode = 405;
  res.end(JSON.stringify({ error: 'Method Not Allowed' }));
}

module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'GET') {
    return methodNotAllowed(res);
  }

  const { NEXT_PUBLIC_RAZORPAY_KEY_ID } = process.env;

  if (!NEXT_PUBLIC_RAZORPAY_KEY_ID) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: 'Missing Razorpay key' }));
  }

  res.statusCode = 200;
  res.end(JSON.stringify({ key: NEXT_PUBLIC_RAZORPAY_KEY_ID }));
};
