import { useMemo } from "react";
import { CustomerReview } from "./useReviews";
import { format, getDay } from "date-fns";
import { fr } from "date-fns/locale";

interface ReviewStats {
  averageRating: number;
  totalReviews: number;
  tagRate: number;
  commentRate: number;
  previousAverageRating: number;
  previousTotalReviews: number;
  ratingVariation: number;
  volumeVariation: number;
  hasPreviousPeriodData: boolean;
}

interface DayStats {
  day: string;
  dayIndex: number;
  avgRating: number;
  count: number;
}

interface TagStats {
  tag: string;
  count: number;
  isPositive: boolean;
}

interface MonthlyRating {
  month: string;
  rating: number;
  count: number;
  previousRating?: number;
  previousCount?: number;
}

interface RatingDistribution {
  rating: number;
  count: number;
  previousCount?: number;
}

const POSITIVE_TAGS = [
  "food_quality_positive",
  "order_accuracy",
  "fast_delivery",
  "good_packaging",
  "great_value",
  "friendly_service"
];

const NEGATIVE_TAGS = [
  "food_quality_negative",
  "missing_items",
  "late_delivery",
  "poor_packaging",
  "wrong_order",
  "cold_food"
];

const TAG_LABELS: Record<string, string> = {
  food_quality_positive: "Qualité excellente",
  order_accuracy: "Commande correcte",
  fast_delivery: "Livraison rapide",
  good_packaging: "Bon emballage",
  great_value: "Bon rapport qualité/prix",
  friendly_service: "Service agréable",
  food_quality_negative: "Qualité insuffisante",
  missing_items: "Articles manquants",
  late_delivery: "Livraison en retard",
  poor_packaging: "Mauvais emballage",
  wrong_order: "Commande incorrecte",
  cold_food: "Nourriture froide"
};

