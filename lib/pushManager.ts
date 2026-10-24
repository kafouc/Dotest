export async function ensureNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined') return 'denied';
  if (!('Notification' in window)) return 'denied';
  const current = Notification.permission;
  if (current !== 'default') return current;
  return await Notification.requestPermission();
}

export async function registerServiceWorker(swPath = '/sw.js'): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined') return null;
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register(swPath);
    
    // Attendre que le Service Worker soit actif
    await navigator.serviceWorker.ready;
    
    // Si le SW est en train de s'installer, attendre qu'il soit activé
    if (reg.installing) {
      await new Promise<void>((resolve) => {
        reg.installing!.addEventListener('statechange', function handler(e) {
          const sw = e.target as ServiceWorker;
          if (sw.state === 'activated') {
            sw.removeEventListener('statechange', handler);
            resolve();
          }
        });
      });
    }
    
    return reg;
  } catch {
    return null;
  }
}

export async function subscribePush(reg: ServiceWorkerRegistration, vapidPublicKey: string) {
  if (!reg.pushManager) throw new Error('PushManager indisponible');
  
  // Vérifier qu'il y a un Service Worker actif
  if (!reg.active) {
    throw new Error('Service Worker non actif. Veuillez réessayer dans quelques secondes.');
  }
  
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;
  
  const convertedKey = urlBase64ToUint8Array(vapidPublicKey);
  return await reg.pushManager.subscribe({ 
    userVisibleOnly: true, 
    applicationServerKey: convertedKey 
  });
}

export async function sendSubscriptionToServer(subscription: PushSubscription) {
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || 'Échec enregistrement subscription');
  }
  return true;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}
