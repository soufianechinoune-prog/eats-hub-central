import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowRight,
  BarChart3,
  Bell,
  ChevronRight,
  Clock,
  Layers,
  LineChart,
  LogIn,
  Menu,
  PieChart,
  Plug,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Upload,
  X,
} from "lucide-react";
import csLogo from "@/assets/cs-logo.jpeg";
import uberEatsLogo from "@/assets/uber-eats-logo.png";
import deliverooLogo from "@/assets/deliveroo-logo.png";

/**
 * Landing page — Delivery Performance (Opineo)
 * Plateforme SaaS d'analytics pour franchises de restauration rapide
 * (Chicken Street, Tasty Crousty…), connectée à Uber Eats & Deliveroo.
 */

const DEMO_MAILTO =
  "mailto:api@opineo.io?subject=Demande de démo - Delivery Performance";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

const NAV_LINKS = [
  { label: "Fonctionnalités", href: "#features" },
  { label: "Comment ça marche", href: "#how" },
  { label: "FAQ", href: "#faq" },
];

const KPIS = [
  { value: "147", label: "Restaurants suivis" },
  { value: "2", label: "Plateformes intégrées" },
  { value: "+15 %", label: "Croissance moyenne" },
  { value: "24/7", label: "Données en temps réel" },
];

const FEATURES = [
  {
    icon: BarChart3,
    title: "Analytics avancés",
    description:
      "CA, commandes, panier moyen, conversion — suivez chaque KPI en temps réel avec des graphiques interactifs.",
  },
  {
    icon: Clock,
    title: "Performance de livraison",
    description:
      "Mesurez les temps de préparation et de livraison Uber Eats et Deliveroo, repérez les goulots et tenez vos promesses clients.",
  },
  {
    icon: Layers,
    title: "Multi-marques & comparaison",
    description:
      "Comparez Chicken Street, Tasty Crousty et l'ensemble de vos enseignes sur un même écran et diffusez les meilleures pratiques.",
  },
  {
    icon: TrendingUp,
    title: "Rentabilité détaillée",
    description:
      "Commissions, frais marketing, promotions — visualisez la rentabilité réelle de chaque restaurant.",
  },
  {
    icon: Bell,
    title: "Alertes & rapports",
    description:
      "Rapports hebdomadaires automatisés et alertes en cas de chute du chiffre d'affaires ou de délais anormaux.",
  },
  {
    icon: ShieldCheck,
    title: "Données sécurisées",
    description:
      "Hébergement conforme RGPD, chiffrement de bout en bout et contrôle d'accès par rôle.",
  },
];

const STEPS = [
  {
    icon: Plug,
    title: "Connectez vos comptes",
    description:
      "Reliez vos comptes Uber Eats et Deliveroo en quelques clics. Vos données sont synchronisées automatiquement.",
  },
  {
    icon: Upload,
    title: "Importez vos rapports",
    description:
      "Uploadez vos rapports CSV pour enrichir l'analyse : revenus, commissions, performance opérationnelle.",
  },
  {
    icon: LineChart,
    title: "Pilotez votre réseau",
    description:
      "Accédez à des dashboards interactifs, comparez vos restaurants et prenez des décisions data-driven.",
  },
];

const CLIENTS = [
  { name: "Chicken Street", detail: "72 restaurants", logo: csLogo },
  { name: "Tasty Crousty", detail: "75 restaurants", initials: "TC" },
];

const FAQ = [
  {
    q: "Combien de temps prend la mise en place ?",
    a: "Reliez vos comptes Uber Eats et Deliveroo en quelques clics : la synchronisation est automatique et vos premiers dashboards sont disponibles en quelques minutes.",
  },
  {
    q: "Mes données sont-elles sécurisées ?",
    a: "Oui. Les données sont chiffrées de bout en bout, hébergées dans l'UE et conformes au RGPD. L'accès est contrôlé par rôle pour chaque utilisateur.",
  },
  {
    q: "Puis-je gérer plusieurs enseignes ?",
    a: "Absolument. La plateforme est pensée pour le multi-enseigne : comparez Chicken Street, Tasty Crousty et toute autre marque depuis un tableau de bord unifié.",
  },
  {
    q: "Comment démarrer ?",
    a: "Demandez une démo à notre équipe ou connectez-vous si vous disposez déjà d'un accès. Nous vous accompagnons dans la connexion de vos plateformes.",
  },
];

