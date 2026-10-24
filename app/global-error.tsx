'use client';

// Dernier filet de sécurité : remplace le layout racine, donc ni Tailwind ni polices ne sont garantis.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: '#fff', color: '#333' }}>
        <div role="alert" style={{ maxWidth: 420, padding: 16, textAlign: 'center' }}>
          <h1 style={{ fontSize: 24 }}>Une erreur est survenue</h1>
          <p style={{ color: '#666' }}>L&apos;application n&apos;a pas pu s&apos;afficher. Réessayez dans un instant.</p>
          {error.digest && <p style={{ fontSize: 12, color: '#888' }}>Référence : {error.digest}</p>}
          <button
            type="button"
            onClick={reset}
            style={{ background: '#fbbf1d', border: 0, borderRadius: 8, padding: '10px 20px', fontWeight: 600, cursor: 'pointer' }}
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
