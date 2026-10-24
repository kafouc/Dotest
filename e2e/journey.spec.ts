import { expect, test } from '@playwright/test';

/**
 * Parcours complet avec un vrai compte : connexion, document d'exemple, quiz, réponse, révision.
 * Nécessite un projet Supabase de PRÉPRODUCTION et un compte de test dédié :
 *   E2E_EMAIL=… E2E_PASSWORD=… NEXT_PUBLIC_SUPABASE_URL=… NEXT_PUBLIC_SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… GROQ_API_KEY=… JINA_API_KEY=… npm run test:e2e
 * Ne jamais l'exécuter contre la production : il crée un document et un quiz dans le compte de test.
 */
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test.describe('parcours inscrit', () => {
  test.skip(!email || !password, 'E2E_EMAIL et E2E_PASSWORD non définis');
  test.setTimeout(120_000);

  test('connexion, document d’exemple, premier quiz, réponse', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/adresse e-mail|email/i).fill(email as string);
    await page.getByLabel(/mot de passe|password/i).first().fill(password as string);
    await page.getByRole('button', { name: /se connecter|sign in/i }).click();
    await expect(page).toHaveURL(/\/app/);

    // Parcours guidé : document d'exemple
    const sample = page.getByRole('button', { name: /Essayer avec un exemple/ });
    if (await sample.isVisible().catch(() => false)) await sample.click();

    await expect(page.getByRole('heading', { name: /Exemple - La photosynthèse/ })).toBeVisible({ timeout: 30_000 });

    // Génération d'un quiz (appel réel à l'IA)
    await page.getByRole('button', { name: /générer/i }).first().click();
    await expect(page.getByText(/Question 1/i)).toBeVisible({ timeout: 60_000 });

    // Répond à la première question : la correction cite le cours
    await page.getByRole('button', { name: /^A\b/ }).first().click();
    await expect(page.getByText(/Justification|Source/i).first()).toBeVisible();
  });
});
