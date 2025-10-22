const Razorpay = require('razorpay');

const AMOUNT = 99900;
const CURRENCY = 'INR';

function methodNotAllowed(res) {
  res.setHeader('Allow', 'POST');
  res.statusCode = 405;
  res.end(JSON.stringify({ error: 'Method Not Allowed' }));
}

function missingConfig(res) {
  res.statusCode = 500;
  res.end(JSON.stringify({ error: 'Missing Razorpay configuration' }));
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return methodNotAllowed(res);
  }

  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env;

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return missingConfig(res);
  }

  try {
    const razorpay = new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET,
    });

    const order = await razorpay.orders.create({
      amount: AMOUNT,
      currency: CURRENCY,
      receipt: `jobsprint_${Date.now()}`,
    });

    res.statusCode = 200;
    res.end(
      JSON.stringify({
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
      })
    );
  } catch (error) {
    console.error('Failed to create Razorpay order', error);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Failed to create order' }));
  }
};
