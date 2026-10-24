#!/usr/bin/env node
// Vérifie (et complète avec --apply) les événements activés sur le webhook Stripe de l'application.
//
//   STRIPE_SECRET_KEY=sk_live_... node scripts/stripe-webhook-events.mjs            # simple vérification
//   STRIPE_SECRET_KEY=sk_live_... node scripts/stripe-webhook-events.mjs --apply    # ajoute les événements manquants
//
// Ne retire jamais un événement déjà activé. Utilisez la clé secrète de la production (sk_live_…) pour le webhook de production.
import { readFileSync } from 'node:fs';

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error('STRIPE_SECRET_KEY manquante.');
  process.exit(2);
}
const apply = process.argv.includes('--apply');
const urlHint = process.env.WEBHOOK_URL_CONTAINS ?? '/api/billing/webhook';

// Source unique : la liste exportée par lib/billing.ts
const source = readFileSync(new URL('../lib/billing.ts', import.meta.url), 'utf8');
const block = source.match(/STRIPE_WEBHOOK_EVENTS = \[([\s\S]*?)\] as const/)?.[1] ?? '';
const required = [...block.matchAll(/'([a-z_.]+)'/g)].map((m) => m[1]);
if (required.length === 0) {
  console.error('Liste STRIPE_WEBHOOK_EVENTS introuvable dans lib/billing.ts.');
  process.exit(2);
}

const headers = { Authorization: `Bearer ${key}` };
const listResponse = await fetch('https://api.stripe.com/v1/webhook_endpoints?limit=100', { headers });
const list = await listResponse.json();
if (!listResponse.ok) {
  console.error(`Stripe a refusé la requête : ${list.error?.message ?? listResponse.status}`);
  process.exit(2);
}

const endpoints = list.data.filter((e) => e.url.includes(urlHint));
if (endpoints.length === 0) {
  console.error(`Aucun webhook ne contient « ${urlHint} ». Webhooks trouvés : ${list.data.map((e) => e.url).join(', ') || 'aucun'}`);
  process.exit(1);
}

let incomplete = false;
for (const endpoint of endpoints) {
  const enabled = new Set(endpoint.enabled_events);
  console.log(`\n${endpoint.url} (${endpoint.id}, ${endpoint.status})`);
  if (enabled.has('*')) {
    console.log('  ✓ tous les événements sont activés (*)');
    continue;
  }
  const missing = required.filter((event) => !enabled.has(event));
  for (const event of required) console.log(`  ${enabled.has(event) ? '✓' : '✗'} ${event}`);
  if (missing.length === 0) continue;

  if (!apply) {
    incomplete = true;
    console.log(`  → ${missing.length} événement(s) manquant(s). Relancez avec --apply pour les ajouter.`);
    continue;
  }
  const body = new URLSearchParams();
  [...enabled, ...missing].forEach((event) => body.append('enabled_events[]', event));
  const update = await fetch(`https://api.stripe.com/v1/webhook_endpoints/${endpoint.id}`, { method: 'POST', headers, body });
  const result = await update.json();
  if (!update.ok) {
    console.error(`  Échec de la mise à jour : ${result.error?.message ?? update.status}`);
    process.exit(2);
  }
  console.log(`  ✔ ${missing.length} événement(s) ajouté(s) : ${missing.join(', ')}`);
}
process.exit(incomplete ? 1 : 0);
