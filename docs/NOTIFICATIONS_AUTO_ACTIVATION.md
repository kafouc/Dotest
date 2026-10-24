# 🔔 Notifications Push - Changements Implémentés

## ✅ Ce qui a été modifié

### 1. Activation automatique des notifications ✓

Les notifications sont maintenant **activées automatiquement** au premier chargement de l'application :
- Activation silencieuse 1 seconde après la connexion
- Demande la permission si elle n'a pas été refusée
- Ne perturbe pas le chargement initial
- Si la permission est refusée, l'app continue normalement

**Fichier modifié :** `app/app/page.tsx`
- Nouveau `useEffect` pour auto-activation
- Vérification de l'abonnement existant avant de redemander

### 2. Page Paramètres créée ✓

Une nouvelle page `/settings` a été créée pour gérer les notifications :

**URL :** http://localhost:3000/settings

**Fonctionnalités :**
- ✅ Affichage du statut des notifications (Activées/Désactivées)
- ✅ Affichage de la permission du navigateur (Accordée/Refusée/Non demandée)
- ✅ Bouton pour activer les notifications manuellement
- ✅ Bouton pour désactiver les notifications
- ✅ Message d'explication sur l'algorithme FSRS
- ✅ Retour vers l'app principale

**Fichier créé :** `app/settings/page.tsx`

### 3. Bouton "Activer les rappels" supprimé ✓

Le bouton a été retiré de l'interface du document car :
- Les notifications sont auto-activées
- La gestion se fait maintenant dans les Paramètres

**Fichier modifié :** `app/app/page.tsx`
- Suppression du bouton dans l'en-tête du document
- Code de gestion conservé uniquement pour l'auto-activation

### 4. Lien Paramètres dans la Sidebar ✓

Un nouveau lien "Paramètres" a été ajouté dans la navigation :
- Icône engrenage ⚙️
- Accessible depuis la sidebar
- Remplace le lien "Flashcards"

**Fichier modifié :** `components/app/Sidebar.tsx`

## 🎯 Flux utilisateur

### Première connexion :

1. **Connexion** → L'utilisateur se connecte
2. **Auto-activation** (1 seconde après)
   - Si permission refusée → Rien ne se passe
   - Si permission non demandée → Pop-up de permission apparaît
   - Si permission accordée → Notifications activées automatiquement
3. **Confirmation** → Console log "✓ Notifications activées automatiquement"

### Gestion des notifications :

1. **Accès aux paramètres** → Clic sur "Paramètres" dans la sidebar
2. **Visualisation** → Statut actuel des notifications
3. **Actions possibles :**
   - Activer manuellement si désactivées
   - Désactiver si activées
   - Voir l'état de la permission navigateur

## 🔧 Code technique

### Auto-activation (app/app/page.tsx)

```typescript
useEffect(() => {
  if (!session) return;

  const autoEnableNotifications = async () => {
    try {
      // Vérifier si déjà abonné
      const registration = await navigator.serviceWorker.ready;
      const existingSubscription = await registration.pushManager.getSubscription();
      
      if (existingSubscription) return; // Déjà abonné

      // Activer automatiquement
      const permitted = await ensureNotificationPermission();
      if (!permitted) return;

      const reg = await registerServiceWorker('/sw.js');
      const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      const sub = await subscribePush(reg, vapid);
      await sendSubscriptionToServer(sub);
      
      console.log('✓ Notifications activées automatiquement');
    } catch (error) {
      console.log('Notifications non activées automatiquement:', error);
    }
  };

  const timer = setTimeout(autoEnableNotifications, 1000);
  return () => clearTimeout(timer);
}, [session]);
```

### Page Paramètres (app/settings/page.tsx)

**Fonctions principales :**
- `checkNotificationSubscription()` - Vérifie si l'utilisateur est abonné
- `handleEnableNotifications()` - Active les notifications
- `handleDisableNotifications()` - Désactive les notifications (unsubscribe)

**État géré :**
- `notificationsEnabled` - Boolean indiquant si abonné
- `notificationStatus` - Permission du navigateur ('default' | 'granted' | 'denied')
- `isProcessing` - Loading pendant activation/désactivation

## 📊 Avantages de cette approche

✅ **UX améliorée :**
- Pas besoin de chercher le bouton
- Activation transparente
- Contrôle total via Paramètres

✅ **Meilleur taux d'activation :**
- Demande au bon moment (après connexion)
- Contexte clair dans les Paramètres

✅ **Flexibilité :**
- L'utilisateur peut désactiver à tout moment
- Pas de spam de demandes de permission

✅ **Code maintenable :**
- Logique centralisée dans /settings
- Séparation des préoccupations

## 🧪 Tests à effectuer

