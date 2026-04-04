

## Plan : Landing page premium

### Vision
Refonte complète de `src/pages/Landing.tsx` avec un design inspiré des meilleures landing pages SaaS (Linear, Vercel, Stripe). Animations fluides, sections visuellement impactantes, gradient hero immersif.

### Structure de la page

**1. Header** - Navbar sticky avec blur, logo "Delivery Performance", bouton CTA

**2. Hero** - Grand titre avec gradient text animé, sous-titre, 2 CTA. Background avec grille de points subtile + gradient radial violet/vert. Badges "Uber Eats" et "Deliveroo" avec leurs vrais logos (assets existants).

**3. Section logos partenaires** - Bandeau "Ils nous font confiance" avec :
- Logo Chicken Street (utilise `cs-logo.jpeg` existant dans `/src/assets/`) + "72 restaurants"
- Logo Tasty Crousty (texte stylisé, pas de logo dispo) + "75 restaurants"
- Logos Uber Eats + Deliveroo (assets existants)

**4. Section chiffres clés** - 4 KPIs animés (compteur animé avec `useAnimatedCounter` existant) : 147 restaurants, 2 plateformes, +15% croissance moyenne, 24/7 temps réel. Cards avec effet glassmorphism.

**5. Section fonctionnalités** - 3 colonnes avec icones, titre, description. Effet hover élégant avec border gradient.

**6. Section "Comment ça marche"** - 3 étapes numérotées (Connectez vos comptes → Importez vos données → Pilotez votre réseau)

**7. CTA final** - Section dark avec gradient, titre accrocheur, bouton "Demander une démo"

**8. Footer** - Copyright, liens, contact

### Fichier modifie
- `src/pages/Landing.tsx` : refonte complète (un seul fichier)

### Details techniques
- Animations CSS via les keyframes existantes (`fade-in-up`, `scale-in`) + nouvelles animations d'entrée au scroll via `IntersectionObserver`
- Compteurs animés avec le hook `useAnimatedCounter` existant
- Logos plateformes via les imports existants (`uber-eats-logo.png`, `deliveroo-logo.png`, `cs-logo.jpeg`)
- Composants UI existants (`Button`, `Card`)
- Palette existante : primary violet, accent vert, glassmorphism
- Responsive mobile-first
- Aucune migration SQL, aucun changement backend

