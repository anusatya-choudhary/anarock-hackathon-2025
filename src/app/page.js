"use client";

import { useEffect, useState } from "react";
import GoogleMapsHeatmap from "@/components/GoogleMapsHeatmap";

export default function Home() {
  const [heatmapData, setHeatmapData] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchHeatmapData = async () => {
      try {
        const response = await fetch("https://insightq.beta.staging.anarock.com/get_cp/district");
        if (!response.ok) {
          throw new Error(`HTTP Error: ${response.status}`);
        }
        const responseJson = await response.json();
        const data = responseJson.response

        const maxCount = Math.max(...data.map((item) => item.count));
        const minCount = Math.min(...data.map((item) => item.count));

        const formattedData = data.map((item) => {
          console.log(item)
          const [lat, lng] = item.district_lat_long.split(",").map(Number);
          const normalizedWeight = Math.max(0.1, (item.count - minCount) / (maxCount - minCount || 1)); // Ensure minimum visibility // Avoid division by zero
          return { lat, lng, weight: normalizedWeight, name: item.District };
        });

        setHeatmapData(formattedData);
      } catch (err) {
        console.error("API Fetch Error:", err);
        setError(err.message);
      }
    };

    fetchHeatmapData();
  }, []);

  return (
    <div className="bg-white text-black">
      <div className="flex items-center justify-center h-screen">
        <div className="w-[1000px] h-[1000px] bg-gray-200 flex items-center justify-center">
          {error ? (
            <p className="text-xl font-bold text-red-600">Error: {error}</p>
          ) : heatmapData.length > 0 ? (
            <GoogleMapsHeatmap data={heatmapData} />
          ) : (
            <p className="text-xl font-bold">Loading Heatmap Data...</p>
          )}
        </div>
      </div>
    </div>
  );
}
