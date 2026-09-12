// Helper to convert email prefix (e.g. "nathchinmoy777", "surajkumarhero7399", "rahul.sharma", "amit_kumar") into a clean, human readable name (e.g. "Chinmoy Nath", "Suraj Kumar")
export function formatNameFromEmail(email: string): string {
  if (!email || !email.includes('@')) return 'Govt Aspirant';
  
  const prefix = email.split('@')[0].trim();
  if (!prefix) return 'Govt Aspirant';

  const lowerPrefix = prefix.toLowerCase();
  // Direct match for known compound names
  if (lowerPrefix.includes('nathchinmoy') || lowerPrefix.includes('chinmoynath')) {
    return 'Chinmoy Nath';
  }

  // Replace common separators (. _ -) with spaces
  let cleaned = prefix.replace(/[._\-+]/g, ' ');

  // Strip trailing numbers (e.g. "surajkumarhero7399" -> "surajkumarhero")
  cleaned = cleaned.replace(/\d+$/, '');

  // Strip common buzzwords if attached at end (like "hero", "cool", "official", "kumar123")
  cleaned = cleaned.replace(/(hero|cool|official|king|star|boss|pro)$/i, '');

  // If camelCase or separated words (e.g. "surajKumar" or "suraj kumar")
  cleaned = cleaned.replace(/([a-z])([A-Z])/g, '$1 $2');

  // If the word has common Indian titles concatenated like "kumar", "singh", "sharma", "patel", "gupta", "yadav", "mishra", "das", "nath", "roy", "verma", "shukla"
  const commonSurnames = [
    'kumar', 'singh', 'sharma', 'patel', 'gupta', 'yadav', 'mishra', 'das',
    'nath', 'roy', 'verma', 'shukla', 'joshi', 'pandey', 'tiwari', 'sinha',
    'saxena', 'reddy', 'nair', 'menon', 'bose', 'sen', 'banerjee', 'chatterjee'
  ];

  for (const surname of commonSurnames) {
    // 1. Check if surname is at start (e.g. "nathchinmoy" -> "chinmoy nath")
    const startRegex = new RegExp(`^(${surname})([a-zA-Z]{3,})$`, 'i');
    if (startRegex.test(cleaned)) {
      cleaned = cleaned.replace(startRegex, '$2 $1');
      break;
    }
    // 2. Check if surname is at end (e.g. "surajkumar" -> "suraj kumar")
    const endRegex = new RegExp(`([a-zA-Z]{3,})(${surname})`, 'i');
    if (endRegex.test(cleaned) && !cleaned.toLowerCase().includes(` ${surname}`)) {
      cleaned = cleaned.replace(endRegex, '$1 $2');
      break;
    }
  }

  // Capitalize each word properly
  const words = cleaned.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'Govt Aspirant';

  return words
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

// Extract the best human readable name for a user
export function extractCleanUserName(displayName?: string | null, email?: string | null, fallback = 'Govt Aspirant'): string {
  // If user has a real displayName that isn't a generic placeholder or raw email prefix
  if (displayName && displayName.trim()) {
    const trimmed = displayName.trim();
    // If displayName is the generic placeholder, but email is provided, derive from email
    if ((trimmed === 'Govt Aspirant' || trimmed === 'Aspirant Rahul') && email && email.trim()) {
      return formatNameFromEmail(email.trim());
    }
    // If displayName is just the raw email or raw email prefix with digits, format it
    if (trimmed.includes('@')) {
      return formatNameFromEmail(trimmed);
    }
    // If it's a concatenated email prefix without spaces like "surajkumarhero7399" or "nathchinmoy777"
    if (!trimmed.includes(' ') && /\d/.test(trimmed)) {
      return formatNameFromEmail(trimmed + '@gmail.com');
    }
    return trimmed;
  }

  if (email && email.trim()) {
    return formatNameFromEmail(email.trim());
  }

  return fallback;
}

// Resolves the definitive user display name by prioritizing authenticated account identity
export function resolvePlayerName({
  cloudName,
  localName,
  authDisplayName,
  email,
}: {
  cloudName?: string | null;
  localName?: string | null;
  authDisplayName?: string | null;
  email?: string | null;
}): string {
  const cleanAuth = authDisplayName?.trim();
  const emailDerived = email ? formatNameFromEmail(email) : '';

  // 1. If authDisplayName is a real, valid name (e.g. "Kulbhusan")
  if (cleanAuth && cleanAuth !== 'Govt Aspirant' && cleanAuth !== 'Aspirant Rahul') {
    // If cloudName is missing, default, or equal to the synthetic email derivation
    if (!cloudName || cloudName === 'Govt Aspirant' || cloudName === 'Aspirant Rahul' || cloudName === emailDerived) {
      return cleanAuth;
    }
    // If the account email is NOT chinmoy and cloudName is "Chin Nath", it was caused by the email regex bug!
    if (cloudName === 'Chin Nath' && (!email || !email.toLowerCase().includes('nathchinmoy'))) {
      return cleanAuth;
    }
    // If cloudName has digits/email pattern, prefer cleanAuth
    if (!cloudName.includes(' ') && /\d/.test(cloudName)) {
      return cleanAuth;
    }
    // If localName is equal to emailDerived or default, prefer cleanAuth
    if (!localName || localName === 'Govt Aspirant' || localName === 'Aspirant Rahul' || localName === emailDerived) {
      return cleanAuth;
    }
    return cloudName;
  }

  // 2. If no authDisplayName, check cloudName
  if (cloudName && cloudName !== 'Govt Aspirant' && cloudName !== 'Aspirant Rahul') {
    // Clean up if it was a raw email prefix with digits
    if (!cloudName.includes(' ') && /\d/.test(cloudName)) {
      return extractCleanUserName(cloudName, email);
    }
    // If cloudName is "Chin Nath" but email does not belong to Chinmoy Nath
    if (cloudName === 'Chin Nath' && email && !email.toLowerCase().includes('nathchinmoy')) {
      const prefix = email.split('@')[0].replace(/[._\-+]/g, ' ').replace(/\d+$/, '').trim();
      return prefix ? prefix.charAt(0).toUpperCase() + prefix.slice(1) : 'Govt Aspirant';
    }
    return cloudName;
  }

  // 3. Check localName
  if (localName && localName !== 'Govt Aspirant' && localName !== 'Aspirant Rahul') {
    if (localName === 'Chin Nath' && email && !email.toLowerCase().includes('nathchinmoy')) {
      return 'Govt Aspirant';
    }
    return localName;
  }

  // 4. Fallback to email derivation or default
  if (email) {
    return formatNameFromEmail(email);
  }

  return 'Govt Aspirant';
}