const Landing = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ---------- Navigation ---------- */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2.5 font-bold text-lg">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BarChart3 className="h-5 w-5" />
            </span>
            <span className="tracking-tight">Delivery Performance</span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <Button variant="ghost" asChild>
              <a href={DEMO_MAILTO}>Demander une démo</a>
            </Button>
            <Button asChild>
              <Link to="/login">
                <LogIn className="h-4 w-4" />
                Se connecter
              </Link>
            </Button>
          </div>

          <button
            className="md:hidden"
            aria-label="Ouvrir le menu"
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="border-t bg-background md:hidden">
            <nav className="container mx-auto flex flex-col gap-1 px-4 py-4">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <div className="mt-2 flex flex-col gap-2">
                <Button variant="outline" asChild>
                  <a href={DEMO_MAILTO}>Demander une démo</a>
                </Button>
                <Button asChild>
                  <Link to="/login">
                    <LogIn className="h-4 w-4" />
                    Se connecter
                  </Link>
                </Button>
              </div>
            </nav>
          </div>
        )}
      </header>

      <main>
        {/* ---------- Hero ---------- */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/10 via-background to-background" />
          <div
            className="absolute inset-x-0 top-0 -z-10 h-96 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.18),transparent_60%)]"
            aria-hidden="true"
          />
          <div className="container mx-auto px-4 py-20 lg:py-28">
            <motion.div
              variants={stagger}
              initial="hidden"
              animate="visible"
              className="mx-auto max-w-3xl text-center"
            >
              <motion.div variants={fadeUp}>
                <Badge variant="secondary" className="mb-6 gap-1.5 px-3 py-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Analytics pour franchises de restauration rapide
                </Badge>
              </motion.div>

              <motion.h1
                variants={fadeUp}
                className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl"
              >
                Le pilotage delivery pour les{" "}
                <span className="text-primary">réseaux ambitieux</span>
              </motion.h1>

              <motion.p
                variants={fadeUp}
                className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground"
              >
                Centralisez vos données Uber Eats et Deliveroo, analysez la
                performance de chaque restaurant — Chicken Street, Tasty Crousty
                et toutes vos enseignes — et prenez les bonnes décisions.
              </motion.p>

              <motion.div
                variants={fadeUp}
                className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
              >
                <Button size="lg" className="text-base" asChild>
                  <a href={DEMO_MAILTO}>
                    Demander une démo
                    <ArrowRight className="h-5 w-5" />
                  </a>
                </Button>
                <Button variant="outline" size="lg" className="text-base" asChild>
                  <Link to="/login">
                    <LogIn className="h-5 w-5" />
                    Se connecter
                  </Link>
                </Button>
              </motion.div>
            </motion.div>

            {/* Dashboard mockup */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
              className="mx-auto mt-16 max-w-5xl"
            >
              <Card className="overflow-hidden border-2 shadow-2xl">
                <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-3">
                  <span className="h-3 w-3 rounded-full bg-destructive/60" />
                  <span className="h-3 w-3 rounded-full bg-success/60" />
                  <span className="h-3 w-3 rounded-full bg-primary/60" />
                  <span className="ml-3 text-xs text-muted-foreground">
                    Delivery Performance — Vue réseau
                  </span>
                </div>
                <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
                  {KPIS.map((kpi, i) => (
                    <motion.div
                      key={kpi.label}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.5 + i * 0.1 }}
                      className="rounded-xl border bg-card p-4"
                    >
                      <p className="text-2xl font-bold text-primary">
                        {kpi.value}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {kpi.label}
                      </p>
                    </motion.div>
                  ))}
                </div>
                <div className="grid gap-4 px-6 pb-6 lg:grid-cols-3">
                  <div className="rounded-xl border bg-card p-5 lg:col-span-2">
                    <div className="mb-4 flex items-center justify-between">
                      <p className="text-sm font-semibold">Ventes par enseigne</p>
                      <LineChart className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex h-32 items-end gap-2">
                      {[55, 72, 48, 88, 64, 95, 78, 60, 83].map((h, i) => (
                        <motion.div
                          key={i}
                          className="flex-1 rounded-t bg-gradient-to-t from-primary/40 to-primary"
                          initial={{ height: 0 }}
                          animate={{ height: `${h}%` }}
                          transition={{ delay: 0.7 + i * 0.05, duration: 0.5 }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border bg-card p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <p className="text-sm font-semibold">Mix commandes</p>
                      <PieChart className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="space-y-3">
                      {[
                        { label: "Sur place", v: 42 },
                        { label: "Livraison", v: 38 },
                        { label: "À emporter", v: 20 },
                      ].map((row, i) => (
                        <div key={row.label}>
                          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                            <span>{row.label}</span>
                            <span>{row.v}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <motion.div
                              className="h-full rounded-full bg-success"
                              initial={{ width: 0 }}
                              animate={{ width: `${row.v}%` }}
                              transition={{ delay: 0.9 + i * 0.1, duration: 0.6 }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
        </section>

        {/* ---------- Integrations ---------- */}
        <section className="border-y bg-muted/30 py-10">
          <div className="container mx-auto px-4">
            <p className="text-center text-sm font-medium text-muted-foreground">
              Connecté nativement à vos plateformes de livraison
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
              <span className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-medium">
                <img
                  src={uberEatsLogo}
                  alt="Uber Eats"
                  className="h-5 w-5 rounded-sm object-contain"
                />
                Uber Eats
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-medium">
                <img
                  src={deliverooLogo}
                  alt="Deliveroo"
                  className="h-5 w-5 object-contain"
                />
                Deliveroo
              </span>
            </div>
          </div>
        </section>

        {/* ---------- Clients ---------- */}
        <section className="py-20 lg:py-24">
          <div className="container mx-auto px-4">
            <motion.p
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              className="text-center text-sm font-medium uppercase tracking-widest text-muted-foreground"
            >
              Ils nous font confiance
            </motion.p>
            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              className="mt-10 flex flex-wrap items-center justify-center gap-8 md:gap-16"
            >
              {CLIENTS.map((client) => (
                <motion.div
                  key={client.name}
                  variants={fadeUp}
                  className="group flex items-center gap-4"
                >
                  {client.logo ? (
                    <img
                      src={client.logo}
                      alt={client.name}
                      className="h-14 w-14 rounded-xl border object-cover shadow-sm transition-shadow group-hover:shadow-md"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl border bg-gradient-to-br from-amber-500 to-orange-600 shadow-sm transition-shadow group-hover:shadow-md">
                      <span className="text-xl font-black text-white">
                        {client.initials}
                      </span>
                    </div>
                  )}
                  <div className="text-left">
                    <p className="font-semibold text-foreground">{client.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {client.detail}
                    </p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ---------- Features ---------- */}
        <section id="features" className="border-y bg-muted/30 py-20 lg:py-28">
          <div className="container mx-auto px-4">
            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              className="mx-auto max-w-2xl text-center"
            >
              <Badge variant="secondary" className="mb-4">
                Fonctionnalités
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Tout pour piloter votre réseau
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Des outils puissants pour comprendre, comparer et optimiser chaque
                restaurant.
              </p>
            </motion.div>

            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
            >
              {FEATURES.map((feature) => (
                <motion.div key={feature.title} variants={fadeUp}>
                  <Card className="group h-full transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg">
                    <CardHeader>
                      <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                        <feature.icon className="h-6 w-6" />
                      </div>
                      <CardTitle className="text-xl">{feature.title}</CardTitle>
                      <CardDescription className="text-base">
                        {feature.description}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ---------- How it works ---------- */}
        <section id="how" className="py-20 lg:py-28">
          <div className="container mx-auto px-4">
            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              className="mx-auto max-w-2xl text-center"
            >
              <Badge variant="secondary" className="mb-4">
                Comment ça marche
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Démarrez en 3 étapes
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                De la connexion à l'analyse, en quelques minutes.
              </p>
            </motion.div>

            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              className="mt-16 grid gap-8 md:grid-cols-3"
            >
              {STEPS.map((step, i) => (
                <motion.div
                  key={step.title}
                  variants={fadeUp}
                  className="relative text-center"
                >
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
                    <step.icon className="h-7 w-7" />
                  </div>
                  <span className="mt-4 inline-block text-sm font-semibold text-primary">
                    Étape {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-1 text-xl font-semibold">{step.title}</h3>
                  <p className="mt-2 text-muted-foreground">{step.description}</p>
                  {i < STEPS.length - 1 && (
                    <ChevronRight className="absolute -right-4 top-5 hidden h-6 w-6 text-muted-foreground/40 md:block" />
                  )}
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ---------- FAQ ---------- */}
        <section id="faq" className="border-y bg-muted/30 py-20 lg:py-28">
          <div className="container mx-auto px-4">
            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              className="mx-auto max-w-2xl text-center"
            >
              <Badge variant="secondary" className="mb-4">
                FAQ
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Questions fréquentes
              </h2>
            </motion.div>

            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              className="mx-auto mt-12 max-w-3xl"
            >
              <Accordion type="single" collapsible className="w-full">
                {FAQ.map((item, i) => (
                  <AccordionItem key={i} value={`item-${i}`}>
                    <AccordionTrigger className="text-left text-base font-medium">
                      {item.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-base text-muted-foreground">
                      {item.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </motion.div>
          </div>
        </section>

        {/* ---------- Final CTA ---------- */}
        <section className="container mx-auto px-4 py-20 lg:py-28">
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5 }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-accent px-6 py-16 text-center text-primary-foreground sm:px-12"
          >
            <div
              className="absolute inset-0 -z-0 bg-[radial-gradient(circle_at_top_right,hsl(0_0%_100%/0.15),transparent_50%)]"
              aria-hidden="true"
            />
            <div className="relative">
              <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
                Prêt à transformer vos données en décisions ?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-primary-foreground/90">
                Rejoignez les réseaux qui utilisent Delivery Performance pour
                piloter leur croissance.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button size="lg" variant="secondary" className="text-base" asChild>
                  <a href={DEMO_MAILTO}>
                    Demander une démo
                    <ArrowRight className="h-5 w-5" />
                  </a>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-primary-foreground/30 bg-transparent text-base text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                  asChild
                >
                  <Link to="/login">
                    <LogIn className="h-5 w-5" />
                    Se connecter
                  </Link>
                </Button>
              </div>
            </div>
          </motion.div>
        </section>
      </main>

      {/* ---------- Footer ---------- */}
      <footer className="border-t bg-muted/30">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 py-10 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground">
              <BarChart3 className="h-3.5 w-3.5" />
            </span>
            <span className="font-medium text-foreground">Delivery Performance</span>
            <span>© {new Date().getFullYear()} Opineo</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/login" className="transition-colors hover:text-foreground">
              Se connecter
            </Link>
            <Link
              to="/privacy-policy"
              className="transition-colors hover:text-foreground"
            >
              Politique de confidentialité
            </Link>
            <a
              href="mailto:api@opineo.io"
              className="transition-colors hover:text-foreground"
            >
              api@opineo.io
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
