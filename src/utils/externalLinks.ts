import { Browser } from '@capacitor/browser';
import { isNativeCapacitor } from './platform';

/**
 * Handle external links robustly across Web and Native Capacitor.
 */
export async function openExternalUrl(url: string, target: '_blank' | '_system' = '_blank') {
  if (!url) return;

  if (isNativeCapacitor()) {
    try {
      // Intent mapping for popular social/communication apps
      const isAppIntent = url.includes('whatsapp.com') || 
                          url.includes('wa.me') || 
                          url.startsWith('mailto:') || 
                          url.startsWith('tel:') || 
                          url.includes('t.me');

      if (isAppIntent) {
        // Use system intent so it opens in the actual native app (WhatsApp/Telegram/Email)
        window.open(url, '_system');
        return;
      }
      
      // Twitter/X or generic external websites
      await Browser.open({ url, presentationStyle: 'popover' });
    } catch (err) {
      console.warn('[ExternalLinks] Failed to open native browser:', err);
      window.open(url, '_system');
    }
  } else {
    // Standard web browser behavior
    window.open(url, target, 'noopener,noreferrer');
  }
}

export async function openMailto(email: string, subject: string = '', body: string = '') {
  const url = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return openExternalUrl(url, '_system');
}
