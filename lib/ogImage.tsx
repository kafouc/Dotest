import { ImageResponse } from 'next/og';

export const OG_SIZE = { width: 1200, height: 630 };

/** Aperçu de partage (1200×630) : réseaux sociaux, messageries, résultats de recherche. */
export function renderOgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '72px',
          background: 'linear-gradient(135deg, #fff6d6 0%, #ffffff 45%, #d9f5ea 100%)',
          color: '#2f2f2f',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 38, fontWeight: 700 }}>
          <svg width="56" height="50" viewBox="0 0 56 50" style={{ marginRight: 18 }}>
            <polygon points="28,0 56,50 0,50" fill="#45bf9a" />
          </svg>
          Sheet of Paper
        </div>
        <div style={{ display: 'flex', fontSize: 78, fontWeight: 800, lineHeight: 1.08, marginTop: 40, maxWidth: 980 }}>
          Vos cours en quiz, fiches et flashcards
        </div>
        <div style={{ display: 'flex', fontSize: 36, marginTop: 28, color: '#555', maxWidth: 980 }}>
          PDF, Word, PowerPoint → quiz IA sourcés, séances en direct par QR code, révision espacée.
        </div>
        <div style={{ display: 'flex', marginTop: 48 }}>
          <div style={{ display: 'flex', background: '#fbbf1d', borderRadius: 999, padding: '16px 38px', fontSize: 32, fontWeight: 700 }}>
            Gratuit · sans carte bancaire
          </div>
        </div>
      </div>
    ),
    OG_SIZE
  );
}
