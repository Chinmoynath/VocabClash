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
