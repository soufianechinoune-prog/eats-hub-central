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
  monthIndex: number;
  year: number;
}

interface RatingDistribution {
  rating: number;
  count: number;
  previousCount?: number;
}

const POSITIVE_TAGS = [
  "restaurant_delicious_options",
  "restaurant_sustainable_packaging",
  "restaurant_nicely_presented",
  "restaurant_high-quality_ingredients",
  "restaurant_perfectly_cooked",
  "restaurant_fast_casual",
  "restaurant_fresh_ingredients",
  "restaurant_locally_owned",
  "restaurant_authentic_dishes",
  "restaurant_unique_flavors"
];

const NEGATIVE_TAGS = [
  "restaurant_not_tasty",
  "restaurant_too_slow",
  "restaurant_poor_packaging",
  "restaurant_unsustainable_packaging",
  "restaurant_missed_request"
];

const TAG_LABELS: Record<string, string> = {
  // Positive tags
  "restaurant_delicious_options": "Options délicieuses",
  "restaurant_sustainable_packaging": "Emballage durable",
  "restaurant_nicely_presented": "Bien présenté",
  "restaurant_high-quality_ingredients": "Ingrédients de qualité",
  "restaurant_perfectly_cooked": "Parfaitement cuisiné",
  "restaurant_fast_casual": "Rapide et pratique",
  "restaurant_fresh_ingredients": "Ingrédients frais",
  "restaurant_locally_owned": "Restaurant local",
  "restaurant_authentic_dishes": "Plats authentiques",
  "restaurant_unique_flavors": "Saveurs uniques",
  // Negative tags
  "restaurant_not_tasty": "Pas savoureux",
  "restaurant_too_slow": "Trop lent",
  "restaurant_poor_packaging": "Mauvais emballage",
  "restaurant_unsustainable_packaging": "Emballage non écologique",
  "restaurant_missed_request": "Demande non respectée"
};

import type { PeriodMode } from "@/contexts/AnalyticsContext";

interface UseReviewsStatsOptions {
  periodMode?: PeriodMode;
  selectedMonth?: number;
  selectedYear?: number;
}