export function useReviewsStats(reviews: CustomerReview[]) {
  const stats = useMemo((): ReviewStats => {
    if (!reviews.length) {
      return {
        averageRating: 0,
        totalReviews: 0,
        tagRate: 0,
        commentRate: 0,
        previousAverageRating: 0,
        previousTotalReviews: 0,
        ratingVariation: 0,
        volumeVariation: 0,
        hasPreviousPeriodData: false
      };
    }

    const now = new Date();
    const currentYear = now.getFullYear();

    // Current year reviews
    const currentReviews = reviews.filter(r => {
      const date = new Date(r.review_date);
      return date.getFullYear() === currentYear;
    });

    // Previous year reviews (N-1)
    const previousReviews = reviews.filter(r => {
      const date = new Date(r.review_date);
      return date.getFullYear() === currentYear - 1;
    });

    const totalReviews = currentReviews.length;
    const averageRating = currentReviews.reduce((sum, r) => sum + (r.overall_rating || 0), 0) / totalReviews || 0;
    const reviewsWithTags = currentReviews.filter(r => r.tags && r.tags.length > 0).length;
    const reviewsWithComments = currentReviews.filter(r => r.customer_comment).length;

    const previousTotalReviews = previousReviews.length;
    const previousAverageRating = previousReviews.length > 0 
      ? previousReviews.reduce((sum, r) => sum + (r.overall_rating || 0), 0) / previousTotalReviews 
      : 0;

    const hasPreviousPeriodData = previousTotalReviews > 0;

    return {
      averageRating,
      totalReviews,
      tagRate: (reviewsWithTags / totalReviews) * 100 || 0,
      commentRate: (reviewsWithComments / totalReviews) * 100 || 0,
      previousAverageRating,
      previousTotalReviews,
      ratingVariation: hasPreviousPeriodData ? averageRating - previousAverageRating : 0,
      volumeVariation: hasPreviousPeriodData && previousTotalReviews > 0
        ? ((totalReviews - previousTotalReviews) / previousTotalReviews) * 100 
        : 0,
      hasPreviousPeriodData
    };
  }, [reviews]);

  const monthlyRatings = useMemo((): MonthlyRating[] => {
    const monthMap = new Map<string, { total: number; count: number }>();
    const prevMonthMap = new Map<string, { total: number; count: number }>();
    const now = new Date();

    reviews.forEach(review => {
      const date = new Date(review.review_date);
      const monthKey = format(date, "MMM yyyy", { locale: fr });
      const isCurrentYear = date.getFullYear() === now.getFullYear();
      const isPrevYear = date.getFullYear() === now.getFullYear() - 1;

      if (isCurrentYear) {
        const existing = monthMap.get(monthKey) || { total: 0, count: 0 };
        monthMap.set(monthKey, {
          total: existing.total + (review.overall_rating || 0),
          count: existing.count + 1
        });
      }

      if (isPrevYear) {
        const prevMonthKey = format(date, "MMM", { locale: fr });
        const existing = prevMonthMap.get(prevMonthKey) || { total: 0, count: 0 };
        prevMonthMap.set(prevMonthKey, {
          total: existing.total + (review.overall_rating || 0),
          count: existing.count + 1
        });
      }
    });

    return Array.from(monthMap.entries())
      .map(([month, data]) => {
        const prevKey = month.split(" ")[0];
        const prevData = prevMonthMap.get(prevKey);
        return {
          month,
          rating: data.count > 0 ? data.total / data.count : 0,
          count: data.count,
          previousRating: prevData ? prevData.total / prevData.count : undefined,
          previousCount: prevData?.count
        };
      })
      .sort((a, b) => {
        const dateA = new Date(a.month);
        const dateB = new Date(b.month);
        return dateA.getTime() - dateB.getTime();
      });
  }, [reviews]);

  const ratingDistribution = useMemo((): RatingDistribution[] => {
    const now = new Date();
    const distribution: Record<number, { current: number; previous: number }> = {
      5: { current: 0, previous: 0 },
      4: { current: 0, previous: 0 },
      3: { current: 0, previous: 0 },
      2: { current: 0, previous: 0 },
      1: { current: 0, previous: 0 }
    };

    reviews.forEach(review => {
      const rating = Math.round(review.overall_rating || 0);
      if (rating >= 1 && rating <= 5) {
        const date = new Date(review.review_date);
        if (date.getFullYear() === now.getFullYear()) {
          distribution[rating].current++;
        } else if (date.getFullYear() === now.getFullYear() - 1) {
          distribution[rating].previous++;
        }
      }
    });

    return [5, 4, 3, 2, 1].map(rating => ({
      rating,
      count: distribution[rating].current,
      previousCount: distribution[rating].previous
    }));
  }, [reviews]);

  const dayStats = useMemo((): DayStats[] => {
    const dayMap = new Map<number, { total: number; count: number }>();
    const dayNames = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

    reviews.forEach(review => {
      const date = new Date(review.review_date);
      const dayIndex = getDay(date);
      const existing = dayMap.get(dayIndex) || { total: 0, count: 0 };
      dayMap.set(dayIndex, {
        total: existing.total + (review.overall_rating || 0),
        count: existing.count + 1
      });
    });

    // Reorder to start from Monday
    const orderedDays = [1, 2, 3, 4, 5, 6, 0];
    return orderedDays.map(dayIndex => {
      const data = dayMap.get(dayIndex) || { total: 0, count: 0 };
      return {
        day: dayNames[dayIndex],
        dayIndex,
        avgRating: data.count > 0 ? data.total / data.count : 0,
        count: data.count
      };
    });
  }, [reviews]);

  const tagStats = useMemo((): { positive: TagStats[]; negative: TagStats[] } => {
    const tagCount = new Map<string, number>();

    reviews.forEach(review => {
      if (review.tags) {
        review.tags.forEach(tag => {
          tagCount.set(tag, (tagCount.get(tag) || 0) + 1);
        });
      }
    });

    const positive = POSITIVE_TAGS
      .map(tag => ({
        tag: TAG_LABELS[tag] || tag,
        count: tagCount.get(tag) || 0,
        isPositive: true
      }))
      .filter(t => t.count > 0)
      .sort((a, b) => b.count - a.count);

    const negative = NEGATIVE_TAGS
      .map(tag => ({
        tag: TAG_LABELS[tag] || tag,
        count: tagCount.get(tag) || 0,
        isPositive: false
      }))
      .filter(t => t.count > 0)
      .sort((a, b) => b.count - a.count);

    return { positive, negative };
  }, [reviews]);

  return {
    stats,
    monthlyRatings,
    ratingDistribution,
    dayStats,
    tagStats
  };
}
