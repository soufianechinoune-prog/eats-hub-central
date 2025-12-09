import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface OrderError {
  id: string;
  error_category: string | null;
  financial_impact: number | null;
}

interface FinancialImpactByCategoryProps {
  orderErrors: OrderError[];
}

const CATEGORY_COLORS: Record<string, string> = {
  "Articles manquants": "#ef4444",
  "Article incorrect": "#f97316",
  "Problèmes liés à la qualité des aliments": "#eab308",
  "Commande incorrecte": "#3b82f6",
  "Personnalisation incorrecte": "#8b5cf6",
  "Autre": "#6b7280",
};

export function FinancialImpactByCategory({ orderErrors }: FinancialImpactByCategoryProps) {
  const categoryData = useMemo(() => {
    const grouped: Record<string, { name: string; impact: number; count: number }> = {};

    orderErrors.forEach(error => {
      const category = error.error_category || "Autre";
      if (!grouped[category]) {
        grouped[category] = { name: category, impact: 0, count: 0 };
      }
      grouped[category].impact += error.financial_impact || 0;
      grouped[category].count += 1;
    });

    return Object.values(grouped)
      .sort((a, b) => b.impact - a.impact)
      .map(item => ({
        ...item,
        color: CATEGORY_COLORS[item.name] || CATEGORY_COLORS["Autre"],
      }));
  }, [orderErrors]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.[0]) return null;
    const item = payload[0].payload;
    
    return (
      <div className="bg-popover border border-border rounded-lg shadow-lg p-3">
        <p className="font-medium">{item.name}</p>
        <p className="text-destructive font-semibold">{formatCurrency(item.impact)}</p>
        <p className="text-sm text-muted-foreground">{item.count} erreur{item.count > 1 ? "s" : ""}</p>
        <p className="text-xs text-muted-foreground">
          Coût moyen: {formatCurrency(item.impact / item.count)}
        </p>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Impact financier par catégorie</CardTitle>
        <p className="text-sm text-muted-foreground">
          Coût total des remboursements par type d'erreur
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={categoryData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={(v) => `${v}€`}
              className="text-xs"
            />
            <YAxis
              type="category"
              dataKey="name"
              width={180}
              className="text-xs"
              tick={{ fontSize: 11 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="impact" radius={[0, 4, 4, 0]}>
              {categoryData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
