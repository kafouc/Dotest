import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Choix de consentement déjà fait : le bandeau ne masque pas les boutons du bas de page
  await page.addInitScript(() => {
    window.localStorage.setItem('sop-consent-v1', JSON.stringify({ analytics: false, decidedAt: new Date().toISOString() }));
  });
});

test.describe('tutoriel interactif (/demo)', () => {
  test('parcourt toutes les étapes en interagissant avec les écrans simulés', async ({ page }) => {
    await page.goto('/demo');
    await expect(page.getByRole('heading', { level: 1, name: 'Sheet of Paper en 2 minutes' })).toBeVisible();
    await page.getByRole('button', { name: 'Commencer le tutoriel' }).click();

    // 1. Import
    await expect(page.getByRole('heading', { level: 1, name: 'Importez votre cours' })).toBeVisible();
    await page.getByRole('button', { name: /Ajouter le fichier/ }).click();
    await expect(page.getByText('Importé : l’analyse démarre')).toBeVisible();
    await page.getByRole('button', { name: 'Suivant →' }).click();

    // 2. Analyse (animation jusqu'à « Prêt »)
    await expect(page.getByRole('heading', { level: 1, name: /L’IA lit et indexe/ })).toBeVisible();
    await expect(page.getByText('Prêt', { exact: true })).toBeVisible({ timeout: 8_000 });
    await page.getByRole('button', { name: 'Suivant →' }).click();

    // 3. Génération : impossible sans thème
    const generate = page.getByRole('button', { name: 'Générer le quiz' });
    await expect(generate).toBeDisabled();
    await page.getByRole('button', { name: 'Triangle du feu' }).click();
    await page.getByRole('button', { name: '7', exact: true }).click();
    await generate.click();
    await expect(page.getByText(/7 questions QCU prêtes sur « Triangle du feu »/)).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: 'Suivant →' }).click();

    // 4. Quiz : mauvaise réponse, correction sourcée
    await page.getByRole('button', { name: /L’eau, l’air et la terre/ }).click();
    await expect(page.getByText('Raté. Bonne réponse : A')).toBeVisible();
    await expect(page.getByText(/Source — page 2/)).toBeVisible();
    await page.getByRole('button', { name: 'Suivant →' }).click();

    // 5. Révision espacée : la carte se retourne, la note fait avancer l'objectif
    await expect(page.getByText(/3\s*\/ 10 cartes/)).toBeVisible();
    await page.getByRole('button', { name: 'Afficher la réponse' }).click();
    await page.getByRole('button', { name: /^Bien/ }).click();
    await expect(page.getByText(/4\s*\/ 10 cartes/)).toBeVisible();
    await page.getByRole('button', { name: 'Suivant →' }).click();

    // 6. Séance en direct
    await expect(page.getByText('3 participants')).toBeVisible();
    await page.getByRole('button', { name: 'Un élève rejoint' }).click();
    await expect(page.getByText('4 participants')).toBeVisible();
    await page.getByRole('button', { name: 'Suivant →' }).click();

    // 7. Téléphone : la notification s'ouvre sur la révision
    await page.getByRole('button', { name: /Bonjour ! 5 minutes pour réviser/ }).click();
    await expect(page.getByText('6 cartes à revoir')).toBeVisible();
    await expect(page.getByRole('link', { name: /Voir comment installer/ })).toHaveAttribute('href', '/#installer');
    await page.getByRole('button', { name: 'Suivant →' }).click();

    // Conclusion : inscription ou essai sans compte, tutoriel marqué comme vu
    await expect(page.getByRole('heading', { level: 1, name: /Prêt à essayer/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Créer mon compte gratuit' })).toHaveAttribute('href', '/signup');
    await expect(page.getByRole('link', { name: /Essayer avec mon texte/ })).toHaveAttribute('href', '/essai');
    const seen = await page.evaluate(() => window.localStorage.getItem('dotest_onboarding_demo_completed'));
    expect(seen).toBe('true');
  });

  test('se pilote au clavier et permet de revenir en arrière', async ({ page }) => {
    await page.goto('/demo');
    // La page est rendue avant d'être « hydratée » : on réessaie tant que le clavier n'est pas branché
    await expect(async () => {
      await page.keyboard.press('ArrowRight');
      await expect(page.getByRole('heading', { level: 1, name: 'Importez votre cours' })).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 10_000 });
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('heading', { level: 1, name: 'Sheet of Paper en 2 minutes' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Précédent/ })).toBeHidden();
  });

  test('« Passer le tutoriel » mène à l’inscription', async ({ page }) => {
    await page.goto('/demo');
    await page.getByRole('button', { name: 'Passer le tutoriel' }).click();
    await expect(page).toHaveURL(/\/signup/);
  });

  test('« Commencer » de l’accueil mène au tutoriel, puis directement à l’inscription une fois vu', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Commencer', exact: true }).click();
    await expect(page).toHaveURL(/\/demo/);

    await page.evaluate(() => window.localStorage.setItem('dotest_onboarding_demo_completed', 'true'));
    await page.goto('/');
    await page.getByRole('button', { name: 'Commencer', exact: true }).click();
    await expect(page).toHaveURL(/\/signup/);
  });
});

test.describe('installation sur téléphone (accueil)', () => {
  test('la section explique l’installation pour chaque appareil', async ({ page }) => {
    await page.goto('/#installer');
    const section = page.locator('#installer');
    await expect(section.getByRole('heading', { name: /Installez Sheet of Paper sur votre téléphone/ })).toBeVisible();

    await section.getByRole('tab', { name: 'iPhone / iPad' }).click();
    await expect(section.getByText('Appuyez sur « Partager »')).toBeVisible();
    await expect(section.getByText('Choisissez « Sur l’écran d’accueil »')).toBeVisible();
    await expect(section.getByText(/iOS 16\.4/)).toBeVisible();

    await section.getByRole('tab', { name: 'Android' }).click();
    await expect(section.getByText('Appuyez sur « Installer l’application »')).toBeVisible();

    await section.getByRole('tab', { name: 'Ordinateur' }).click();
    await expect(section.getByText('Cliquez sur l’icône d’installation')).toBeVisible();
  });

  test('un iPhone voit directement les étapes iPhone', async ({ browser }) => {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await page.addInitScript(() => window.localStorage.setItem('sop-consent-v1', JSON.stringify({ analytics: false, decidedAt: new Date().toISOString() })));
    await page.goto('/');
    await expect(page.locator('#installer').getByRole('tab', { name: 'iPhone / iPad' })).toHaveAttribute('aria-selected', 'true');
    await context.close();
  });

  test('le menu de l’accueil et la FAQ renvoient vers l’installation', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Installer l’app' }).first()).toHaveAttribute('href', '#installer');
    await expect(page.getByText(/Comment installer l.application sur mon téléphone/)).toBeVisible();
  });
});
