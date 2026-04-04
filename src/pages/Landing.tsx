import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BarChart3, TrendingUp, Layers, ArrowRight, ChevronRight, Plug, Upload, LineChart, Shield, Clock, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { AnimatedNumber } from "@/components/ui/animated-number";
import uberEatsLogo from "@/assets/uber-eats-logo.png";
import deliverooLogo from "@/assets/deliveroo-logo.png";
import csLogo from "@/assets/cs-logo.jpeg";

const Landing = () => {
  const [kpisVisible, setKpisVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          observer.unobserve(e.target);
        }
      }),
      { threshold: 0.1 }
    );
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

    // Separate observer for KPI animated numbers
    const kpiObs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setKpisVisible(true); kpiObs.disconnect(); } },
      { threshold: 0.3 }
    );
    const kpiEl = document.getElementById('kpi-section');
    if (kpiEl) kpiObs.observe(kpiEl);

    return () => { observer.disconnect(); kpiObs.disconnect(); };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Reveal CSS */}
      <style>{`
        .reveal {
          opacity: 0;
          transform: translateY(30px);
          transition: opacity 0.6s ease-out, transform 0.6s ease-out;
        }
        .reveal.visible {
          opacity: 1;
          transform: translateY(0);
        }
      `}</style>

      {/* ── Header ── */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-border/50 bg-background/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">Delivery Performance</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="mailto:api@opineo.io?subject=Demande de démo - Delivery Performance">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex">Demander une démo</Button>
            </a>
            <Link to="/login">
              <Button size="sm">Se connecter <ChevronRight className="h-4 w-4" /></Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative pt-32 pb-20 md:pt-44 md:pb-32">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] rounded-full bg-primary/8 blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-accent/6 blur-[100px]" />
          <div className="absolute inset-0" style={{
            backgroundImage: "radial-gradient(hsl(var(--muted-foreground) / 0.12) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }} />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-8 animate-fade-in">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card/80 text-xs font-medium text-muted-foreground backdrop-blur-sm">
              <img src={uberEatsLogo} alt="Uber Eats" className="h-4 w-4 rounded-sm object-contain" />
              Uber Eats
            </span>
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card/80 text-xs font-medium text-muted-foreground backdrop-blur-sm">
              <img src={deliverooLogo} alt="Deliveroo" className="h-4 w-4 object-contain" />
              Deliveroo
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6 animate-fade-in">
            <span className="bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text text-transparent">
              Le pilotage delivery
            </span>
            <br />
            <span className="bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
              pour les réseaux ambitieux
            </span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in" style={{ animationDelay: "0.1s" }}>
            Centralisez vos données Uber Eats et Deliveroo. Analysez les performances de chaque restaurant. Prenez les bonnes décisions.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <a href="mailto:api@opineo.io?subject=Demande de démo - Delivery Performance">
              <Button size="lg" className="w-full sm:w-auto text-base px-8 h-12 shadow-lg shadow-primary/25">
                Demander une démo <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
            <Link to="/login">
              <Button variant="outline" size="lg" className="w-full sm:w-auto text-base px-8 h-12">
                Se connecter
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Trust Logos ── */}
      <section className="py-16 border-y border-border/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="reveal text-center text-sm font-medium text-muted-foreground uppercase tracking-widest mb-10">
            Ils nous font confiance
          </p>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16">
            <div className="reveal flex items-center gap-4 group" style={{ transitionDelay: "100ms" }}>
              <img src={csLogo} alt="Chicken Street" className="h-14 w-14 rounded-xl object-cover border border-border shadow-sm group-hover:shadow-md transition-shadow" />
              <div>
                <p className="font-semibold text-foreground">Chicken Street</p>
                <p className="text-sm text-muted-foreground">72 restaurants</p>
              </div>
            </div>
            <div className="reveal flex items-center gap-4 group" style={{ transitionDelay: "200ms" }}>
              <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center border border-border shadow-sm group-hover:shadow-md transition-shadow">
                <span className="text-xl font-black text-white">TC</span>
              </div>
              <div>
                <p className="font-semibold text-foreground">Tasty Crousty</p>
                <p className="text-sm text-muted-foreground">75 restaurants</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── KPIs ── */}
      <section id="kpi-section" className="py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { value: 147, suffix: "", label: "Restaurants suivis", icon: BarChart3 },
              { value: 2, suffix: "", label: "Plateformes intégrées", icon: Layers },
              { value: 15, suffix: "%", label: "Croissance moyenne", prefix: "+", icon: TrendingUp },
              { value: 24, suffix: "/7", label: "Données en temps réel", icon: Clock },
            ].map((kpi, i) => (
              <div
                key={kpi.label}
                className="reveal relative group rounded-2xl border border-border/60 bg-card/50 backdrop-blur-sm p-6 md:p-8 text-center hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <kpi.icon className="h-6 w-6 text-primary mx-auto mb-4 opacity-60 group-hover:opacity-100 transition-opacity" />
                <p className="text-3xl md:text-4xl font-bold text-foreground mb-1">
                  {kpi.prefix || ""}
                  {kpisVisible ? <AnimatedNumber value={kpi.value} duration={800} /> : "0"}
                  {kpi.suffix}
                </p>
                <p className="text-sm text-muted-foreground">{kpi.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-20 md:py-28 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="reveal text-3xl md:text-4xl font-bold text-foreground mb-4">
              Tout pour piloter votre réseau
            </h2>
            <p className="reveal text-muted-foreground text-lg max-w-2xl mx-auto" style={{ transitionDelay: "100ms" }}>
              Des outils puissants pour comprendre, comparer et optimiser chaque restaurant.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {[
              {
                icon: LineChart,
                title: "Analytics avancés",
                desc: "CA, commandes, panier moyen, conversion — suivez chaque KPI en temps réel avec des graphiques interactifs.",
              },
              {
                icon: Layers,
                title: "Multi-marques & comparaison",
                desc: "Gérez plusieurs enseignes, comparez les performances entre restaurants et identifiez les meilleures pratiques.",
              },
              {
                icon: Shield,
                title: "Opérations & qualité",
                desc: "Temps de préparation, taux d'erreur, avis clients — maîtrisez la qualité de service sur chaque point de vente.",
              },
              {
                icon: Star,
                title: "Avis & satisfaction",
                desc: "Analysez les avis clients, identifiez les produits top/flop et suivez l'évolution de vos notes.",
              },
              {
                icon: TrendingUp,
                title: "Rentabilité détaillée",
                desc: "Commissions, frais marketing, promotions — visualisez la rentabilité réelle de chaque restaurant.",
              },
              {
                icon: BarChart3,
                title: "Rapports automatisés",
                desc: "Recevez des rapports hebdomadaires par WhatsApp et exportez vos données en un clic.",
              },
            ].map((feat, i) => (
              <div
                key={feat.title}
                className="reveal group rounded-2xl border border-border/60 bg-card p-6 lg:p-8 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1"
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/15 transition-colors">
                  <feat.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{feat.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="reveal text-3xl md:text-4xl font-bold text-foreground mb-4">
              Démarrez en 3 étapes
            </h2>
            <p className="reveal text-muted-foreground text-lg" style={{ transitionDelay: "100ms" }}>
              De la connexion à l'analyse, en quelques minutes.
            </p>
          </div>

          <div className="space-y-0">
            {[
              { step: "01", icon: Plug, title: "Connectez vos comptes", desc: "Reliez vos comptes Uber Eats et Deliveroo en quelques clics. Vos données sont synchronisées automatiquement." },
              { step: "02", icon: Upload, title: "Importez vos rapports", desc: "Uploadez vos rapports CSV pour enrichir l'analyse : revenus, commissions, performance opérationnelle." },
              { step: "03", icon: LineChart, title: "Pilotez votre réseau", desc: "Accédez à des dashboards interactifs, comparez vos restaurants et prenez des décisions data-driven." },
            ].map((s, i) => (
              <div key={s.step} className="reveal relative flex gap-6 md:gap-8 pb-12 last:pb-0" style={{ transitionDelay: `${i * 100}ms` }}>
                {i < 2 && <div className="absolute left-[27px] md:left-[31px] top-14 bottom-0 w-px bg-border" />}
                <div className="relative z-10 flex-shrink-0">
                  <div className="h-14 w-14 md:h-16 md:w-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <s.icon className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <div className="pt-1">
                  <span className="text-xs font-bold text-primary/60 uppercase tracking-wider">Étape {s.step}</span>
                  <h3 className="text-xl font-semibold text-foreground mt-1 mb-2">{s.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="reveal relative rounded-3xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-accent opacity-95" />
            <div className="absolute inset-0" style={{
              backgroundImage: "radial-gradient(rgba(255,255,255,0.1) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }} />

            <div className="relative px-8 py-16 md:px-16 md:py-20 text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
                Prêt à transformer vos données en décisions ?
              </h2>
              <p className="text-primary-foreground/80 text-lg mb-8 max-w-xl mx-auto">
                Rejoignez les réseaux qui utilisent Delivery Performance pour piloter leur croissance.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a href="mailto:api@opineo.io?subject=Demande de démo - Delivery Performance">
                  <Button size="lg" variant="secondary" className="w-full sm:w-auto text-base px-8 h-12 font-semibold">
                    Demander une démo <ArrowRight className="h-4 w-4" />
                  </Button>
                </a>
                <Link to="/login">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto text-base px-8 h-12 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
                    Se connecter
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-primary flex items-center justify-center">
              <BarChart3 className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="font-medium text-foreground">Delivery Performance</span>
            <span className="text-muted-foreground">© 2026 Opineo</span>
          </div>
          <div className="flex gap-6">
            <Link to="/privacy-policy" className="hover:text-foreground transition-colors">
              Politique de confidentialité
            </Link>
            <a href="mailto:api@opineo.io" className="hover:text-foreground transition-colors">
              api@opineo.io
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
