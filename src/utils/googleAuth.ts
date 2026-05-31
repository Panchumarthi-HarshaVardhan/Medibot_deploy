/** Google Identity Services helpers for custom "Continue with Google" buttons. */

type GoogleCredentialCallback = (response: { credential: string }) => void | Promise<void>;

type GoogleIdentityServices = {
  accounts: {
    id: {
      initialize: (config: Record<string, unknown>) => void;
      renderButton: (parent: HTMLElement, config: Record<string, unknown>) => void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleIdentityServices;
  }
}

const getClientId = (): string | undefined => import.meta.env.VITE_GOOGLE_CLIENT_ID;

export const loadGoogleScript = (): Promise<void> =>
  new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Google script')), {
        once: true,
      });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google script'));
    document.body.appendChild(script);
  });

/**
 * Opens the Google account picker popup and returns the ID token credential.
 * Uses a temporary hidden renderButton (prompt() is for One Tap, not button clicks).
 */
export const requestGoogleCredential = async (
  callback: GoogleCredentialCallback
): Promise<void> => {
  const clientId = getClientId();
  if (!clientId) {
    throw new Error('Google sign-in is not configured (missing VITE_GOOGLE_CLIENT_ID)');
  }

  await loadGoogleScript();
  const google = window.google;
  if (!google?.accounts?.id) {
    throw new Error('Google sign-in is not loaded yet');
  }

  return new Promise((resolve, reject) => {
    const host = document.createElement('div');
    host.style.position = 'fixed';
    host.style.left = '-9999px';
    host.style.top = '0';
    document.body.appendChild(host);

    let settled = false;
    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      host.remove();
      if (err) reject(err);
      else resolve();
    };

    const timeout = window.setTimeout(() => {
      finish(new Error('Google sign-in timed out. Please try again.'));
    }, 120_000);

    google.accounts.id.initialize({
      client_id: clientId,
      ux_mode: 'popup',
      callback: async (response: { credential: string }) => {
        window.clearTimeout(timeout);
        try {
          await callback(response);
          finish();
        } catch (err) {
          finish(err instanceof Error ? err : new Error('Google sign-in failed'));
        }
      },
      cancel_on_tap_outside: false,
    });

    google.accounts.id.renderButton(host, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
    });

    // Trigger the rendered Google button (reliable popup vs. id.prompt() One Tap).
    window.setTimeout(() => {
      const btn =
        host.querySelector<HTMLElement>('[role="button"]') ??
        host.querySelector<HTMLElement>('div[tabindex="0"]');
      if (!btn) {
        window.clearTimeout(timeout);
        finish(new Error('Could not start Google sign-in. Check your Google Client ID.'));
        return;
      }
      btn.click();
    }, 50);
  });
};
