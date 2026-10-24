import { expect, test } from '@playwright/test';

const QUIZ = {
  language: 'fr',
  questions: [
    {
      question: 'Où se déroule la photosynthèse ?',
      options: { A: 'Dans les chloroplastes', B: 'Dans les racines', C: 'Dans les stomates', D: 'Dans le sol' },
      reponse_correcte: 'A',
      justification: 'La photosynthèse a lieu dans les chloroplastes des feuilles.',
      evidence: 'Elle se déroule principalement dans les feuilles, à l’intérieur de petits organites appelés chloroplastes',
      source: { pageStart: 1, pageEnd: 1 },
    },
    {
      question: 'Quel gaz est rejeté par la plante ?',
      options: { A: 'Le dioxyde de carbone', B: 'Le dioxygène', C: 'L’azote', D: 'Le méthane' },
      reponse_correcte: 'B',
      justification: 'La décomposition de l’eau libère du dioxygène.',
      evidence: 'Cette réaction libère du dioxygène, qui est rejeté dans l’atmosphère',
      source: { pageStart: 2, pageEnd: 2 },
    },
  ],
};

test.describe('essai sans compte', () => {
  // Un visiteur qui a déjà fait son choix sur le bandeau de consentement
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('sop-consent-v1', JSON.stringify({ analytics: false, decidedAt: new Date().toISOString() }));
    });
  });

  test('du texte d’exemple au résultat, avec invitation à s’inscrire', async ({ page }) => {
    await page.route('**/api/demo/quiz', (route) => route.fulfill({ json: QUIZ }));
    await page.goto('/essai');

    const generate = page.getByRole('button', { name: 'Générer mon mini-quiz' });
    await expect(generate).toBeDisabled(); // texte trop court

    await page.getByRole('button', { name: /texte d.exemple/i }).click();
    await expect(generate).toBeEnabled();
    await generate.click();

    // Question 1 : mauvaise réponse, la correction cite la source
    await expect(page.getByRole('heading', { name: 'Où se déroule la photosynthèse ?' })).toBeVisible();
    await page.getByRole('button', { name: /Dans les racines/ }).click();
    await expect(page.getByText(/Raté\. Bonne réponse/)).toBeVisible();
    await expect(page.getByText(/Dans votre texte \(Page 1\)/)).toBeVisible();
    await page.getByRole('button', { name: 'Question suivante' }).click();

    // Question 2 : bonne réponse
    await page.getByRole('button', { name: /Le dioxygène/ }).click();
    await expect(page.getByText('Bonne réponse !')).toBeVisible();
    await page.getByRole('button', { name: 'Voir mon résultat' }).click();

    await expect(page.getByRole('heading', { name: /1 \/ 2/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Créer mon compte gratuit' })).toHaveAttribute('href', '/signup');
  });

  test('affiche le message du serveur quand la démonstration est saturée', async ({ page }) => {
    await page.route('**/api/demo/quiz', (route) =>
      route.fulfill({ status: 429, json: { error: "L'essai gratuit est très demandé aujourd'hui. Créez un compte gratuit pour continuer." } })
    );
    await page.goto('/essai');
    await page.getByRole('button', { name: /texte d.exemple/i }).click();
    await page.getByRole('button', { name: 'Générer mon mini-quiz' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'très demandé' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Générer mon mini-quiz' })).toBeVisible();
  });

  test('refuse un texte trop court sans appeler le serveur', async ({ page }) => {
    let called = false;
    await page.route('**/api/demo/quiz', (route) => {
      called = true;
      return route.fulfill({ json: QUIZ });
    });
    await page.goto('/essai');
    await page.getByLabel('Votre texte').fill('Trop court.');
    await expect(page.getByRole('button', { name: 'Générer mon mini-quiz' })).toBeDisabled();
    expect(called).toBe(false);
  });
});

test.describe('consentement et vie privée', () => {
  test('le bandeau s’affiche, refuser est aussi simple qu’accepter et le choix est mémorisé', async ({ page }) => {
    await page.goto('/confidentialite');
    const banner = page.getByRole('dialog', { name: 'Mesure d\'audience' });
    await expect(banner).toBeVisible();
    await expect(banner.getByRole('button', { name: 'Refuser' })).toBeVisible();
    await expect(banner.getByRole('button', { name: 'Accepter' })).toBeVisible();

    await banner.getByRole('button', { name: 'Refuser' }).click();
    await expect(banner).toBeHidden();

    await page.reload();
    await expect(page.getByRole('dialog', { name: 'Mesure d\'audience' })).toBeHidden();
    const stored = await page.evaluate(() => JSON.parse(window.localStorage.getItem('sop-consent-v1') ?? 'null'));
    expect(stored).toMatchObject({ analytics: false });
  });

  test('aucune mesure d’audience n’est envoyée avant le consentement', async ({ page }) => {
    const analyticsRequests: string[] = [];
    page.on('request', (request) => {
      if (/vercel-scripts|vitals\.vercel-insights|\/_vercel\/(insights|speed-insights)|api\/analytics\/page-view/.test(request.url())) {
        analyticsRequests.push(request.url());
      }
    });
    await page.goto('/essai');
    await page.getByRole('button', { name: /texte d.exemple/i }).waitFor();
    await page.waitForTimeout(1_000);
    expect(analyticsRequests).toEqual([]);
  });

  test('la politique de confidentialité décrit les droits et l’IA', async ({ page }) => {
    await page.goto('/confidentialite');
    await expect(page.getByRole('heading', { level: 1, name: 'Politique de confidentialité' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Intelligence artificielle/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Vos droits/ })).toBeVisible();
  });
});

test.describe('accès et erreurs', () => {
  test('les pages privées renvoient vers la connexion', async ({ page }) => {
    for (const path of ['/app', '/settings', '/review', '/classes']) {
      await page.goto(path);
      await expect(page, `${path} doit exiger une connexion`).toHaveURL(/\/login/);
    }
  });

  test('une page inconnue affiche la page 404 du site', async ({ page }) => {
    const response = await page.goto('/cette-page-n-existe-pas');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Page introuvable' })).toBeVisible();
  });

  test('l’accueil mène à l’essai sans compte', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Essayer maintenant, sans compte' }).click();
    await expect(page).toHaveURL(/\/essai/);
  });
});
