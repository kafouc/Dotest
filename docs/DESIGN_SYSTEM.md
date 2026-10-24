# Design System - Sheet of Paper

## 🎨 Couleurs de la marque

### Couleurs principales
- **Yellow (Primaire)** : `#fbbf1d`
  - Classes Tailwind : `bg-brand-yellow`, `text-brand-yellow`
  - Variantes : `brand-yellow-dark` (#d4a017), `brand-yellow-light` (#fef3c7)

- **Teal (Secondaire)** : `#45BF9A`
  - Classes Tailwind : `bg-brand-teal`, `text-brand-teal`
  - Variantes : `brand-teal-dark` (#2d8f6f), `brand-teal-light` (#d1fae5)

- **Dark (Texte)** : `#333333`
  - Classes Tailwind : `text-brand-dark`, `bg-brand-dark`
  - Variantes : `brand-dark-light` (#4a4a4a), `brand-dark-lighter` (#666666)

### Variables shadcn/ui
Les couleurs sont également disponibles via les variables CSS de shadcn/ui :
- `--primary` : Yellow (#fbbf1d)
- `--secondary` : Teal (#45BF9A)
- `--foreground` : Dark (#333333)

## 🔤 Typographie

### Polices
- **Titres** : Unbounded (Google Fonts)
  - Classe : `font-heading`
  - Utilisation : Tous les `h1`, `h2`, `h3`, etc.

- **Corps de texte** : Questrial
  - Classe : `font-body` (par défaut)
  - Poids disponible : 400

### Utilisation
```tsx
// Titre
<h1 className="font-heading font-bold text-brand-dark">Titre</h1>

// Texte
<p className="font-body text-brand-dark">Texte normal</p>
```

## 🧩 Composants UI

### Composants personnalisés
- `LoadingSpinner` : Spinner de chargement
- `Toast` : Notifications toast
- `EmptyState` : États vides
- `ProgressBar` : Barre de progression

### shadcn/ui
Les composants shadcn/ui sont disponibles dans `components/ui/`. Pour ajouter un composant :

```bash
npx shadcn@latest add button
npx shadcn@latest add card
# etc.
```

### Utilisation de `cn()` pour combiner les classes
```tsx
import { cn } from '@/lib/cn';

<button className={cn(
  "px-4 py-2 rounded-md",
  isActive && "bg-brand-yellow",
  disabled && "opacity-50"
)}>
```

## 🎯 Bonnes pratiques

1. **Couleurs** : Utilisez toujours les classes `brand-*` au lieu des couleurs hardcodées
2. **Typographie** : Utilisez `font-heading` pour tous les titres
3. **shadcn/ui** : Utilisez les composants shadcn/ui pour les éléments de base (Button, Card, etc.)
4. **Accessibilité** : Toujours inclure les attributs ARIA et les labels

## 📝 Exemples

### Bouton primaire
```tsx
<button className="px-4 py-2 bg-brand-yellow text-brand-dark font-heading font-bold rounded-md hover:bg-brand-yellow-dark">
  Action
</button>
```

### Bouton secondaire
```tsx
<button className="px-4 py-2 bg-brand-teal text-white font-semibold rounded-md hover:bg-brand-teal-dark">
  Action
</button>
```

### Carte avec shadcn/ui
```tsx
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

<Card>
  <CardHeader>
    <CardTitle className="font-heading">Titre</CardTitle>
  </CardHeader>
  <CardContent>
    Contenu
  </CardContent>
</Card>
```

