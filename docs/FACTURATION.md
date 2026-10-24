# Facturation, TVA et Stripe

> Ce document décrit ce que fait le code et les réglages à vérifier. Ce n'est **pas** un avis juridique ou fiscal : faites valider
> le statut de TVA, les mentions de facture et les CGV par un expert-comptable avant de facturer des clients.

## Ce que fait le code
- Paiement : Stripe Checkout en mode abonnement, langue française. Forfaits « Partiel » et « Sérénité » (`partial`, `pro`).
- Le forfait n'est accordé que si le **paiement est acquis**. Un prélèvement asynchrone (SEPA) accorde le forfait à sa confirmation
  (`checkout.session.async_payment_succeeded`).
- Statuts : `active`, `trialing` et `past_due` (prélèvement échoué, Stripe relance pendant quelques jours : **période de grâce**) gardent l'accès.
  `unpaid`, `canceled`, `incomplete`… le retirent.
- Les événements Stripe peuvent arriver dans le désordre : à chaque mise à jour d'abonnement, l'état est **relu chez Stripe**, qui fait foi.
- Chaque événement est traité une seule fois (table `stripe_webhook_events`). Signature invalide : 400 ; erreur interne : 500 (Stripe réessaie).
- Suppression de compte : l'abonnement est résilié **avant** toute suppression ; le client et les factures restent chez Stripe (conservation légale).

## Événements à activer dans Stripe (Développeurs > Webhooks)
`checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated`,
`customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.

## TVA : deux situations possibles
1. **Vous facturez la TVA (20 % en France)** : activez Stripe Tax dans le tableau de bord (adresse de l'entreprise, numéro de TVA), choisissez le code fiscal
   « logiciel en tant que service » sur chaque produit, définissez les prix en « taxe incluse » (particuliers) ou « hors taxe », puis ajoutez la variable
   `STRIPE_AUTOMATIC_TAX=true` sur Vercel. Le paiement collecte alors l'adresse de facturation et le numéro de TVA des entreprises et des établissements, et la facture affiche la TVA.
2. **Franchise en base de TVA** (régime micro-entreprise sous les plafonds) : ne pas activer l'option ; la facture doit porter la mention
   « TVA non applicable, art. 293 B du CGI ». Surveillez les plafonds : leur dépassement vous fait basculer dans le régime 1.
   Les ventes à des particuliers d'autres pays de l'Union européenne ont leurs propres seuils et règles (guichet unique) : à voir avec votre comptable.

## Mentions et obligations à vérifier
- Facture : identité et adresse de l'émetteur, SIREN/SIRET, numérotation continue (assurée par Stripe), date, détail du service, montant HT, TVA, TTC. Renseignez ces informations dans
  *Paramètres > Facturation > Marque* de Stripe.
- **Conditions générales de vente** accessibles avant le paiement. Pour la vente à des consommateurs : information sur le **droit de rétractation de 14 jours** ;
  pour un service numérique fourni immédiatement, le client doit accepter expressément l'exécution immédiate et reconnaître perdre ce droit.
  Ajoutez l'URL des CGV dans Stripe puis `STRIPE_REQUIRE_TERMS=true` : le paiement exige alors l'acceptation.
- Conservation des factures : 10 ans (déjà assurée par Stripe).
- Portail client Stripe (déjà branché dans Paramètres) : le client y retrouve ses factures et peut résilier.

## Tester avant de passer en production
Avec une clé de test et la CLI Stripe (`stripe listen --forward-to localhost:3000/api/billing/webhook`) :
- paiement réussi : carte `4242 4242 4242 4242` ;
- prélèvement qui échoue : `4000 0000 0000 0341` (carte valide à l'enregistrement, refusée au renouvellement) ;
- `stripe trigger invoice.payment_failed`, `stripe trigger customer.subscription.deleted`.
Vérifiez ensuite le forfait affiché dans Paramètres. Les scénarios principaux sont couverts par `tests/stripeWebhook.spec.ts` (27 tests, Stripe simulé).
