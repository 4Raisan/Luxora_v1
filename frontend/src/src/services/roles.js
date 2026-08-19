// Universal tester credential: one login (tester@gmail.com / 12345678) reaches all 3 roles.
// Emails are unique per DB row, so provider/admin use +alias variants of the same Gmail inbox.
export const UNIVERSAL_EMAIL = 'tester@gmail.com'
export const UNIVERSAL_PW = '12345678'

export const ROLE_ACCOUNTS = {
  customer: 'tester@gmail.com',
  provider: 'tester.provider@gmail.com',
  admin: 'tester.admin@gmail.com',
}

export const ROLE_LABELS = {
  customer: 'Customer',
  provider: 'Provider',
  admin: 'Admin',
}

// The logged-in user is the universal tester if their email matches the base or an alias.
export function isUniversalTester(email) {
  return Boolean(email) && email.startsWith('tester')
}
