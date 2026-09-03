// Self-hosted API documentation: serves an OpenAPI 3 spec at /api/openapi.json
// and a Swagger UI page at /api/docs (Swagger UI assets loaded from CDN — no npm deps).
import { Router } from 'express';
import { PORT } from '../config/env.js';

const router = Router();

const bearer = [{ bearerAuth: [] }];

const spec = {
  openapi: '3.0.0',
  info: {
    title: 'Luxora Home Concierge REST API',
    version: '1.1.0',
    description: 'Curated REST API reference for Luxora. backend/src/routes remains authoritative for the complete contract.',
  },
  servers: [{ url: `/api`, description: 'Current host' }, { url: `http://localhost:${PORT}/api`, description: 'Local development' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: { type: 'object', properties: { error: { type: 'string' } } },
    },
  },
  paths: {
    '/auth/register': {
      post: {
        tags: ['Auth'], summary: 'Register a customer or provider account',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: {
          name: { type: 'string' }, email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 6 },
          phone: { type: 'string' }, role: { type: 'string', enum: ['customer', 'provider'] }, nic: { type: 'string' }, category: { type: 'string' },
        } } } } },
        responses: { '201': { description: 'Created (returns JWT)' }, '400': { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } } },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'], summary: 'Login (demo accounts are seeded — see README)',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: {
          email: { type: 'string' }, password: { type: 'string' },
        } } } } },
        responses: { '200': { description: 'JWT + user' }, '401': { description: 'Invalid credentials' }, '429': { description: 'Rate limited' } },
      },
    },
    '/auth/me': { get: { tags: ['Auth'], summary: 'Current profile', security: bearer, responses: { '200': { description: 'Profile' } } } },
    '/health': { get: { tags: ['System'], summary: 'Health check (includes DB reachability)', responses: { '200': { description: 'Healthy' }, '503': { description: 'Database unreachable' } } } },
    '/categories': { get: { tags: ['Catalogue'], summary: 'List service categories', responses: { '200': { description: 'Categories' } } } },
    '/services': { get: { tags: ['Catalogue'], summary: 'List services (includes category_id, category_name)', responses: { '200': { description: 'Services' } } } },
    '/subscriptions': { get: { tags: ['Catalogue'], summary: 'List subscription plans', responses: { '200': { description: 'Plans' } } } },
    '/subscriptions/subscribe': {
      post: { tags: ['Catalogue'], summary: 'Deprecated direct activation endpoint (always returns 410)', security: bearer,
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { plan_id: { type: 'integer' } } } } } },
        responses: { '410': { description: 'Use a verified demo, PayHere, or NOWPayments checkout' } } },
    },
    '/bookings': {
      post: { tags: ['Bookings'], summary: 'Create a booking (auto-assigns least-loaded approved provider; returns PIN)', security: bearer,
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: {
          service_id: { type: 'integer' }, booking_date: { type: 'string', format: 'date', example: '2026-08-20' }, booking_time: { type: 'string', example: '09:00' }, pet_type: { type: 'string', enum: ['dog', 'cat'] },
        } } } } },
        responses: { '201': { description: 'Booking created (booking_id, pin_code, status, total_price)' }, '400': { description: 'Validation error' } } },
    },
    '/bookings/my': { get: { tags: ['Bookings'], summary: "Customer's own bookings (status lowercase; PIN hidden)", security: bearer, responses: { '200': { description: 'Bookings' } } } },
    '/bookings/assigned': { get: { tags: ['Bookings'], summary: "Provider's own server-assigned bookings", security: bearer, responses: { '200': { description: 'Bookings' } } } },
    '/bookings/{id}/status': {
      put: { tags: ['Bookings'], summary: 'Provider updates status (PIN required for in_progress/completed)', security: bearer,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: {
          status: { type: 'string', enum: ['assigned', 'in_progress', 'completed'] }, pin_code: { type: 'string' },
          before_photo: { type: 'string' }, after_photo: { type: 'string' },
        } } } } },
        responses: { '200': { description: 'Updated' }, '400': { description: 'Invalid transition / PIN' }, '403': { description: 'Not your booking' } } },
    },
    '/bookings/{id}/cancel': {
      put: { tags: ['Bookings'], summary: 'Customer cancels own pending/assigned booking', security: bearer,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'Cancelled' }, '400': { description: 'Not cancellable' } } },
    },
    '/reviews': {
      post: { tags: ['Reviews & Complaints'], summary: 'Review a completed booking (1-5 stars, once per booking)', security: bearer,
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: {
          booking_id: { type: 'integer' }, rating: { type: 'integer', minimum: 1, maximum: 5 }, comment: { type: 'string' },
        } } } } },
        responses: { '201': { description: 'Review saved' }, '400': { description: 'Not completed / duplicate / bad rating' } } },
    },
    '/complaints': {
      post: { tags: ['Reviews & Complaints'], summary: 'File a complaint', security: bearer,
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: {
          booking_id: { type: 'integer' }, subject: { type: 'string' }, description: { type: 'string' },
        } } } } },
        responses: { '201': { description: 'Complaint registered' }, '400': { description: 'Validation error' } } },
    },
    '/customer/dashboard': { get: { tags: ['Customer'], summary: 'Profile, subscriptions, bookings, reviews', security: bearer, responses: { '200': { description: 'Dashboard data' } } } },
    '/provider/availability': {
      put: { tags: ['Provider'], summary: 'Set availability', security: bearer,
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { availability_status: { type: 'string', enum: ['available', 'offline'] } } } } } },
        responses: { '200': { description: 'Updated' } } },
    },
    '/provider/earnings': { get: { tags: ['Provider'], summary: 'Fixed service earnings, bank accounts, and payout history', security: bearer, responses: { '200': { description: 'Earnings' } } } },
    '/admin/reviews': { get: { tags: ['Admin'], summary: 'Booking reviews, provider rating summaries, and the overall provider rating', security: bearer, responses: { '200': { description: 'Provider reviews' } } } },
    '/provider/bank-accounts': {
      post: { tags: ['Provider'], summary: 'Create or replace the provider payout bank account', security: bearer,
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['bank_name', 'account_holder', 'account_number', 'branch'], properties: {
          bank_name: { type: 'string' }, account_holder: { type: 'string' }, account_number: { type: 'string' }, branch: { type: 'string' },
        } } } } },
        responses: { '200': { description: 'Bank account replaced' }, '201': { description: 'Bank account created' } } },
    },
    '/provider/payouts/redeem': {
      post: { tags: ['Provider'], summary: 'Request redemption from the available provider balance (minimum LKR 5,000)', security: bearer,
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['amount'], properties: { amount: { type: 'number', minimum: 5000 } } } } } },
        responses: { '201': { description: 'Redemption request created and balance reserved' } } },
    },
    '/promotions': { get: { tags: ['Promotions'], summary: 'Active promotions (discount_percent, is_active)', responses: { '200': { description: 'Promotions' } } } },
    '/promotions/{id}': {
      put: { tags: ['Promotions'], summary: 'Activate/deactivate (admin); body { active: 1|0 } or omit to toggle', security: bearer,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'Updated' } } },
      delete: { tags: ['Promotions'], summary: 'Remove an unused promotion (admin). Promotions with payment history must be deactivated instead.', security: bearer,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'Removed' }, '409': { description: 'Promotion has payment history' } } },
    },
    '/admin/stats': { get: { tags: ['Admin'], summary: 'Platform stats', security: bearer, responses: { '200': { description: 'Stats' } } } },
    '/admin/providers': { get: { tags: ['Admin'], summary: 'All providers (flattened name/email/kyc_status)', security: bearer, responses: { '200': { description: 'Providers' } } } },
    '/admin/providers/{id}/kyc': {
      put: { tags: ['Admin'], summary: 'Approve/reject KYC (accepts lowercase)', security: bearer,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', enum: ['approved', 'rejected'] } } } } } },
        responses: { '200': { description: 'Updated' } } },
    },
    '/admin/bookings': { get: { tags: ['Admin'], summary: 'All bookings', security: bearer, responses: { '200': { description: 'Bookings' } } } },
    '/admin/payouts': { get: { tags: ['Admin'], summary: 'Provider payout and redemption request ledger', security: bearer, responses: { '200': { description: 'Payouts' } } } },
    '/admin/payouts/{id}': {
      put: { tags: ['Admin'], summary: 'Mark a pending payout as paid or failed', security: bearer,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['paid', 'failed'] } } } } } },
        responses: { '200': { description: 'Payout status updated' } } },
    },
    '/admin/bookings/{id}': {
      put: { tags: ['Admin'], summary: 'Override status / reassign provider', security: bearer,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: {
          status: { type: 'string' }, provider_id: { type: 'integer' },
        } } } } },
        responses: { '200': { description: 'Updated' } } },
    },
    '/admin/subscriptions/{id}': {
      delete: { tags: ['Admin'], summary: 'Remove an unused package', security: bearer,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'Package removed' }, '409': { description: 'Package has purchase history; disable it instead' } } },
    },
    '/admin/complaints': { get: { tags: ['Admin'], summary: 'All complaints', security: bearer, responses: { '200': { description: 'Complaints' } } } },
    '/admin/complaints/{id}': {
      put: { tags: ['Admin'], summary: 'Update complaint status (accepts lowercase)', security: bearer,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'Updated' } } },
    },
    '/notifications': { get: { tags: ['Notifications'], summary: "User's notifications", security: bearer, responses: { '200': { description: 'Notifications' } } } },
    '/notifications/{id}/read': {
      put: { tags: ['Notifications'], summary: 'Mark one as read', security: bearer,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'Marked' }, '404': { description: 'Not found' } } },
    },
    '/notifications/read-all': { put: { tags: ['Notifications'], summary: 'Mark all as read', security: bearer, responses: { '200': { description: 'Marked' } } } },
  },
};

const swaggerHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Luxora API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js" crossorigin></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/api/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      });
    };
  </script>
</body>
</html>`;

router.get('/openapi.json', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(spec);
});

router.get('/docs', (_req, res) => {
  res.type('html').send(swaggerHtml);
});

// Convenience redirect: /api/docs/ -> /api/docs
router.get('/docs/', (_req, res) => res.redirect('/api/docs'));

export default router;
