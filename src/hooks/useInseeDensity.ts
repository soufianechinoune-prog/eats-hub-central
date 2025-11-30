import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

interface InseeDensityData {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: {
      type: "Point";
      coordinates: [number, number];
    };
    properties: {
      population: number;
      id: string;
    };
  }>;
}

interface UseInseeDensityOptions {
  restaurantDepartments: string[];
  enabled: boolean;
}

export const useInseeDensity = ({ restaurantDepartments, enabled }: UseInseeDensityOptions) => {
  const [data, setData] = useState<InseeDensityData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Unique departments to fetch
  const uniqueDepartments = useMemo(() => {
    return [...new Set(restaurantDepartments.filter(Boolean))];
  }, [restaurantDepartments]);

  useEffect(() => {
    if (!enabled || uniqueDepartments.length === 0) {
      setData(null);
      return;
    }

    const fetchDensityData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        console.log(`Fetching INSEE density for departments: ${uniqueDepartments.join(", ")}`);
        
        const { data: responseData, error: fnError } = await supabase.functions.invoke(
          "insee-density",
          {
            body: { departments: uniqueDepartments },
          }
        );

        if (fnError) {
          throw new Error(fnError.message);
        }

        if (responseData?.error) {
          throw new Error(responseData.error);
        }

        console.log(`Received ${responseData?.features?.length || 0} density points`);
        setData(responseData);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to fetch density data";
        console.error("Error fetching INSEE density:", errorMessage);
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDensityData();
  }, [uniqueDepartments, enabled]);

  return { data, isLoading, error };
};
