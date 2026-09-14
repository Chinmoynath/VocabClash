/**
 * Strict email validation & trusted provider whitelist verification
 * Prevents spam accounts, bot signups, and disposable/fake domains (like uifi.com, qdoit.com, mailinator, etc.)
 */

// Comprehensive list of authentic, trusted email providers (Major consumer, Indian & global platforms)
export const TRUSTED_EMAIL_DOMAINS = new Set([
  // Google
  'gmail.com',
  'googlemail.com',
  
  // Microsoft
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'outlook.in',

  // Yahoo
  'yahoo.com',
  'yahoo.in',
  'yahoo.co.in',
  'ymail.com',
  'rocketmail.com',

  // Apple
  'icloud.com',
  'me.com',
  'mac.com',

  // Zoho & Indian Webmail
  'zoho.com',
  'zoho.in',
  'zohomail.com',
  'rediffmail.com',

  // Proton & Secure
  'protonmail.com',
  'proton.me',
  'pm.me',

  // Other Major Global Providers
  'aol.com',
  'gmx.com',
  'gmx.net',
  'mail.com',
  'yandex.com',
]);

// Trusted institutional / government top-level and secondary domains
export const TRUSTED_DOMAIN_SUFFIXES = [
  '.gov.in',
  '.nic.in',
  '.ac.in',
  '.edu.in',
  '.res.in',
  '.org.in',
  '.ernet.in',
  '.edu',
  '.gov',
  '.ac.uk',
  '.edu.au',
];

/**
 * Validates that an email is a legitimate, proper email address from a recognized trusted provider
 * or institutional/government organization.
 */
export function validateProperEmail(email: string): { isValid: boolean; error?: string } {
  if (!email || typeof email !== 'string') {
    return { isValid: false, error: 'Please enter your email address.' };
  }

  const clean = email.trim().toLowerCase();

  // Basic regex check for proper email format: user@domain.tld
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  
  if (!emailRegex.test(clean)) {
    return { 
      isValid: false, 
      error: 'Please enter a valid email format (e.g. yourname@gmail.com).' 
    };
  }

  const parts = clean.split('@');
  if (parts.length !== 2) {
    return { isValid: false, error: 'Invalid email address.' };
  }

  const [username, domain] = parts;

  // Ensure minimum username length
  if (username.length < 2) {
    return { isValid: false, error: 'Email username is too short.' };
  }

  // Check against trusted domain whitelist or recognized institutional suffixes
  const isTrustedExactDomain = TRUSTED_EMAIL_DOMAINS.has(domain);
  const isTrustedSuffix = TRUSTED_DOMAIN_SUFFIXES.some(suffix => domain.endsWith(suffix));

  if (!isTrustedExactDomain && !isTrustedSuffix) {
    return { 
      isValid: false, 
      error: 'This is not a recognised email provider.' 
    };
  }

  return { isValid: true };
}

/**
 * Validates aspirant name to prevent single-letter or pure keyboard mash
 */
export function validateAspirantName(name: string): { isValid: boolean; error?: string } {
  const clean = name.trim();
  if (!clean) {
    return { isValid: false, error: 'Please enter your aspirant name.' };
  }
  if (clean.length < 2) {
    return { isValid: false, error: 'Name must be at least 2 characters.' };
  }
  // Check that name contains letters
  if (!/[a-zA-Z]/.test(clean)) {
    return { isValid: false, error: 'Name must contain letters.' };
  }
  return { isValid: true };
}

export const COMMON_AUTOCOMPLETE_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'icloud.com',
  'zoho.com',
];
