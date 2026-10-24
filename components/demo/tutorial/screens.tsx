'use client';

import { useEffect, useState } from 'react';
import MockFrame from './MockFrame';

/* Écrans simulés du tutoriel. Données fictives cohérentes (cours de chimie sur les combustions), rien n'est envoyé au serveur. */

const THEMES = ['Triangle du feu', 'Combustion incomplète', 'Monoxyde de carbone', 'Éteindre un feu'];

export function IntroScreen() {
  const steps = [
    ['Ajouter un cours', true],
    ['Générer un premier quiz', false],
    ['Répondre au quiz', false],
    ['Réviser vos erreurs', false],
  ] as const;
  return (
    <MockFrame title="Accueil de l’application">
      <p className="font-heading text-lg font-bold text-brand-dark">Bonjour 👋</p>
      <p className="text-sm text-gray-600">Voici comment démarrer :</p>
      <div className="mt-4 rounded-xl border border-brand-yellow bg-brand-yellow-light p-4">
        <p className="mb-3 text-sm font-bold text-brand-dark">Démarrage : 1/4 étapes</p>
        <ol className="space-y-2">
          {steps.map(([label, done], i) => (
            <li key={label} className="flex items-center gap-3 text-sm">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${done ? 'bg-green-600 text-white' : i === 1 ? 'bg-brand-yellow text-brand-dark' : 'bg-white text-gray-400'}`}>{done ? '✓' : i + 1}</span>
              <span className={done ? 'text-gray-500 line-through' : 'font-semibold text-brand-dark'}>{label}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="mt-3 rounded-xl border border-brand-teal bg-brand-teal-light p-3 text-sm text-brand-dark">🔔 <strong>Ne ratez plus une révision</strong> : activez les rappels en un clic.</div>
    </MockFrame>
  );
}

export function UploadScreen() {
  const [stage, setStage] = useState<'idle' | 'uploading' | 'done'>('idle');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (stage !== 'uploading') return;
    const timer = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(timer);
          setStage('done');
          return 100;
        }
        return p + 20;
      });
    }, 280);
    return () => clearInterval(timer);
  }, [stage]);

  return (
    <MockFrame title="Import d’un document">
      <p className="font-heading text-base font-bold text-brand-dark">Nouveau document</p>
      <div className="mt-3 rounded-xl border-2 border-dashed border-gray-300 p-6 text-center">
        <p className="text-3xl" aria-hidden="true">📄</p>
        <p className="mt-1 text-sm text-gray-700">Glissez votre cours ici</p>
        <p className="text-xs text-gray-500">PDF, Word, PowerPoint — 50 Mo max</p>
      </div>
      {stage === 'idle' && (
        <button type="button" onClick={() => { setProgress(0); setStage('uploading'); }} className="mt-4 w-full rounded-full bg-brand-yellow px-4 py-2.5 text-sm font-semibold text-brand-dark hover:bg-brand-yellow-dark">
          Ajouter le fichier « Chimie – Les combustions.pdf »
        </button>
      )}
      {stage !== 'idle' && (
        <div className="mt-4 rounded-xl bg-gray-50 p-3" aria-live="polite">
          <div className="flex items-center justify-between text-sm">
            <span className="truncate font-medium text-brand-dark">Chimie – Les combustions.pdf</span>
            <span className="text-xs text-gray-500">38 pages · 2,4 Mo</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Import en cours">
            <div className="h-full rounded-full bg-brand-teal transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-xs font-semibold text-green-700">{stage === 'done' ? '✓ Importé : l’analyse démarre' : 'Envoi du fichier…'}</p>
        </div>
      )}
    </MockFrame>
  );
}

const ANALYSIS_STEPS = ['Lecture du document (38 pages)', 'Découpage en passages avec leurs pages', 'Indexation pour la recherche', 'Prêt : 41 passages indexés'];

export function AnalysisScreen() {
  const [done, setDone] = useState(0);
  useEffect(() => {
    setDone(0);
    const timer = setInterval(() => setDone((d) => (d >= ANALYSIS_STEPS.length ? d : d + 1)), 700);
    return () => clearInterval(timer);
  }, []);
  const ready = done >= ANALYSIS_STEPS.length;
  return (
    <MockFrame title="Analyse du document">
      <div className="flex items-center justify-between">
        <p className="truncate font-heading text-base font-bold text-brand-dark">Chimie – Les combustions.pdf</p>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ready ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{ready ? 'Prêt' : 'En cours d’analyse'}</span>
      </div>
      <ul className="mt-4 space-y-3" aria-live="polite">
        {ANALYSIS_STEPS.map((label, index) => {
          const state = index < done ? 'done' : index === done ? 'doing' : 'todo';
          return (
            <li key={label} className="flex items-center gap-3 text-sm">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${state === 'done' ? 'bg-green-600 text-white' : state === 'doing' ? 'animate-pulse bg-brand-yellow text-brand-dark' : 'bg-gray-100 text-gray-400'}`}>{state === 'done' ? '✓' : index + 1}</span>
              <span className={state === 'todo' ? 'text-gray-400' : 'text-brand-dark'}>{label}</span>
            </li>
          );
        })}
      </ul>
      <div className="mt-5 rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
        💡 Si l’analyse reste bloquée, le bouton <strong>« Relancer l’analyse »</strong> la reprend sans doublon.
      </div>
    </MockFrame>
  );
}