### 1. Test d'activation automatique :
- [ ] Se déconnecter
- [ ] Se reconnecter
- [ ] Vérifier que la pop-up de permission apparaît après ~1 seconde
- [ ] Accepter la permission
- [ ] Vérifier dans la console : "✓ Notifications activées automatiquement"

### 2. Test de la page Paramètres :
- [ ] Cliquer sur "Paramètres" dans la sidebar
- [ ] Vérifier que le statut est "Activées"
- [ ] Vérifier que la permission est "Accordée"
- [ ] Cliquer sur "Désactiver"
- [ ] Vérifier que le statut passe à "Désactivées"
- [ ] Cliquer sur "Activer"
- [ ] Vérifier que le statut repasse à "Activées"

### 3. Test de persistance :
- [ ] Activer les notifications
- [ ] Rafraîchir la page (F5)
- [ ] Vérifier qu'elles restent activées
- [ ] Vérifier qu'aucune nouvelle demande de permission n'apparaît

### 4. Test de refus de permission :
- [ ] Bloquer les notifications dans les paramètres du navigateur
- [ ] Recharger l'app
- [ ] Vérifier qu'aucune erreur n'apparaît
- [ ] Aller dans Paramètres
- [ ] Vérifier le message d'avertissement pour les permissions bloquées

## 🔥 Rappels automatiques de la flamme (cron Supabase)

Un Edge Function `streak-reminder` envoie désormais jusqu'à **trois notifications quotidiennes** (matin, midi, soir) aux utilisateurs qui n'ont pas encore maintenu leur flamme.

### Déploiement

1. Déployer la fonction :
   ```bash
   supabase functions deploy streak-reminder --project-ref <project-ref>
   ```
2. Définir les variables d'environnement côté Supabase :
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - `STREAK_REMINDER_SECRET` (token utilisé par le cron)
3. (Optionnel mais recommandé) Lancer un test manuel :
   ```bash
   curl -X POST \
     -H "Authorization: Bearer $STREAK_REMINDER_SECRET" \
     "https://<project-ref>.functions.supabase.co/streak-reminder?window=morning"
   ```

### Planification via cron Supabase

`supabase/config.toml` contient trois entrées `functions.schedules` (7h, 13h, 19h). Après `supabase start` / `supabase db reset`, elles sont créées automatiquement en local. Pour l'environnement cloud, exécuter :

```bash
supabase functions schedule patch streak-reminder-morning \
  --cron "0 7 * * *" \
  --url "/streak-reminder?window=morning" \
  --headers "Authorization=Bearer $STREAK_REMINDER_SECRET"

supabase functions schedule patch streak-reminder-midday \
  --cron "0 13 * * *" \
  --url "/streak-reminder?window=midday" \
  --headers "Authorization=Bearer $STREAK_REMINDER_SECRET"

supabase functions schedule patch streak-reminder-evening \
  --cron "0 19 * * *" \
  --url "/streak-reminder?window=evening" \
  --headers "Authorization=Bearer $STREAK_REMINDER_SECRET"
```

### Ce que fait la fonction

- ignore les utilisateurs qui ont déjà révisé aujourd'hui (`last_active_date`)
- évite les doublons : une fenêtre par jour, maximum 3 rappels
- supprime les `push_subscriptions` expirées (HTTP 410)
- journalise un résumé JSON (`sent`, `skipped`, `errors`)

## 🚀 Prochaines étapes suggérées

### Court terme :
- [ ] Tester l'auto-activation avec différents navigateurs
- [ ] Ajouter une notification de bienvenue après activation
- [ ] Persister l'état dans localStorage pour tracking

### Moyen terme :
- [ ] Ajouter plus d'options dans les Paramètres :
  - Fréquence des rappels
  - Heures préférées pour les notifications
  - Activer/désactiver par document
- [ ] Créer la table `card_reviews` pour FSRS
- [ ] Implémenter l'envoi effectif de notifications

### Long terme :
- [ ] Analytics sur le taux d'activation
- [ ] A/B testing du timing de la demande de permission
- [ ] Notifications intelligentes basées sur l'historique

## 📁 Fichiers modifiés/créés

**Nouveaux fichiers :**
- ✅ `app/settings/page.tsx` - Page de paramètres

**Fichiers modifiés :**
- ✅ `app/app/page.tsx` - Auto-activation + suppression du bouton
- ✅ `components/app/Sidebar.tsx` - Ajout du lien Paramètres

**Fichiers inchangés :**
- `lib/pushManager.ts` - Logique push existante
- `public/sw.js` - Service worker
- `app/api/push/subscribe/route.ts` - API d'abonnement
- `supabase/migrations/20251208_push_subscriptions.sql` - Migration DB

---

**Date de mise à jour :** 8 décembre 2025
**Version :** 2.0 - Auto-activation + Page Paramètres
