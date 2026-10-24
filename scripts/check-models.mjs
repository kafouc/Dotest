#!/usr/bin/env node
// Vérifie que les modèles Groq configurés existent encore. Groq retire régulièrement des modèles
// (qwen/qwen3-32b, llama-3.1-8b-instant… arrêtés en 2026) : mieux vaut le savoir avant la panne.
//
//   GROQ_API_KEY=... node scripts/check-models.mjs
//
// Les modèles viennent des variables GROQ_MODEL_QUIZ / _SUMMARY / _THEMES, sinon des valeurs par défaut
// de lib/constants.ts (source unique).
import { readFileSync } from 'node:fs';

const key = process.env.GROQ_API_KEY;
if (!key) {
  console.log('::warning::GROQ_API_KEY absente : contrôle des modèles ignoré.');
  process.exit(0);
}

const constants = readFileSync(new URL('../lib/constants.ts', import.meta.url), 'utf8');
const configured = {};
for (const [name, variable] of [['quiz', 'GROQ_MODEL_QUIZ'], ['summary', 'GROQ_MODEL_SUMMARY'], ['themes', 'GROQ_MODEL_THEMES']]) {
  const fallback = constants.match(new RegExp(`process\\.env\\.${variable} \\?\\? '([^']+)'`))?.[1];
  configured[name] = process.env[variable] || fallback;
}

const response = await fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: `Bearer ${key}` } });
if (!response.ok) {
  console.error(`Impossible de lister les modèles Groq (HTTP ${response.status}).`);
  process.exit(2);
}
const available = new Set((await response.json()).data.map((m) => m.id));

let failed = false;
for (const [usage, model] of Object.entries(configured)) {
  if (!model) {
    console.error(`✗ ${usage} : aucun modèle configuré`);
    failed = true;
  } else if (available.has(model)) {
    console.log(`✓ ${usage} : ${model}`);
  } else {
    console.error(`✗ ${usage} : « ${model} » n'est plus proposé par Groq. Modèles disponibles : ${[...available].sort().join(', ')}`);
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
