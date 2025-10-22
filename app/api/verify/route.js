import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request) {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keySecret) {
    console.error('Missing Razorpay key secret');
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch (error) {
    console.error('Invalid JSON payload', error);
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = payload;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  const generatedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  const ok = generatedSignature === razorpay_signature;

  return NextResponse.json({ ok });
}

export function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}
