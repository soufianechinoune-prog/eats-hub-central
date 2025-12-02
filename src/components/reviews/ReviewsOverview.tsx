import { Star, MessageSquare, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RatingDistributionChart } from "./RatingDistributionChart";
import { CustomerReview } from "@/hooks/useReviews";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ReviewsOverviewProps {
  reviews: CustomerReview[];
}

export function ReviewsOverview({ reviews }: ReviewsOverviewProps) {
  // Calculate stats
  const totalReviews = reviews.length;
  const averageRating =
    reviews.reduce((sum, r) => sum + r.overall_rating, 0) / totalReviews || 0;
  
  const pendingResponses = reviews.filter((r) => r.response_status === "pending").length;
  const reviewsWithComments = reviews.filter((r) => r.customer_comment).length;

  // Distribution
  const distribution = reviews.reduce((acc, review) => {
    const rating = Math.round(review.overall_rating);
    acc[rating] = (acc[rating] || 0) + 1;
    return acc;
  }, {} as { [key: number]: number });

  // Evolution data (last 6 months)
  const evolutionData = reviews.reduce((acc, review) => {
    const month = new Date(review.review_date).toLocaleDateString("fr-FR", {
      month: "short",
      year: "numeric",
    });
    
    const existing = acc.find((d) => d.month === month);
    if (existing) {
      existing.totalRating += review.overall_rating;
      existing.count += 1;
    } else {
      acc.push({ month, totalRating: review.overall_rating, count: 1 });
    }
    return acc;
  }, [] as { month: string; totalRating: number; count: number }[]);

  const chartData = evolutionData
    .map((d) => ({
      month: d.month,
      rating: parseFloat((d.totalRating / d.count).toFixed(2)),
    }))
    .reverse()
    .slice(-6);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Average Rating */}
        <Card className="backdrop-blur-xl bg-card/70 border-2 shadow-2xl hover:scale-102 transition-all duration-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-400" />
              Note Globale
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold">{averageRating.toFixed(1)}</span>
              <span className="text-muted-foreground">/5</span>
            </div>
            <div className="flex mt-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`h-5 w-5 ${
                    star <= Math.round(averageRating)
                      ? "fill-amber-400 text-amber-400"
                      : "text-muted-foreground/30"
                  }`}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Total Reviews */}
        <Card className="backdrop-blur-xl bg-card/70 border-2 shadow-2xl hover:scale-102 transition-all duration-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Total Avis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{totalReviews}</div>
            <p className="text-sm text-muted-foreground mt-1">
              {reviewsWithComments} avec commentaires
            </p>
          </CardContent>
        </Card>

        {/* Pending Responses */}
        <Card className="backdrop-blur-xl bg-card/70 border-2 shadow-2xl hover:scale-102 transition-all duration-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-amber-500" />
              En Attente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{pendingResponses}</div>
            <p className="text-sm text-muted-foreground mt-1">réponses à envoyer</p>
          </CardContent>
        </Card>

        {/* Comments Rate */}
        <Card className="backdrop-blur-xl bg-card/70 border-2 shadow-2xl hover:scale-102 transition-all duration-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Taux Commentaires
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">
              {((reviewsWithComments / totalReviews) * 100 || 0).toFixed(0)}%
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {reviewsWithComments} / {totalReviews}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribution Chart */}
        <Card className="backdrop-blur-xl bg-card/70 border-2 shadow-lg">
          <CardHeader>
            <CardTitle>Distribution des Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <RatingDistributionChart
              distribution={distribution}
              totalReviews={totalReviews}
            />
          </CardContent>
        </Card>

        {/* Evolution Chart */}
        <Card className="backdrop-blur-xl bg-card/70 border-2 shadow-lg">
          <CardHeader>
            <CardTitle>Évolution de la Note</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  domain={[0, 5]}
                  ticks={[0, 1, 2, 3, 4, 5]}
                  tick={{ fontSize: 12 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="rating"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={3}
                  dot={{ fill: "hsl(var(--chart-1))", r: 5 }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
