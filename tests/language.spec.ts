import { describe, it, expect } from 'vitest';
import { detectLanguage, languageInstruction } from '@/lib/language';
import { buildQuizPrompt } from '@/lib/quizGeneration';

const samples: Record<string, string> = {
  fr: "La combustion est une réaction chimique entre un combustible et un comburant. Elle libère de l'énergie sous forme de chaleur et de lumière, et elle nécessite une énergie d'activation pour démarrer. Si l'on supprime l'un des éléments du triangle du feu, la combustion s'arrête dans la plupart des cas.",
  en: "The industrial revolution began in Great Britain around 1760. It describes the transition from an agricultural economy to one based on machine manufacturing, and it was driven by several factors, including the availability of coal and the growth of the empire, which provided raw materials and markets.",
  es: "La fotosíntesis es el proceso por el cual las plantas verdes transforman la luz del sol en energía química. Este proceso se realiza en los cloroplastos y produce glucosa y oxígeno, que es liberado a la atmósfera para que los seres vivos puedan respirar.",
  de: "Die Photosynthese ist der Vorgang, bei dem Pflanzen Lichtenergie in chemische Energie umwandeln. Dieser Prozess findet in den Chloroplasten statt und erzeugt Traubenzucker und Sauerstoff, der an die Umwelt abgegeben wird, damit die Lebewesen atmen können.",
  it: "La fotosintesi è il processo con il quale le piante verdi trasformano la luce del sole in energia chimica. Questo processo avviene nei cloroplasti e produce glucosio e ossigeno, che viene rilasciato nell'atmosfera per permettere agli esseri viventi di respirare.",
  pt: "A fotossíntese é o processo pelo qual as plantas verdes transformam a luz do sol em energia química. Este processo acontece nos cloroplastos e produz glicose e oxigénio, que é libertado para a atmosfera para que os seres vivos possam respirar também.",
  nl: "De fotosynthese is het proces waarbij groene planten het licht van de zon omzetten in chemische energie. Dit proces vindt plaats in de chloroplasten en levert glucose en zuurstof op, die wordt afgegeven aan de lucht zodat de levende wezens kunnen ademen.",
};

describe('detectLanguage', () => {
  for (const [code, text] of Object.entries(samples)) {
    it(`reconnaît ${code}`, () => {
      expect(detectLanguage(text).code).toBe(code);
    });
  }

  it('garde le français pour un texte trop court ou sans mots courants', () => {
    expect(detectLanguage('Bonjour').code).toBe('fr');
    expect(detectLanguage('x1 y2 z3 '.repeat(30)).code).toBe('fr');
    expect(detectLanguage('').confidence).toBe(0);
  });
});

describe('consigne de langue', () => {
  it('demande une sortie dans la langue du cours', () => {
    expect(languageInstruction(detectLanguage(samples.en))).toContain('anglais');
  });

  it('le prompt de quiz suit la langue des passages', () => {
    const passage = { id: 1, content: samples.es, pageStart: 1, pageEnd: 1, similarity: null, rerankScore: null };
    const prompt = buildQuizPrompt({ passages: [passage], count: 3, mode: 'qcu' });
    expect(prompt).toContain('en espagnol');
    expect(prompt).not.toContain('en français, fondées');
  });
});