export function useReviewsStats(reviews: CustomerReview[], options?: UseReviewsStatsOptions) {
  const { periodMode = "year", selectedMonth, selectedYear } = options || {};

  // Filter reviews based on selected period
  const filteredReviews = useMemo(() => {
    if (!reviews.length) return [];
    
    if (periodMode === "month" && selectedMonth && selectedYear) {
      return reviews.filter(r => {
        const date = new Date(r.review_date);
        return date.getMonth() + 1 === selectedMonth && date.getFullYear() === selectedYear;
      });
    }
    
    if (periodMode === "year" && selectedYear) {
      return reviews.filter(r => {
        const date = new Date(r.review_date);
        return date.getFullYear() === selectedYear;
      });
    }
    
    return reviews;
  }, [reviews, periodMode, selectedMonth, selectedYear]);

  // Stats now counts filtered reviews
  const stats = useMemo((): ReviewStats => {
    if (!filteredReviews.length) {
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

    // Calculate average rating from filtered reviews
    const totalReviews = filteredReviews.length;
    const averageRating = filteredReviews.reduce((sum, r) => sum + (r.overall_rating || 0), 0) / totalReviews;
    const reviewsWithTags = filteredReviews.filter(r => r.tags && r.tags.length > 0).length;
    const reviewsWithComments = filteredReviews.filter(r => r.customer_comment).length;

    // Previous period reviews for comparison
    let previousReviews: CustomerReview[] = [];
    if (periodMode === "month" && selectedMonth && selectedYear) {
      // Compare with same month last year
      previousReviews = reviews.filter(r => {
        const date = new Date(r.review_date);
        return date.getMonth() + 1 === selectedMonth && date.getFullYear() === selectedYear - 1;
      });
    } else if (periodMode === "year" && selectedYear) {
      // Compare with previous year
      previousReviews = reviews.filter(r => {
        const date = new Date(r.review_date);
        return date.getFullYear() === selectedYear - 1;
      });
    }

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
  }, [filteredReviews, reviews, periodMode, selectedMonth, selectedYear]);

  const monthlyRatings = useMemo((): MonthlyRating[] => {
    const monthMap = new Map<string, { total: number; count: number; sortKey: number; monthIndex: number; year: number }>();
    const prevMonthMap = new Map<number, { total: number; count: number }>();
    const targetYear = selectedYear || new Date().getFullYear();

    reviews.forEach(review => {
      const date = new Date(review.review_date);
      const year = date.getFullYear();
      const month = date.getMonth();
      const isCurrentYear = year === targetYear;
      const isPrevYear = year === targetYear - 1;

      if (isCurrentYear) {
        const monthKey = format(date, "MMM yyyy", { locale: fr });
        const sortKey = year * 100 + month;
        const existing = monthMap.get(monthKey) || { total: 0, count: 0, sortKey, monthIndex: month, year };
        monthMap.set(monthKey, {
          total: existing.total + (review.overall_rating || 0),
          count: existing.count + 1,
          sortKey,
          monthIndex: month,
          year
        });
      }

      if (isPrevYear) {
        const existing = prevMonthMap.get(month) || { total: 0, count: 0 };
        prevMonthMap.set(month, {
          total: existing.total + (review.overall_rating || 0),
          count: existing.count + 1
        });
      }
    });

    return Array.from(monthMap.entries())
      .map(([monthLabel, data]) => {
        const prevData = prevMonthMap.get(data.monthIndex);
        return {
          month: monthLabel,
          rating: data.count > 0 ? data.total / data.count : 0,
          count: data.count,
          previousRating: prevData ? prevData.total / prevData.count : undefined,
          previousCount: prevData?.count,
          sortKey: data.sortKey,
          monthIndex: data.monthIndex,
          year: data.year
        };
      })
      .sort((a, b) => a.sortKey - b.sortKey)
      .map(({ sortKey, ...rest }) => rest);
  }, [reviews, selectedYear]);

  const ratingDistribution = useMemo((): RatingDistribution[] => {
    const targetYear = selectedYear || new Date().getFullYear();
    const distribution: Record<number, { current: number; previous: number }> = {
      5: { current: 0, previous: 0 },
      4: { current: 0, previous: 0 },
      3: { current: 0, previous: 0 },
      2: { current: 0, previous: 0 },
      1: { current: 0, previous: 0 }
    };

    // Use filteredReviews for current, all reviews for previous year comparison
    filteredReviews.forEach(review => {
      const rating = Math.round(review.overall_rating || 0);
      if (rating >= 1 && rating <= 5) {
        distribution[rating].current++;
      }
    });

    // Previous period for comparison
    if (periodMode === "month" && selectedMonth && selectedYear) {
      reviews.filter(r => {
        const date = new Date(r.review_date);
        return date.getMonth() + 1 === selectedMonth && date.getFullYear() === selectedYear - 1;
      }).forEach(review => {
        const rating = Math.round(review.overall_rating || 0);
        if (rating >= 1 && rating <= 5) {
          distribution[rating].previous++;
        }
      });
    } else {
      reviews.filter(r => {
        const date = new Date(r.review_date);
        return date.getFullYear() === targetYear - 1;
      }).forEach(review => {
        const rating = Math.round(review.overall_rating || 0);
        if (rating >= 1 && rating <= 5) {
          distribution[rating].previous++;
        }
      });
    }

    return [5, 4, 3, 2, 1].map(rating => ({
      rating,
      count: distribution[rating].current,
      previousCount: distribution[rating].previous
    }));
  }, [filteredReviews, reviews, periodMode, selectedMonth, selectedYear]);

  const dayStats = useMemo((): DayStats[] => {
    const dayMap = new Map<number, { total: number; count: number }>();
    const dayNames = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

    filteredReviews.forEach(review => {
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
  }, [filteredReviews]);

  const tagStats = useMemo((): { positive: TagStats[]; negative: TagStats[] } => {
    const tagCount = new Map<string, number>();

    filteredReviews.forEach(review => {
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
  }, [filteredReviews]);

  // Global average rating (all reviews, not filtered by period)
  const globalAverageRating = useMemo(() => {
    if (!reviews.length) return 0;
    const validReviews = reviews.filter(r => r.overall_rating !== null);
    if (!validReviews.length) return 0;
    return validReviews.reduce((sum, r) => sum + (r.overall_rating || 0), 0) / validReviews.length;
  }, [reviews]);

  // 90-day rolling average rating by date (for evolution curve)
  // Returns a map of date -> rolling average of last 90 days up to that date
  const rollingAverageByDate = useMemo(() => {
    if (!reviews.length) return new Map<string, number>();
    
    const ROLLING_WINDOW_DAYS = 90;
    const validReviews = reviews.filter(r => r.overall_rating !== null && r.review_date);
    
    if (!validReviews.length) return new Map<string, number>();
    
    // Get all unique dates where reviews exist, sorted chronologically
    const allDates = [...new Set(validReviews.map(r => 
      new Date(r.review_date).toISOString().split('T')[0]
    ))].sort();
    
    const result = new Map<string, number>();
    
    allDates.forEach(dateStr => {
      const currentDate = new Date(dateStr);
      currentDate.setHours(23, 59, 59, 999); // End of day
      
      const windowStart = new Date(currentDate);
      windowStart.setDate(windowStart.getDate() - ROLLING_WINDOW_DAYS);
      windowStart.setHours(0, 0, 0, 0); // Start of day
      
      // Filter reviews within the 90-day window
      const reviewsInWindow = validReviews.filter(r => {
        const reviewDate = new Date(r.review_date);
        return reviewDate >= windowStart && reviewDate <= currentDate;
      });
      
      if (reviewsInWindow.length > 0) {
        const avg = reviewsInWindow.reduce((sum, r) => 
          sum + (r.overall_rating || 0), 0) / reviewsInWindow.length;
        result.set(dateStr, avg);
      }
    });
    
    return result;
  }, [reviews]);

  return {
    stats,
    monthlyRatings,
    ratingDistribution,
    dayStats,
    tagStats,
    globalAverageRating,
    rollingAverageByDate,
  };
}
