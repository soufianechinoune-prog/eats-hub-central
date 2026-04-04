import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, Store, Zap, LayoutDashboard, TrendingUp, Layers } from "lucide-react";

const Landing = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold text-foreground">Delivery Performance</span>
          </div>
          <Link to="/login">
            <Button variant="outline" size="sm">Se connecter</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/5" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32 text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-6">
            La plateforme analytics pour les réseaux de franchise
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-10">
            Centralisez et analysez vos performances delivery Uber Eats et Deliveroo sur l'ensemble de votre réseau
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="mailto:api@opineo.io?subject=Demande de démo - Delivery Performance">
              <Button size="lg" className="w-full sm:w-auto">Demander une démo</Button>
            </a>
            <Link to="/login">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">Se connecter</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Chiffres clés */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-2xl font-bold text-center text-foreground mb-10">Chiffres clés</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { value: "147", label: "Restaurants suivis", icon: Store },
            { value: "2", label: "Plateformes intégrées", sublabel: "Uber Eats + Deliveroo", icon: Layers },
            { value: "24/7", label: "Données en temps réel", icon: Zap },
          ].map((stat) => (
            <Card key={stat.label} className="text-center">
              <CardContent className="pt-8 pb-6">
                <stat.icon className="h-8 w-8 text-primary mx-auto mb-4" />
                <p className="text-4xl font-bold text-foreground mb-2">{stat.value}</p>
                <p className="text-muted-foreground font-medium">{stat.label}</p>
                {stat.sublabel && (
                  <p className="text-sm text-muted-foreground mt-1">{stat.sublabel}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Fonctionnalités */}
      <section className="bg-muted/50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-center text-foreground mb-10">Fonctionnalités</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: LayoutDashboard,
                title: "Vue d'ensemble réseau",
                desc: "CA, commandes, notes clients — suivez la performance de tout votre réseau en un coup d'œil.",
              },
              {
                icon: TrendingUp,
                title: "Analytics avancés",
                desc: "Dashboard détaillé, revenus, ventes articles, taux de conversion — tout pour piloter votre croissance.",
              },
              {
                icon: Layers,
                title: "Multi-marques",
                desc: "Gérez plusieurs enseignes depuis une seule plateforme, comparez et optimisez chaque marque.",
              },
            ].map((feat) => (
              <Card key={feat.title}>
                <CardContent className="pt-8 pb-6">
                  <feat.icon className="h-8 w-8 text-accent mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">{feat.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{feat.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Confiance */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <h2 className="text-2xl font-bold text-foreground mb-10">Ils nous font confiance</h2>
        <div className="flex flex-wrap justify-center gap-12 items-center">
          {["Chicken Street", "Tasty Crousty"].map((name) => (
            <div key={name} className="flex items-center gap-3 px-6 py-4 rounded-lg border border-border bg-card">
              <Store className="h-6 w-6 text-primary" />
              <span className="text-lg font-semibold text-foreground">{name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>© 2026 Opineo — cs-delivery-performance.com</p>
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
