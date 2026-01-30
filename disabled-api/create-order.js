const Razorpay = require('razorpay');

const PLANS = {
  lite: {
    amount: 100,
    notes: { product: 'JobSprint Lite 30 days' },
  },
  sprint: {
    amount: 99900,
    notes: { product: 'JobSprint 90 days' },
  },
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      res.status(400).json({ error: 'Invalid request payload' });
      return;
    }
  }

  const { plan } = body || {};
  const planConfig = PLANS[plan];

  if (!planConfig) {
    res.status(400).json({ error: 'Invalid plan selected' });
    return;
  }

  try {
    const rzp = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const order = await rzp.orders.create({
      amount: planConfig.amount,              // Amount in paise
      currency: 'INR',
      receipt: `jobsprint_${plan}_${Date.now()}`,
      payment_capture: 1,
      notes: planConfig.notes,
    });

    res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      plan,
      keyId: process.env.RAZORPAY_KEY_ID, // safe to expose
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create order' });
  }
};
