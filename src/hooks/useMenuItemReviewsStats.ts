import { useMemo } from "react";
import { MenuItemReview } from "@/hooks/useReviews";

// Tags produits Uber Eats avec traductions françaises
export const ITEM_POSITIVE_TAGS = [
  "item_fresh",
  "item_good_portion", 
  "item_nice_presentation",
  "item_perfect_temperature",
  "item_tasty"
];

export const ITEM_NEGATIVE_TAGS = [
  "item_cold_melted",
  "item_small_portion",
  "item_not_tasty",
  "item_soggy_leaky",
  "item_messy_presentation"
];

export const ITEM_TAG_LABELS: Record<string, string> = {
  "item_fresh": "Frais",
  "item_good_portion": "Bonne portion",
  "item_nice_presentation": "Belle présentation",
  "item_perfect_temperature": "Température parfaite",
  "item_tasty": "Savoureux",
  "item_cold_melted": "Froid/Fondu",
  "item_small_portion": "Petite portion",
  "item_not_tasty": "Pas savoureux",
  "item_soggy_leaky": "Mou/Fuite",
  "item_messy_presentation": "Mauvaise présentation"
};

export interface MonthlyApprovalRate {
  month: string;
  monthLabel: string;
  approvalRate: number;
  thumbsUp: number;
  thumbsDown: number;
  totalReviews: number;
}

export interface ItemTagStats {
  tag: string;
  label: string;
  count: number;
  isPositive: boolean;
}

export interface ProductStats {
  itemTitle: string;
  itemId: string;
  totalRating: number;
  count: number;
  thumbsUp: number;
  thumbsDown: number;
  averageRating: number;
  approvalRate: number;
}

export interface DayOfWeekStats {
  day: string;
  dayIndex: number;
  approvalRate: number;
  reviewCount: number;
}

export function useMenuItemReviewsStats(reviews: MenuItemReview[]) {
  // Calcul du taux d'approbation par mois
  const monthlyApprovalRates = useMemo(() => {
    const byMonth: Record<string, { thumbsUp: number; thumbsDown: number; count: number }> = {};
    
    reviews.forEach(review => {
      if (!review.review_date) return;
      const month = review.review_date.substring(0, 7); // YYYY-MM
      
      if (!byMonth[month]) {
        byMonth[month] = { thumbsUp: 0, thumbsDown: 0, count: 0 };
      }
      byMonth[month].thumbsUp += review.thumb_up || 0;
      byMonth[month].thumbsDown += review.thumb_down || 0;
      byMonth[month].count += 1;
    });

    const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
    
    return Object.entries(byMonth)
      .map(([month, data]) => {
        const total = data.thumbsUp + data.thumbsDown;
        const monthIndex = parseInt(month.split("-")[1]) - 1;
        return {
          month,
          monthLabel: monthNames[monthIndex],
          approvalRate: total > 0 ? (data.thumbsUp / total) * 100 : 0,
          thumbsUp: data.thumbsUp,
          thumbsDown: data.thumbsDown,
          totalReviews: data.count
        };
      })
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [reviews]);

  // Agrégation des tags produits
  const tagStats = useMemo(() => {
    const tagCounts: Record<string, number> = {};
    
    reviews.forEach(review => {
      (review.tags || []).forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    const positive: ItemTagStats[] = ITEM_POSITIVE_TAGS
      .map(tag => ({
        tag,
        label: ITEM_TAG_LABELS[tag] || tag,
        count: tagCounts[tag] || 0,
        isPositive: true
      }))
      .filter(t => t.count > 0)
      .sort((a, b) => b.count - a.count);

    const negative: ItemTagStats[] = ITEM_NEGATIVE_TAGS
      .map(tag => ({
        tag,
        label: ITEM_TAG_LABELS[tag] || tag,
        count: tagCounts[tag] || 0,
        isPositive: false
      }))
      .filter(t => t.count > 0)
      .sort((a, b) => b.count - a.count);

    return { positive, negative };
  }, [reviews]);

  // Stats globales thumbs
  const globalThumbsStats = useMemo(() => {
    const totalThumbsUp = reviews.reduce((sum, r) => sum + (r.thumb_up || 0), 0);
    const totalThumbsDown = reviews.reduce((sum, r) => sum + (r.thumb_down || 0), 0);
    const total = totalThumbsUp + totalThumbsDown;
    
    return {
      thumbsUp: totalThumbsUp,
      thumbsDown: totalThumbsDown,
      total,
      approvalRate: total > 0 ? (totalThumbsUp / total) * 100 : 0
    };
  }, [reviews]);

  // Top/Flop produits
  const productStats = useMemo(() => {
    const byProduct: Record<string, ProductStats> = {};
    
    reviews.forEach(review => {
      const key = review.item_id || review.item_title;
      if (!byProduct[key]) {
        byProduct[key] = {
          itemTitle: review.item_title,
          itemId: review.item_id,
          totalRating: 0,
          count: 0,
          thumbsUp: 0,
          thumbsDown: 0,
          averageRating: 0,
          approvalRate: 0
        };
      }
      byProduct[key].totalRating += review.rating;
      byProduct[key].count += 1;
      byProduct[key].thumbsUp += review.thumb_up || 0;
      byProduct[key].thumbsDown += review.thumb_down || 0;
    });

    return Object.values(byProduct)
      .map(p => {
        const total = p.thumbsUp + p.thumbsDown;
        return {
          ...p,
          averageRating: p.count > 0 ? p.totalRating / p.count : 0,
          approvalRate: total > 0 ? (p.thumbsUp / total) * 100 : 0
        };
      })
      .sort((a, b) => b.approvalRate - a.approvalRate);
  }, [reviews]);

  // Stats par jour de la semaine
  const dayOfWeekStats = useMemo(() => {
    const dayNames = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
    const byDay: Record<number, { thumbsUp: number; thumbsDown: number; count: number }> = {};
    
    reviews.forEach(review => {
      if (!review.review_date) return;
      const date = new Date(review.review_date);
      const dayIndex = date.getDay();
      
      if (!byDay[dayIndex]) {
        byDay[dayIndex] = { thumbsUp: 0, thumbsDown: 0, count: 0 };
      }
      byDay[dayIndex].thumbsUp += review.thumb_up || 0;
      byDay[dayIndex].thumbsDown += review.thumb_down || 0;
      byDay[dayIndex].count += 1;
    });

    return [1, 2, 3, 4, 5, 6, 0].map(dayIndex => {
      const data = byDay[dayIndex] || { thumbsUp: 0, thumbsDown: 0, count: 0 };
      const total = data.thumbsUp + data.thumbsDown;
      return {
        day: dayNames[dayIndex],
        dayIndex,
        approvalRate: total > 0 ? (data.thumbsUp / total) * 100 : 0,
        reviewCount: data.count
      };
    });
  }, [reviews]);

  // Filtrer les produits avec au moins un avis thumb pour Top/Flop
  const productsWithThumbs = productStats.filter(p => (p.thumbsUp + p.thumbsDown) > 0);
  
  return {
    monthlyApprovalRates,
    tagStats,
    globalThumbsStats,
    productStats,
    dayOfWeekStats,
    topProducts: productsWithThumbs.slice(0, 5),
    // Pour les flops, prendre les produits avec thumbs down
    flopProducts: [...productsWithThumbs]
      .filter(p => p.thumbsDown > 0)
      .sort((a, b) => a.approvalRate - b.approvalRate)
      .slice(0, 5)
  };
}
