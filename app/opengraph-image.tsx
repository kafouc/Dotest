import { renderOgImage } from '@/lib/ogImage';

export const alt = 'Sheet of Paper : quiz IA, fiches de révision et flashcards à partir de vos cours';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return renderOgImage();
}
