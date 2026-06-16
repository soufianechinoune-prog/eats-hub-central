import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  BarChart3, TrendingUp, Layers, ArrowRight, ChevronRight,
  Zap, Shield, Star, Clock, ChevronDown, Menu, X,
  LineChart, PieChart, Bell, Smartphone
} from "lucide-react";
import uberEatsLogo from "@/assets/uber-eats-logo.png";
import deliverooLogo from "@/assets/deliveroo-logo.png";
import csLogo from "@/assets/cs-logo.jpeg";

// Animation variants
const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5 } },
};

// Mock dashboard data for hero animation
const mockData = [65, 78, 52, 91, 83, 96, 74, 88, 71, 95, 82, 100];
const mockRestaurants = [
  { name: "Argenteuil", ca: "18 420 €", note: 4.5, delta: "+8%" },
  { name: "Montreuil", ca: "15 200 €", note: 4.1, delta: "+3%" },
  { name: "Angers", ca: "14 800 €", note: 4.4, delta: "+12%" },
  { name: "Reims", ca: "13 900 €", note: 4.2, delta: "+5%" },
];

export default function Landing() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ── Nav ── */}
      <motion.header
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="fixed top-0 inset-x-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold tracking-tight">Delivery Performance</span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Fonctionnalités</a>
            <a href="#how" className="hover:text-foreground transition-colors">Comment ça marche</a>
            <a href="#clients" className="hover:text-foreground transition-colors">Clients</a>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <a href="mailto:api@opineo.io?subject=Demande de démo">
              <Button variant="ghost" size="sm">Demander une démo</Button>
            </a>
            <Link to="/login">
              <Button size="sm">
                Se connecter <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </Link>
          </div>

          <button className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden border-t border-border bg-background px-4 pb-4 space-y-3"
            >
              <a href="#features" className="block pt-4 text-sm text-muted-foreground">Fonctionnalités</a>
              <a href="#how" className="block text-sm text-muted-foreground">Comment ça marche</a>
              <a href="#clients" className="block text-sm text-muted-foreground">Clients</a>
              <div className="flex gap-3 pt-2">
                <Link to="/login" className="flex-1">
                  <Button size="sm" className="w-full">Se connecter</Button>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* ── Hero ── */}
      <section ref={heroRef} className="relative min-h-screen flex items-center pt-16 overflow-hidden">
        {/* Bg glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[700px] rounded-full bg-primary/10 blur-[140px]" />
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-accent/8 blur-[120px]" />
          {/* Grid */}
          <div className="absolute inset-0 opacity-[0.04]" style={{
            backgroundImage: "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "48px 48px"
          }} />
        </div>

        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-20 lg:py-0">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* Left */}
            <motion.div variants={stagger} initial="hidden" animate="visible">
              <motion.div variants={fadeUp} className="flex items-center gap-2 mb-6">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-primary/30 bg-primary/5 text-xs font-medium text-primary">
                  <Zap className="h-3 w-3" /> Nouveau — Données en temps réel
                </span>
              </motion.div>

              <motion.h1 variants={fadeUp} className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05] mb-6">
                <span className="text-foreground">Pilotez</span>
                <br />
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  chaque restaurant
                </span>
                <br />
                <span className="text-foreground">au centime près.</span>
              </motion.h1>

              <motion.p variants={fadeUp} className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg">
                Agrégez Uber Eats, Deliveroo et vos caisses en un seul dashboard. Comparez vos restaurants, suivez la rentabilité réelle, agissez vite.
              </motion.p>

              <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 mb-10">
                <a href="mailto:api@opineo.io?subject=Demande de démo">
                  <Button size="lg" className="h-12 px-8 text-base shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-shadow">
                    Demander une démo <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </a>
                <Link to="/login">
                  <Button size="lg" variant="outline" className="h-12 px-8 text-base">
                    Se connecter
                  </Button>
                </Link>
              </motion.div>

              {/* Integrations */}
              <motion.div variants={fadeUp} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">Intègre</span>
                <div className="flex items-center gap-2">
                  <img src={uberEatsLogo} alt="Uber Eats" className="h-7 w-7 rounded-md object-contain border border-border bg-white p-0.5" />
                  <img src={deliverooLogo} alt="Deliveroo" className="h-7 w-7 rounded-md object-contain border border-border bg-white p-0.5" />
                  <span className="text-xs text-muted-foreground">et votre caisse</span>
                </div>
              </motion.div>
            </motion.div>

            {/* Right — Dashboard mockup */}
            <motion.div
              initial={{ opacity: 0, x: 60, rotateY: -5 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              <div className="relative rounded-2xl border border-border/60 bg-card shadow-2xl shadow-black/10 overflow-hidden">
                {/* Dashboard header */}
                <div className="border-b border-border/50 bg-card px-4 py-3 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-destructive/60" />
                    <div className="h-3 w-3 rounded-full bg-warning/60" />
                    <div className="h-3 w-3 rounded-full bg-accent/60" />
                  </div>
                  <span className="text-xs text-muted-foreground ml-2">Delivery Performance — Vue réseau</span>
                </div>

                <div className="p-4 space-y-4">
                  {/* KPI cards */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "CA réseau", value: "516k€", delta: "+7%", color: "text-accent" },
                      { label: "Commandes", value: "23 060", delta: "+10%", color: "text-primary" },
                      { label: "Note moy.", value: "4.3 ★", delta: "-0.1", color: "text-warning" },
                    ].map((kpi, i) => (
                      <motion.div
                        key={kpi.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 + i * 0.1 }}
                        className="rounded-xl border border-border/50 bg-background p-3"
                      >
                        <p className="text-xs text-muted-foreground mb-1">{kpi.label}</p>
                        <p className="text-lg font-bold text-foreground">{kpi.value}</p>
                        <p className={`text-xs font-medium ${kpi.color}`}>{kpi.delta}</p>
                      </motion.div>
                    ))}
                  </div>

                  {/* Chart */}
                  <div className="rounded-xl border border-border/50 bg-background p-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium text-foreground">CA mensuel</span>
                      <span className="text-xs text-muted-foreground">12 derniers mois</span>
                    </div>
                    <div className="flex items-end gap-1 h-20">
                      {mockData.map((val, i) => (
                        <motion.div
                          key={i}
                          initial={{ scaleY: 0 }}
                          animate={{ scaleY: 1 }}
                          transition={{ delay: 0.7 + i * 0.05, duration: 0.4, ease: "easeOut" }}
                          style={{ height: `${val}%`, originY: 1 }}
                          className={`flex-1 rounded-sm ${i === mockData.length - 1 ? 'bg-primary' : 'bg-primary/25'}`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Table */}
                  <div className="rounded-xl border border-border/50 bg-background overflow-hidden">
                    <div className="px-3 py-2 border-b border-border/40 flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground">Top restaurants</span>
                      <span className="text-xs text-primary cursor-pointer hover:underline">Voir tout</span>
                    </div>
                    <div className="divide-y divide-border/30">
                      {mockRestaurants.map((r, i) => (
                        <motion.div
                          key={r.name}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 1 + i * 0.08 }}
                          className="px-3 py-2 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <div className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center">
                              <span className="text-[9px] font-bold text-primary">{r.name[0]}</span>
                            </div>
                            <span className="text-xs font-medium text-foreground">{r.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground">{r.ca}</span>
                            <span className="text-xs font-medium text-accent">{r.delta}</span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: 1.2, type: "spring", stiffness: 200 }}
                className="absolute -bottom-4 -left-4 rounded-xl border border-border bg-card shadow-lg px-4 py-3 flex items-center gap-3"
              >
                <div className="h-8 w-8 rounded-full bg-accent/10 flex items-center justify-center">
                  <Bell className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">Alerte rentabilité</p>
                  <p className="text-xs text-muted-foreground">Montreuil — 3.1% ↘</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: 1.4, type: "spring", stiffness: 200 }}
                className="absolute -top-4 -right-4 rounded-xl border border-border bg-card shadow-lg px-4 py-3 flex items-center gap-3"
              >
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">+12% ce mois</p>
                  <p className="text-xs text-muted-foreground">vs mois précédent</p>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          </motion.div>
        </motion.div>
      </section>

      {/* ── Clients ── */}
      <section id="clients" className="py-16 border-y border-border/40 bg-muted/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-10"
          >
            Ils font confiance à Delivery Performance
          </motion.p>
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="flex flex-wrap justify-center items-center gap-10 md:gap-20"
          >
            <motion.div variants={fadeUp} className="flex items-center gap-4">
              <img src={csLogo} alt="Chicken Street" className="h-14 w-14 rounded-xl object-cover border border-border shadow-sm" />
              <div>
                <p className="font-bold text-foreground">Chicken Street</p>
                <p className="text-sm text-muted-foreground">103 restaurants</p>
              </div>
            </motion.div>
            <motion.div variants={fadeUp} className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center border border-border shadow-sm">
                <span className="text-xl font-black text-white">TC</span>
              </div>
              <div>
                <p className="font-bold text-foreground">Tasty Crousty</p>
                <p className="text-sm text-muted-foreground">62 restaurants</p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24 md:py-32">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-20"
          >
            <motion.p variants={fadeUp} className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">
              Fonctionnalités
            </motion.p>
            <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-black text-foreground mb-4">
              Tout ce dont un réseau a besoin
            </motion.h2>
            <motion.p variants={fadeUp} className="text-muted-foreground text-lg max-w-xl mx-auto">
              Des outils pensés pour les franchiseurs qui veulent des données fiables, pas des tableaux Excel.
            </motion.p>
          </motion.div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {[
              {
                icon: LineChart,
                title: "Analytics multi-canaux",
                desc: "CA, versement, rentabilité par restaurant — Uber Eats, Deliveroo et caisse centralisés en un seul endroit.",
                accent: "primary",
              },
              {
                icon: TrendingUp,
                title: "LFL — Périmètre constant",
                desc: "Comparez la vraie performance de vos restaurants, en neutralisant les ouvertures et fermetures.",
                accent: "accent",
              },
              {
                icon: Star,
                title: "Avis & satisfaction",
                desc: "Suivez vos notes Uber Eats, identifiez les restaurants qui décrochent, agissez avant qu'il soit trop tard.",
                accent: "warning",
              },
              {
                icon: Shield,
                title: "Erreurs & downtime",
                desc: "Taux d'erreur, temps d'indisponibilité, articles problématiques — tout ce qui impacte votre score qualité.",
                accent: "destructive",
              },
              {
                icon: PieChart,
                title: "Mix canal",
                desc: "Visualisez la répartition Uber / Deliveroo / Caisse et pilotez votre stratégie multicanal en temps réel.",
                accent: "primary",
              },
              {
                icon: Smartphone,
                title: "Alertes WhatsApp",
                desc: "Recevez les rapports hebdomadaires et alertes critiques directement sur WhatsApp, sans vous connecter.",
                accent: "accent",
              },
            ].map((feat, i) => (
              <motion.div
                key={feat.title}
                variants={fadeUp}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="group rounded-2xl border border-border/60 bg-card p-6 lg:p-8 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-colors duration-300 cursor-default"
              >
                <div className={`h-11 w-11 rounded-xl bg-${feat.accent}/10 flex items-center justify-center mb-5 group-hover:bg-${feat.accent}/15 transition-colors`}>
                  <feat.icon className={`h-5 w-5 text-${feat.accent}`} />
                </div>
                <h3 className="text-base font-bold text-foreground mb-2">{feat.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feat.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="py-24 md:py-32 bg-muted/20 border-y border-border/40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <motion.p variants={fadeUp} className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">
              Mise en place
            </motion.p>
            <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-black text-foreground mb-4">
              Opérationnel en 48h
            </motion.h2>
            <motion.p variants={fadeUp} className="text-muted-foreground text-lg">
              Pas de développement, pas d'intégration complexe. On s'occupe de tout.
            </motion.p>
          </motion.div>

          <div className="space-y-0 relative">
            <div className="absolute left-8 top-8 bottom-8 w-px bg-gradient-to-b from-primary/30 via-primary/20 to-transparent hidden md:block" />

            {[
              {
                n: "01",
                title: "On connecte vos plateformes",
                desc: "Uber Eats et Deliveroo sont branchés via API. Aucune manipulation de fichiers CSV pour les données récentes.",
              },
              {
                n: "02",
                title: "On importe l'historique",
                desc: "Vos données passées sont chargées automatiquement — jusqu'à 2 ans d'historique pour avoir les bons comparatifs.",
              },
              {
                n: "03",
                title: "Vous pilotez",
                desc: "Dashboard opérationnel dès le premier jour. Rapports hebdomadaires, alertes, et accès pour votre équipe.",
              },
            ].map((step, i) => (
              <motion.div
                key={step.n}
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.5 }}
                className="relative flex gap-6 md:gap-10 pb-12 last:pb-0"
              >
                <div className="relative z-10 flex-shrink-0">
                  <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <span className="text-lg font-black text-primary">{step.n}</span>
                  </div>
                </div>
                <div className="pt-3">
                  <h3 className="text-xl font-bold text-foreground mb-2">{step.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 md:py-32">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="relative rounded-3xl overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-accent" />
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: "radial-gradient(white 1px, transparent 1px)",
              backgroundSize: "20px 20px"
            }} />
            <div className="relative px-8 py-16 md:px-16 md:py-20 text-center">
              <h2 className="text-3xl md:text-4xl font-black text-primary-foreground mb-4">
                Prêt à voir vos données autrement ?
              </h2>
              <p className="text-primary-foreground/75 text-lg mb-8 max-w-lg mx-auto">
                Rejoignez Chicken Street et Tasty Crousty. Demandez une démo, on vous montre la plateforme sur vos propres données.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a href="mailto:api@opineo.io?subject=Demande de démo">
                  <Button size="lg" variant="secondary" className="h-12 px-8 text-base font-semibold w-full sm:w-auto">
                    Demander une démo <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </a>
                <Link to="/login">
                  <Button size="lg" variant="outline" className="h-12 px-8 text-base border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 w-full sm:w-auto">
                    Se connecter
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-primary flex items-center justify-center">
              <BarChart3 className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">Delivery Performance</span>
            <span>© 2026 Opineo</span>
          </div>
          <div className="flex gap-6">
            <Link to="/privacy-policy" className="hover:text-foreground transition-colors">
              Confidentialité
            </Link>
            <a href="mailto:api@opineo.io" className="hover:text-foreground transition-colors">
              api@opineo.io
            </a>
          </div>
        </div>
      </footer>

    </div>
  );
}
