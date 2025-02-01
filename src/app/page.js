"use client";

import GoogleMapsHeatmap from "@/components/GoogleMapsHeatmap";

export default function Home() {
  
  return (
    <div className="bg-white text-black">
      <div className="flex items-center justify-center h-screen">
        <div className="w-[1000px] h-[1000px] bg-gray-200 flex items-center justify-center">
            <GoogleMapsHeatmap />
        </div>
      </div>
    </div>
  );
}