export function GenerateScreen() {
  const [theme, setTheme] = useState<string | null>(null);
  const [count, setCount] = useState(5);
  const [mode, setMode] = useState<'QCU' | 'QCM' | 'Vrai/Faux'>('QCU');
  const [state, setState] = useState<'idle' | 'loading' | 'ready'>('idle');

  useEffect(() => {
    if (state !== 'loading') return;
    const timer = setTimeout(() => setState('ready'), 1200);
    return () => clearTimeout(timer);
  }, [state]);

  const chip = (active: boolean) => `rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${active ? 'border-brand-yellow bg-brand-yellow text-brand-dark' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`;

  return (
    <MockFrame title="Génération d’un quiz">
      <p className="font-heading text-base font-bold text-brand-dark">Générer un quiz</p>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Thème</p>
      <div className="mt-1.5 flex flex-wrap gap-2" role="group" aria-label="Thèmes proposés">
        {THEMES.map((t) => (
          <button key={t} type="button" aria-pressed={theme === t} onClick={() => { setTheme(t); setState('idle'); }} className={chip(theme === t)}>{t}</button>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Questions</p>
          <div className="mt-1.5 flex gap-2" role="group" aria-label="Nombre de questions">
            {[5, 7, 10].map((n) => (<button key={n} type="button" aria-pressed={count === n} onClick={() => setCount(n)} className={chip(count === n)}>{n}</button>))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Format</p>
          <div className="mt-1.5 flex flex-wrap gap-2" role="group" aria-label="Format des questions">
            {(['QCU', 'QCM', 'Vrai/Faux'] as const).map((m) => (<button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={chip(mode === m)}>{m}</button>))}
          </div>
        </div>
      </div>
      <button
        type="button"
        disabled={!theme || state === 'loading'}
        onClick={() => setState('loading')}
        className="mt-5 w-full rounded-full bg-brand-yellow px-4 py-2.5 text-sm font-semibold text-brand-dark hover:bg-brand-yellow-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {state === 'loading' ? 'Lecture du cours et rédaction…' : 'Générer le quiz'}
      </button>
      {!theme && <p className="mt-2 text-center text-xs text-gray-500">Choisissez d’abord un thème.</p>}
      {state === 'ready' && (
        <p role="status" className="mt-3 rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-800">✓ {count} questions {mode} prêtes sur « {theme} », chacune avec sa source. Passez à l’étape suivante pour y répondre.</p>
      )}
    </MockFrame>
  );
}

const QUIZ_OPTIONS = ['Le combustible, le comburant et une énergie d’activation', 'L’eau, l’air et la terre', 'Le feu, la fumée et la cendre', 'Le gaz, le bois et le papier'];

export function QuizScreen() {
  const [picked, setPicked] = useState<number | null>(null);
  const correct = 0;
  return (
    <MockFrame title="Quiz généré">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500" aria-live="polite">Question 1 sur 5</p>
      <p className="mt-1.5 font-heading text-base font-bold text-brand-dark">Quels sont les trois éléments du triangle du feu ?</p>
      <ul className="mt-3 space-y-2">
        {QUIZ_OPTIONS.map((option, index) => {
          const isRight = picked !== null && index === correct;
          const isWrong = picked === index && index !== correct;
          return (
            <li key={option}>
              <button
                type="button"
                disabled={picked !== null}
                onClick={() => setPicked(index)}
                className={`flex w-full items-start gap-3 rounded-lg border-2 px-3 py-2 text-left text-sm transition-colors ${isRight ? 'border-green-500 bg-green-50' : isWrong ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white hover:border-brand-yellow hover:bg-brand-yellow-light'} ${picked !== null && !isRight && !isWrong ? 'opacity-60' : ''}`}
              >
                <span className="font-bold text-brand-dark">{'ABCD'[index]}</span>
                <span>{option}</span>
                {isRight && <span className="sr-only"> (bonne réponse)</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {picked !== null && (
        <div className="mt-3 space-y-1.5 rounded-lg bg-gray-50 p-3 text-sm" aria-live="polite">
          <p className={`font-semibold ${picked === correct ? 'text-green-700' : 'text-red-700'}`}>{picked === correct ? 'Bonne réponse !' : 'Raté. Bonne réponse : A'}</p>
          <p className="text-gray-700">Sans l’un des trois, la combustion s’arrête.</p>
          <p className="rounded-md border-l-4 border-brand-teal bg-white p-2 text-xs italic text-gray-600">
            <span className="not-italic font-semibold text-brand-teal-dark">Source — page 2 :</span> « Pour qu’une combustion ait lieu, il faut réunir trois éléments : un combustible, un comburant et une énergie d’activation. »
          </p>
          <button type="button" onClick={() => setPicked(null)} className="text-xs font-medium text-brand-dark underline">Réessayer cette question</button>
        </div>
      )}
    </MockFrame>
  );
}

export function ReviewScreen() {
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(3);
  const goal = 10;
  const rate = () => {
    setDone((d) => Math.min(goal, d + 1));
    setFlipped(false);
  };
  return (
    <MockFrame title="Réviser aujourd’hui">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Objectif du jour</p>
          <p className="font-heading text-2xl font-bold text-brand-dark" aria-live="polite">{done}<span className="text-base font-semibold text-gray-500"> / {goal} cartes</span></p>
        </div>
        <p className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">🔥 4 jours d’affilée</p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={goal} aria-label="Progression de l’objectif du jour">
        <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${(done / goal) * 100}%` }} />
      </div>
      <div className="mt-4 rounded-xl border bg-brand-yellow-light p-4">
        <span className="mb-2 inline-block rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-orange-700">Erreur d’un quiz</span>
        <p className="text-sm font-medium text-gray-900">Pourquoi ne faut-il jamais utiliser de l’eau sur un feu d’huile ?</p>
        {flipped ? (
          <p className="mt-2 text-sm text-gray-800">L’eau propage l’huile enflammée. Il faut étouffer le feu avec un couvercle ou une couverture.</p>
        ) : (
          <button type="button" onClick={() => setFlipped(true)} className="mt-3 rounded-md bg-brand-yellow px-3 py-1.5 text-sm font-semibold text-brand-dark hover:bg-brand-yellow-dark">Afficher la réponse</button>
        )}
      </div>
      {flipped && (
        <div className="mt-3 grid grid-cols-4 gap-1.5 text-xs">
          {[['À revoir', 'bg-red-500', 'demain'], ['Difficile', 'bg-orange-500', 'dans 2 j'], ['Bien', 'bg-green-600', 'dans 6 j'], ['Facile', 'bg-emerald-600', 'dans 12 j']].map(([label, color, next]) => (
            <button key={label} type="button" onClick={rate} className={`rounded-md px-1 py-2 font-semibold text-white ${color}`}>
              {label}
              <span className="block text-[10px] font-normal opacity-90">{next}</span>
            </button>
          ))}
        </div>
      )}
    </MockFrame>
  );
}

/** QR code factice (motif décoratif, non scannable) */
function QrMock() {
  const modules: React.ReactNode[] = [];
  for (let y = 0; y < 21; y++) {
    for (let x = 0; x < 21; x++) {
      const inFinder = (x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12);
      if (!inFinder && (x * 7 + y * 13 + x * y) % 3 === 0) modules.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#333" />);
    }
  }
  const finder = (ox: number, oy: number) => (
    <g key={`f${ox}-${oy}`}>
      <rect x={ox} y={oy} width="7" height="7" fill="#333" />
      <rect x={ox + 1} y={oy + 1} width="5" height="5" fill="#fff" />
      <rect x={ox + 2} y={oy + 2} width="3" height="3" fill="#333" />
    </g>
  );
  return (
    <svg viewBox="0 0 21 21" className="h-20 w-20 shrink-0 rounded-lg border border-gray-200 bg-white p-1" aria-label="QR code de la séance" role="img" shapeRendering="crispEdges">
      {modules}
      {finder(0, 0)}
      {finder(14, 0)}
      {finder(0, 14)}
    </svg>
  );
}

const PSEUDOS = ['Léa', 'Karim', 'Noa', 'Inès', 'Tom', 'Yanis'];

export function TeacherScreen() {
  const [joined, setJoined] = useState(3);
  const bars = [82, 64, 38, 71, 55];
  return (
    <MockFrame title="Séance en direct">
      <div className="flex items-center gap-4">
        <QrMock />
        <div>
          <p className="text-xs text-gray-500">Code de la séance</p>
          <p className="font-mono text-2xl font-bold tracking-widest text-brand-dark">K7P3QX</p>
          <p className="text-xs text-gray-500">sheetofpaper.app/join</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-brand-dark" aria-live="polite">{joined} participants</p>
        <button type="button" disabled={joined >= PSEUDOS.length} onClick={() => setJoined((n) => Math.min(PSEUDOS.length, n + 1))} className="rounded-full bg-brand-teal px-3 py-1 text-xs font-semibold text-white hover:bg-brand-teal-dark disabled:opacity-50">
          Un élève rejoint
        </button>
      </div>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {PSEUDOS.slice(0, joined).map((p) => (<li key={p} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-700">{p}</li>))}
      </ul>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-500">Réussite par question</p>
      <ol className="mt-1.5 space-y-1.5">
        {bars.map((value, i) => (
          <li key={i} className="flex items-center gap-2 text-xs">
            <span className="w-4 text-gray-500">{i + 1}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100"><div className={`h-full rounded-full ${value < 50 ? 'bg-red-400' : 'bg-brand-teal'}`} style={{ width: `${value}%` }} /></div>
            <span className="w-9 text-right font-semibold text-gray-700">{value} %</span>
          </li>
        ))}
      </ol>
      <p className="mt-2 rounded-md bg-orange-50 p-2 text-xs text-orange-800">À reprendre en cours : question 3 (38 %).</p>
    </MockFrame>
  );
}

export function MobileScreen() {
  const [opened, setOpened] = useState(false);
  return (
    <MockFrame title="Téléphone avec notification" tone="phone">
      <p className="mt-2 text-center text-xs text-gray-400">9:41</p>
      {!opened ? (
        <button type="button" onClick={() => setOpened(true)} className="mt-4 w-full rounded-2xl border border-gray-200 bg-gray-50 p-3 text-left shadow-md transition-transform hover:scale-[1.02]">
          <span className="flex items-center gap-2 text-[11px] text-gray-500"><span className="flex h-5 w-5 items-center justify-center rounded-md bg-brand-yellow text-[10px] font-bold text-brand-dark">SP</span> Sheet of Paper · maintenant</span>
          <span className="mt-1 block text-sm font-bold text-brand-dark">☀️ Bonjour ! 5 minutes pour réviser ?</span>
          <span className="block text-xs text-gray-600">6 cartes vous attendent aujourd’hui. Série en cours : 4 jours.</span>
        </button>
      ) : (
        <div className="mt-4 space-y-3" aria-live="polite">
          <p className="font-heading text-base font-bold text-brand-dark">À réviser aujourd’hui</p>
          <div className="rounded-xl bg-brand-yellow-light p-3 text-sm text-brand-dark">6 cartes à revoir · dont 2 tirées de vos erreurs</div>
          <div className="rounded-full bg-brand-yellow px-4 py-2 text-center text-sm font-semibold text-brand-dark">Commencer la révision</div>
          <button type="button" onClick={() => setOpened(false)} className="text-xs text-gray-500 underline">Revoir la notification</button>
        </div>
      )}
      <ul className="mt-6 space-y-1.5 text-xs text-gray-600">
        <li>☀️ Matin — vos cartes du jour</li>
        <li>🧠 13 h — révision espacée</li>
        <li>🌙 Soir — sauvez votre série</li>
      </ul>
    </MockFrame>
  );
}
