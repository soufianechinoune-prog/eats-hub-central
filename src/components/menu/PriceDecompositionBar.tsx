import { motion } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";

interface PriceDecompositionBarProps {
  priceTTC: number;
  foodCostHT: number | null;
  platform: "uber" | "deliveroo";
  commissionRate?: number; // default 30% Uber, 35% Deliveroo
  marketingRate?: number; // default 5%
}

export function PriceDecompositionBar({
  priceTTC,
  foodCostHT,
  platform,
  commissionRate,
  marketingRate = 5,
}: PriceDecompositionBarProps) {
  // Default commission rates
  const commission = commissionRate ?? (platform === "uber" ? 30 : 35);
  
  // Calculate components
  const tvaRate = 10; // 10% TVA for food
  const priceHT = priceTTC / (1 + tvaRate / 100);
  const tvaAmount = priceTTC - priceHT;
  
  const commissionAmount = (priceTTC * commission) / 100;
  const marketingAmount = (priceTTC * marketingRate) / 100;
  
  const foodCost = foodCostHT ?? 0;
  const hasFoodCost = foodCostHT !== null && foodCostHT > 0;
  
  // Net profit = Prix TTC - TVA - Commission - Marketing - Food Cost
  // Note: This is a simplification, real calculation would need more details
  const netProfit = priceTTC - tvaAmount - commissionAmount - marketingAmount - foodCost;
  const netProfitPercent = (netProfit / priceTTC) * 100;

  // Calculate percentages for bar widths
  const tvaPercent = (tvaAmount / priceTTC) * 100;
  const commissionPercent = commission;
  const marketingPercent = marketingRate;
  const foodCostPercent = hasFoodCost ? (foodCost / priceTTC) * 100 : 0;
  const profitPercent = Math.max(0, netProfitPercent);

  // Colors for each segment
  const segments = [
    {
      key: "tva",
      label: "TVA",
      percent: tvaPercent,
      amount: tvaAmount,
      color: "bg-slate-400",
      description: `TVA ${tvaRate}% sur le prix de vente`,
    },
    {
      key: "commission",
      label: platform === "uber" ? "Commission Uber" : "Commission Deliveroo",
      percent: commissionPercent,
      amount: commissionAmount,
      color: platform === "uber" ? "bg-orange-500" : "bg-teal-500",
      description: `Commission plateforme (~${commission}%)`,
    },
    {
      key: "marketing",
      label: "Frais Marketing",
      percent: marketingPercent,
      amount: marketingAmount,
      color: "bg-purple-500",
      description: "Pub, offres, frais usage (~5%)",
    },
    {
      key: "foodcost",
      label: "Food Cost HT",
      percent: foodCostPercent,
      amount: foodCost,
      color: "bg-amber-500",
      description: "Coût matière première",
    },
    {
      key: "profit",
      label: "Profit Net",
      percent: profitPercent,
      amount: netProfit,
      color: netProfit >= 0 ? "bg-emerald-500" : "bg-red-500",
      description: "Ce qui reste après déductions",
    },
  ];

  // Filter out zero values except profit
  const visibleSegments = segments.filter(s => s.percent > 0 || s.key === "profit");

  return (
    <TooltipProvider>
      <div className="space-y-2">
        {/* Bar visualization */}
        <div className="relative h-6 w-full bg-muted/30 rounded-full overflow-hidden flex">
          {visibleSegments.map((segment, index) => (
            <Tooltip key={segment.key}>
              <TooltipTrigger asChild>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(segment.percent, 0)}%` }}
                  transition={{ delay: index * 0.1, duration: 0.5, ease: "easeOut" }}
                  className={`h-full ${segment.color} cursor-pointer hover:brightness-110 transition-all relative`}
                  style={{ minWidth: segment.percent > 0 ? "4px" : 0 }}
                >
                  {segment.percent >= 10 && (
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-white">
                      {segment.percent.toFixed(0)}%
                    </span>
                  )}
                </motion.div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <div className="space-y-1">
                  <p className="font-semibold">{segment.label}</p>
                  <p className="text-sm">
                    <span className="font-mono">{segment.amount.toFixed(2)}€</span>
                    <span className="text-muted-foreground ml-1">({segment.percent.toFixed(1)}%)</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{segment.description}</p>
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
          {visibleSegments.map((segment) => (
            <div key={segment.key} className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-sm ${segment.color}`} />
              <span className="text-muted-foreground">{segment.label}</span>
              <span className="font-mono font-medium">{segment.amount.toFixed(2)}€</span>
            </div>
          ))}
        </div>

        {/* Missing food cost warning */}
        {!hasFoodCost && (
          <p className="text-[10px] text-amber-600 italic flex items-center gap-1">
            <Info className="h-3 w-3" />
            Food Cost manquant - profit non calculable
          </p>
        )}
      </div>
    </TooltipProvider>
  );
}

// Compact inline version for table rows
export function PriceDecompositionMini({
  priceTTC,
  foodCostHT,
  platform,
}: {
  priceTTC: number;
  foodCostHT: number | null;
  platform: "uber" | "deliveroo";
}) {
  const commission = platform === "uber" ? 30 : 35;
  const marketingRate = 5;
  const tvaRate = 10;

  const tvaAmount = priceTTC - priceTTC / (1 + tvaRate / 100);
  const commissionAmount = (priceTTC * commission) / 100;
  const marketingAmount = (priceTTC * marketingRate) / 100;
  const foodCost = foodCostHT ?? 0;
  const hasFoodCost = foodCostHT !== null && foodCostHT > 0;
  const netProfit = priceTTC - tvaAmount - commissionAmount - marketingAmount - foodCost;

  const tvaPercent = (tvaAmount / priceTTC) * 100;
  const commissionPercent = commission;
  const marketingPercent = marketingRate;
  const foodCostPercent = hasFoodCost ? (foodCost / priceTTC) * 100 : 0;
  const profitPercent = Math.max(0, (netProfit / priceTTC) * 100);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="h-3 w-24 bg-muted/30 rounded-full overflow-hidden flex cursor-pointer">
            <div className="h-full bg-slate-400" style={{ width: `${tvaPercent}%` }} />
            <div 
              className={`h-full ${platform === "uber" ? "bg-orange-500" : "bg-teal-500"}`} 
              style={{ width: `${commissionPercent}%` }} 
            />
            <div className="h-full bg-purple-500" style={{ width: `${marketingPercent}%` }} />
            {hasFoodCost && (
              <div className="h-full bg-amber-500" style={{ width: `${foodCostPercent}%` }} />
            )}
            <div 
              className={`h-full ${netProfit >= 0 ? "bg-emerald-500" : "bg-red-500"}`} 
              style={{ width: `${profitPercent}%` }} 
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <div className="space-y-0.5">
            <p><span className="text-slate-400">●</span> TVA: {tvaAmount.toFixed(2)}€</p>
            <p><span className={platform === "uber" ? "text-orange-500" : "text-teal-500"}>●</span> Commission: {commissionAmount.toFixed(2)}€</p>
            <p><span className="text-purple-500">●</span> Marketing: {marketingAmount.toFixed(2)}€</p>
            {hasFoodCost && <p><span className="text-amber-500">●</span> Food Cost: {foodCost.toFixed(2)}€</p>}
            <p className="font-semibold border-t pt-1 mt-1">
              <span className={netProfit >= 0 ? "text-emerald-500" : "text-red-500"}>●</span> 
              Profit: {netProfit.toFixed(2)}€ ({(netProfit / priceTTC * 100).toFixed(0)}%)
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
