import { useEffect, useState, useRef } from "react";
import { GoogleMap, useJsApiLoader, HeatmapLayer, Marker, InfoWindow } from "@react-google-maps/api";

const center = { lat: 19.7515, lng: 75.7139 }; // Default center (Maharashtra)

export default function GoogleMapsHeatmap({ data }) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    libraries: ["visualization"], // Needed for Heatmap
  });

  const [selectedPoint, setSelectedPoint] = useState(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [mapBounds, setMapBounds] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(6);
  const [delta, setDelta] = useState({ lat: 0, lng: 0 });
  const mapRef = useRef(null);
  let tooltipTimeout;

  const handleMouseOver = (point) => {
    clearTimeout(tooltipTimeout);
    setSelectedPoint(point);
    setShowTooltip(true);
  };

  const handleMouseOut = () => {
    tooltipTimeout = setTimeout(() => {
      setShowTooltip(false);
      setSelectedPoint(null);
    }, 1000);
  };

  const handleInfoWindowMouseEnter = () => {
    clearTimeout(tooltipTimeout);
  };

  const handleInfoWindowMouseLeave = () => {
    tooltipTimeout = setTimeout(() => {
      setShowTooltip(false);
      setSelectedPoint(null);
    }, 1000);
  };

  const handleBoundsChange = () => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    setZoomLevel(map.getZoom());
    const newBounds = map.getBounds().toJSON();
    setDelta({
      lat: Math.abs(newBounds.north - newBounds.south),
      lng: Math.abs(newBounds.east - newBounds.west),
    });
    setMapBounds(newBounds);

    fetch("https://your-api.com/data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ bounds: newBounds, zoom: map.getZoom() }),
    })
      .then((res) => res.json())
      .then((newData) => {
        console.log("New Data Loaded", newData);
      })
      .catch((err) => console.error("API Error:", err));
  };

  if (!isLoaded) return <div className="text-center text-xl font-bold">Loading...</div>;

  return (
    <div className="p-4 bg-gray-100 text-center">
      <div className="mb-4 p-4 bg-white shadow rounded-lg">
        <p className="text-lg text-black font-semibold">Current Zoom Level: {zoomLevel}</p>
        <p className="text-sm text-gray-600">Map Bounds: {mapBounds ? JSON.stringify(mapBounds) : "Fetching..."}</p>
        <p className="text-sm text-gray-600">Delta: Lat {delta.lat.toFixed(4)}, Lng {delta.lng.toFixed(4)}</p>
      </div>
      <div className="w-full h-[500px] rounded-lg overflow-hidden shadow-lg">
        <GoogleMap
          mapContainerStyle={{ width: "100%", height: "100%" }}
          center={center}
          zoom={6}
          onLoad={(map) => (mapRef.current = map)}
          onZoomChanged={handleBoundsChange}
          onBoundsChanged={handleBoundsChange}
        >
          <HeatmapLayer
            data={data.map(({ lat, lng, weight }) => ({ location: new window.google.maps.LatLng(lat, lng), weight }))}
            options={{
              radius: 22.5,
              opacity: 0.8,
              gradient: [
                "rgba(0, 255, 0, 0)",
                "rgba(255, 255, 0, 1)",
                "rgba(255, 165, 0, 1)",
                "rgba(255, 0, 0, 1)",
              ],
            }}
          />
          {data.map((point, index) => (
            <Marker
              key={index}
              position={{ lat: point.lat, lng: point.lng }}
              onMouseOver={() => handleMouseOver(point)}
              onMouseOut={handleMouseOut}
              opacity={0}
            />
          ))}
          {selectedPoint && showTooltip && (
            <InfoWindow
              position={{ lat: selectedPoint.lat, lng: selectedPoint.lng }}
              onCloseClick={() => {
                setShowTooltip(false);
                setSelectedPoint(null);
              }}
            >
              <div className="text-black p-2 bg-white shadow-lg rounded-lg" onMouseEnter={handleInfoWindowMouseEnter} onMouseLeave={handleInfoWindowMouseLeave}>
                <h3 className="text-lg font-bold">{selectedPoint.name || "Unknown Location"}</h3>
                <p className="text-sm"><strong>Latitude:</strong> {selectedPoint.lat}</p>
                <p className="text-sm"><strong>Longitude:</strong> {selectedPoint.lng}</p>
                <p className="text-sm"><strong>Weight:</strong> {selectedPoint.weight}</p>
                <p className="text-sm text-blue-500 underline">
                  <a href={`https://www.google.com/maps/search/?api=1&query=${selectedPoint.lat},${selectedPoint.lng}`} target="_blank" rel="noopener noreferrer">View on Google Maps</a>
                </p>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </div>
    </div>
  );
}
