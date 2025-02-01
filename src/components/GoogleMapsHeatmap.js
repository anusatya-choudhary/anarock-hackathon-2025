import { useEffect, useState, useRef, useCallback } from "react";
import { GoogleMap, useJsApiLoader, HeatmapLayer, Marker, InfoWindow } from "@react-google-maps/api";

const center = { lat: 19.7515, lng: 75.7139 }; // Default center (Maharashtra)

const DEBOUNCE_DELAY = 1000; // 1 second delay
const SIGNIFICANT_CHANGE_THRESHOLD = 1; // Adjust this value based on your needs

const isSignificantChange = (oldBounds, newBounds) => {
  if (!oldBounds) return true;
  
  const latChange = Math.abs(oldBounds.north - newBounds.north) + 
                   Math.abs(oldBounds.south - newBounds.south);
  const lngChange = Math.abs(oldBounds.east - newBounds.east) + 
                   Math.abs(oldBounds.west - newBounds.west);
                   
  return latChange > SIGNIFICANT_CHANGE_THRESHOLD || 
         lngChange > SIGNIFICANT_CHANGE_THRESHOLD;
};

export default function GoogleMapsHeatmap() {
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [mapBounds, setMapBounds] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(6);
  const [delta, setDelta] = useState({ lat: 0, lng: 0 });
  const [data, setData] = useState([]);
  const [localityData, setLocalityData] = useState(null);
  const [lastFetchedBounds, setLastFetchedBounds] = useState(null);
  const mapRef = useRef(null);
  const debounceTimer = useRef(null);
  
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: "AIzaSyB0qltSCcuvldlHq_n055xyGJI3HDHH39A",
    libraries: ["visualization"],
  });

  const fetchLocalityData = useCallback((lat, lng) => {
    console.log('Fetching locality data for:', { lat, lng });
    
    fetch('https://insightq.beta.staging.anarock.com/get_locality_data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Connection': 'keep-alive',
        'Origin': 'https://dashboard.beta.staging.anarock.com',
        'Referer': 'https://dashboard.beta.staging.anarock.com/',
        'app_name': 'dashboard',
        'source': 'dashboard',
        'group_by': 'Locality'
      },
      body: JSON.stringify({
        lat: lat,
        lon: lng,
        coordiante_type: "locality"
      })
    })
      .then(res => res.json())
      .then(data => {
        console.log('Locality Data Response:', data);
        if (data.status === 'success' && data.response) {
          setLocalityData(data.response);
        } else {
          console.error('Invalid locality data format:', data);
          setLocalityData(null);
        }
      })
      .catch(err => {
        console.error('Error fetching locality data:', err);
        setLocalityData(null);
      });
  }, []);

  const handleMouseOver = useCallback((point) => {
    if (point.type !== 'locality') return;
    
    clearTimeout(window.tooltipTimeout);
    setSelectedPoint(point);
    setShowTooltip(true);
    setLocalityData(null); // Reset locality data
    fetchLocalityData(point.lat, point.lng);
  }, [fetchLocalityData]);

  const handleMouseOut = useCallback(() => {
    window.tooltipTimeout = setTimeout(() => {
      setShowTooltip(false);
      setSelectedPoint(null);
    }, 1000);
  }, []);

  const handleInfoWindowMouseEnter = useCallback(() => {
    clearTimeout(window.tooltipTimeout);
  }, []);

  const handleInfoWindowMouseLeave = useCallback(() => {
    window.tooltipTimeout = setTimeout(() => {
      setShowTooltip(false);
      setSelectedPoint(null);
    }, 1000);
  }, []);

  const handleMarkerClick = useCallback((point) => {
    if (point.type !== 'locality') return;
    
    console.log('Clicked point:', point);
    setSelectedPoint(point);
    setShowTooltip(true);
    setLocalityData(null);
    fetchLocalityData(point.lat, point.lng);
  }, [fetchLocalityData]);

  const handleBoundsChange = useCallback(() => {
    if (!mapRef.current) return;
    
    const map = mapRef.current;
    const newZoom = map.getZoom();
    const newBounds = map.getBounds().toJSON();
    
    setZoomLevel(newZoom);
    setDelta({
      lat: Math.abs(newBounds.north - newBounds.south),
      lng: Math.abs(newBounds.east - newBounds.west),
    });
    setMapBounds(newBounds);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      if (isSignificantChange(lastFetchedBounds, newBounds)) {
        console.log('Fetching new data due to significant bounds change. Zoom level:', newZoom);
        
        fetch('https://insightq.beta.staging.anarock.com/get_cp2', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Connection': 'keep-alive',
            'Origin': 'https://dashboard.beta.staging.anarock.com',
            'Referer': 'https://dashboard.beta.staging.anarock.com/',
            'app_name': 'dashboard',
            'source': 'dashboard',
            'group_by': 'Locality'
          },
          body: JSON.stringify({
            lat1: newBounds.south,
            lat2: newBounds.north,
            lon1: newBounds.west,
            lon2: newBounds.east
          })
        })
          .then(res => res.json())
          .then(response => {
            if (!response || Object.keys(response).length === 0) {
              setData([]);
              return;
            }

            let dataArray = response.response || response;
            if (!Array.isArray(dataArray)) {
              setData([]);
              return;
            }

            const transformedData = dataArray
              .filter(item => {
                return item && (
                  (item.locality_lat_long && item.Locality) ||
                  (item.district_lat_long && item.District)
                );
              })
              .map(item => {
                const isLocality = !!item.locality_lat_long;
                const latLongString = item.locality_lat_long || item.district_lat_long;
                const [lat, lng] = latLongString.split(',').map(Number);
                
                return {
                  lat,
                  lng,
                  weight: item.count || 0,
                  name: isLocality ? item.Locality : item.District,
                  type: isLocality ? 'locality' : 'district'
                };
              })
              .filter(item => 
                item.lat !== 0 && 
                item.lng !== 0 && 
                !isNaN(item.lat) && 
                !isNaN(item.lng)
              );

            console.log(`Updated data with ${transformedData.length} points at zoom level ${newZoom}`);
            setData(transformedData);
            setLastFetchedBounds(newBounds);
          })
          .catch(err => {
            console.error("API Error:", err);
            setData([]);
          });
      }
    }, DEBOUNCE_DELAY);
  }, [lastFetchedBounds]);

  const handleZoomChanged = useCallback(() => {
    if (!mapRef.current) return;
    const newZoom = mapRef.current.getZoom();
    setZoomLevel(newZoom);
    handleBoundsChange();
  }, [handleBoundsChange]);

  useEffect(() => {
    let isMounted = true;
    
    if (mapRef.current) {
      handleBoundsChange();
    }

    return () => {
      isMounted = false;
      clearTimeout(window.tooltipTimeout);
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [handleBoundsChange]);

  const renderInfoWindowContent = useCallback((point) => {
    return (
      <div 
        className="text-black p-4 bg-white shadow-lg rounded-lg max-w-md" 
        onMouseEnter={handleInfoWindowMouseEnter} 
        onMouseLeave={handleInfoWindowMouseLeave}
      >
        <h3 className="text-lg font-bold mb-2">{point.name}</h3>
        
        {localityData === null ? (
          <p className="text-sm text-gray-500">Loading agent details...</p>
        ) : localityData.length === 0 ? (
          <p className="text-sm text-gray-500">No agents found in this locality</p>
        ) : (
          <div className="space-y-4">
            {localityData.map((agent) => (
              <div key={agent.id} className="border-b pb-4">
                {/* Agent Header with Photo */}
                <div className="flex items-center gap-4 mb-3">
                  {agent["Profile Photo"] && (
                    <img 
                      src={agent["Profile Photo"]} 
                      alt="Profile" 
                      className="w-16 h-16 object-cover rounded-full"
                    />
                  )}
                  <div>
                    <h4 className="font-semibold">
                      {[agent["First Name"], agent["Middle Name"], agent["Last Name"]]
                        .filter(Boolean)
                        .join(" ")}
                    </h4>
                    <p className="text-sm text-gray-600">ID: {agent.id}</p>
                  </div>
                </div>

                {/* Contact & Location Info */}
                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                  <p><strong>Office:</strong> {agent["Office Number"]}</p>
                  <p><strong>Division:</strong> {agent.Division}</p>
                  <p><strong>District:</strong> {agent.District}</p>
                  <p><strong>Taluka:</strong> {agent.Taluka}</p>
                </div>

                {/* Address */}
                <div className="text-sm mb-3">
                  <p className="font-semibold">Address:</p>
                  <p>{[
                    agent["House Number"],
                    agent["Building Name"],
                    agent["Street  Name"],
                    agent.Landmark,
                    agent["Pin Code"]
                  ].filter(Boolean).join(", ")}</p>
                </div>

                {/* Experience */}
                {agent["Past Experience"]?.length > 0 && (
                  <div className="mb-3">
                    <p className="font-semibold text-sm">Past Experience:</p>
                    <ul className="list-disc pl-4 text-sm">
                      {agent["Past Experience"].map((exp, idx) => (
                        <li key={idx}>
                          {exp.ProjectName} - {exp.PromoterName} ({exp.ProType})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Current Projects */}
                {agent["Promoter Details"]?.length > 0 && (
                  <div className="mb-3">
                    <p className="font-semibold text-sm">Current Projects:</p>
                    <ul className="list-disc pl-4 text-sm">
                      {agent["Promoter Details"].map((project, idx) => (
                        <li key={idx}>
                          {project.ProjectName} - {project.PromoterName}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 pt-2 border-t">
          <a 
            href={`https://www.google.com/maps/search/?api=1&query=${point.lat},${point.lng}`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-sm text-blue-500 hover:text-blue-700"
          >
            View on Google Maps
          </a>
        </div>
      </div>
    );
  }, [handleInfoWindowMouseEnter, handleInfoWindowMouseLeave, localityData]);

  const getHeatmapOptions = useCallback((zoom) => {
    const baseRadius = zoom <= 8 ? 30 : 
                      zoom <= 10 ? 25 : 
                      zoom <= 12 ? 20 : 15;
    
    return {
      radius: baseRadius,
      opacity: 0.5,
      dissipating: true,
      gradient: [
        'rgba(0, 0, 0, 0)',         // transparent
        'rgba(65, 105, 225, 1)',    // royal blue
        'rgba(30, 144, 255, 1)',    // dodger blue
        'rgba(0, 191, 255, 1)',     // deep sky blue
        'rgba(0, 250, 154, 1)',     // medium spring green
        'rgba(255, 215, 0, 1)',     // gold
        'rgba(255, 140, 0, 1)',     // dark orange
        'rgba(255, 69, 0, 1)',      // orange red
        'rgba(255, 0, 0, 1)'        // red
      ],
      maxIntensity: zoom <= 8 ? 8 : 4,
      minIntensity: 1
    };
  }, []);

  const transformDataForHeatmap = useCallback((dataPoints) => {
    return dataPoints.map(({ lat, lng, weight }) => ({
      location: new window.google.maps.LatLng(lat, lng),
      weight: Math.pow(weight + 1, 1.5)
    }));
  }, []);

  const renderMap = () => {
    return (
      <div className="p-4 bg-gray-100 text-center w-full">
        <div className="mb-4 p-4 bg-white shadow rounded-lg">
          <p className="text-lg text-black font-semibold">Untapped CPs</p>
          <p className="text-sm text-gray-600">Zoom in to get CP details</p>
          <p className="text-sm text-gray-600">Initial state will show untapped CPs district wise (red means more CPs)</p>
          <p className="text-sm text-gray-600">Zooming in will give locality wise data</p>
          <p className="text-sm text-gray-600">At locality level, click to get CP details</p>
        </div>
        <div className="w-full h-[500px] rounded-lg overflow-hidden shadow-lg">
          <GoogleMap
            mapContainerStyle={{ width: "100%", height: "100%" }}
            center={center}
            zoom={6}
            onLoad={(map) => (mapRef.current = map)}
            onZoomChanged={handleZoomChanged}
            onBoundsChanged={handleBoundsChange}
          >
            <HeatmapLayer
              data={transformDataForHeatmap(data)}
              options={getHeatmapOptions(zoomLevel)}
            />
            {data.map((point, index) => (
              <Marker
                key={index}
                position={{ lat: point.lat, lng: point.lng }}
                onMouseOver={() => handleMouseOver(point)}
                onMouseOut={handleMouseOut}
                onClick={() => handleMarkerClick(point)}
                opacity={0}
              />
            ))}
            {selectedPoint && showTooltip && (
              <InfoWindow
                position={{ lat: selectedPoint.lat, lng: selectedPoint.lng }}
                onCloseClick={() => {
                  setShowTooltip(false);
                  setSelectedPoint(null);
                  setLocalityData(null);
                }}
              >
                {renderInfoWindowContent(selectedPoint)}
              </InfoWindow>
            )}
          </GoogleMap>
        </div>
      </div>
    );
  };

  if (!isLoaded) return <div className="text-center text-xl font-bold">Loading...</div>;

  return renderMap();
}