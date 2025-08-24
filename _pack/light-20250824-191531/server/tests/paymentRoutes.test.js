// server/tests/paymentRoutes.test.js
const request = require('supertest');
const app = require('../app');
const stripe = require('stripe');
const paypalSDK = require('@paypal/checkout-server-sdk');
const { Subscription } = require('../models/Subscription');

// Mock authentication middleware to set req.userId
jest.mock('../middleware/auth', () => jest.fn((req, res, next) => { req.userId = 'user123'; next(); }));
// Mock Stripe and PayPal SDKs
jest.mock('stripe');
jest.mock('@paypal/checkout-server-sdk');
// Mock Subscription model
jest.mock('../models/Subscription', () => ({ Subscription: { create: jest.fn() } }));

describe('Payment Routes', () => {
  let mockStripeClient;
  let mockExecute;

  beforeAll(() => {
    // Stripe mock setup
    mockStripeClient = { checkout: { sessions: { create: jest.fn() } } };
    stripe.mockReturnValue(mockStripeClient);

    // PayPal mock setup
    mockExecute = jest.fn();
    const mockPayPal = {
      core: {
        SandboxEnvironment: jest.fn(),
        PayPalHttpClient: jest.fn(() => ({ execute: mockExecute }))
      },
      orders: {
        OrdersCreateRequest: jest.fn(() => ({ prefer: jest.fn(), requestBody: jest.fn() })),
        OrdersCaptureRequest: jest.fn(() => ({ requestBody: jest.fn() }))
      },
      notification: {
        WebhookEventVerifySignatureRequest: jest.fn(() => ({ requestBody: jest.fn() }))
      }
    };
    // Apply mocks to paypalSDK export
    paypalSDK.core = mockPayPal.core;
    paypalSDK.orders = mockPayPal.orders;
    paypalSDK.notification = mockPayPal.notification;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/payment/stripe-session', () => {
    it('should return url of new checkout session', async () => {
      mockStripeClient.checkout.sessions.create.mockResolvedValue({ url: 'https://stripe.com/session' });

      const res = await request(app)
        .post('/api/payment/stripe-session')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(res.body).toHaveProperty('url', 'https://stripe.com/session');
      expect(mockStripeClient.checkout.sessions.create).toHaveBeenCalledWith({
        payment_method_types: ['card'],
        mode: 'subscription',
        line_items: [{ price: process.env.STRIPE_PREMIUM_PRICE_ID, quantity: 1 }],
        metadata: { userId: 'user123' },
        success_url: `${process.env.CLIENT_URL}/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.CLIENT_URL}/subscription-cancel`
      });
    });
  });

  describe('POST /api/payment/paypal-order', () => {
    it('should create a PayPal order and return id', async () => {
      mockExecute.mockResolvedValue({ result: { id: 'PAYPAL_ORDER_ID' } });

      const res = await request(app)
        .post('/api/payment/paypal-order')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(res.body).toHaveProperty('id', 'PAYPAL_ORDER_ID');
      expect(paypalSDK.orders.OrdersCreateRequest).toHaveBeenCalled();
    });
  });

  describe('POST /api/payment/paypal-capture', () => {
    it('should capture PayPal order and record subscription', async () => {
      const captureResult = { result: { status: 'COMPLETED', id: 'CAPTURE_ID', foo: 'bar' } };
      mockExecute.mockResolvedValue(captureResult);

      const res = await request(app)
        .post('/api/payment/paypal-capture')
        .send({ orderID: 'ORDER_ID' })
        .expect(200)
        .expect('Content-Type', /json/);

      expect(res.body).toHaveProperty('status', 'COMPLETED');
      expect(res.body).toHaveProperty('details', captureResult.result);
      expect(Subscription.create).toHaveBeenCalledWith({
        user: 'user123',
        plan: 'premium',
        provider: 'paypal',
        subscriptionId: 'CAPTURE_ID'
      });
      expect(paypalSDK.orders.OrdersCaptureRequest).toHaveBeenCalledWith('ORDER_ID');
    });
  });

  describe('POST /api/payment/paypal-webhook', () => {
    it('should verify webhook and respond 200 on success', async () => {
      mockExecute.mockResolvedValue({ result: { verification_status: 'SUCCESS' } });
      const eventBody = { event_type: 'PAYMENT.CAPTURE.COMPLETED' };

      await request(app)
        .post('/api/payment/paypal-webhook')
        .set('paypal-transmission-id', 'TRANSMISSION_ID')
        .set('paypal-transmission-time', 'TIME')
        .set('paypal-cert-url', 'CERT_URL')
        .set('paypal-auth-algo', 'SHA256')
        .set('paypal-transmission-sig', 'SIG')
        .send(JSON.stringify(eventBody))
        .set('Content-Type', 'application/json')
        .expect(200);
    });
  });
});
