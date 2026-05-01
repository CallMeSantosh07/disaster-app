import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Circle, LayersControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import './App.css'; 

let DefaultIcon = L.icon({
    iconUrl: icon, shadowUrl: iconShadow, iconSize: [25, 41], iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const floodIcon = new L.DivIcon({ className: 'custom-icon', html: '<div style="font-size: 28px; filter: drop-shadow(0px 0px 5px rgba(255,0,0,0.5));">🔴</div>', iconSize: [28, 28], iconAnchor: [14, 14] });
const landslideIcon = new L.DivIcon({ className: 'custom-icon', html: '<div style="font-size: 28px; filter: drop-shadow(0px 0px 5px rgba(255,165,0,0.5));">🟠</div>', iconSize: [28, 28], iconAnchor: [14, 14] });
const quakeIcon = new L.DivIcon({ className: 'custom-icon', html: '<div style="font-size: 24px; filter: drop-shadow(0px 0px 5px rgba(128,0,128,0.8));">💥</div>', iconSize: [24, 24], iconAnchor: [12, 12] });
const safeIcon = new L.DivIcon({ className: 'custom-icon', html: '<div style="font-size: 28px; filter: drop-shadow(0px 0px 5px rgba(0,128,0,0.8));">🟢</div>', iconSize: [28, 28], iconAnchor: [14, 14] });

const safeZoneData = [
  { id: 101, name: 'Pokhara Regional Hospital', position: [28.2126, 83.9880], type: 'Hospital', capacity: '500 beds' },
  { id: 102, name: 'Kathmandu Emergency Shelter', position: [27.7120, 85.3150], type: 'Shelter', capacity: '1000 people' },
  { id: 103, name: 'Dhulikhel Safe Ground', position: [27.6186, 85.5503], type: 'Open Ground', capacity: '2000 people' }
];

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))); 
}

function RecenterAutomatically({ location }) {
  const map = useMap();
  useEffect(() => { if (location) map.flyTo(location, 10, { animate: true, duration: 1.5 }); }, [location, map]);
  return null;
}

function App() {
  const nepalCenter = [28.3949, 84.1240];
  const [userLocation, setUserLocation] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all'); 
  
  const [timeFilter, setTimeFilter] = useState('all'); 

  const [nearbyAlerts, setNearbyAlerts] = useState([]);
  const [earthquakes, setEarthquakes] = useState([]);
  const [showSafeZones, setShowSafeZones] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [locationName, setLocationName] = useState("Your Location");
  
  const [disasterData, setDisasterData] = useState([]);

  const [clickedPosition, setClickedPosition] = useState(null);
  const [reportType, setReportType] = useState('flood');
  const [reportSeverity, setReportSeverity] = useState('High');

  useEffect(() => {
    fetchDisasters();
    fetchEarthquakes();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude; const lon = pos.coords.longitude;
          setUserLocation([lat, lon]); setLocationName("Your Location"); fetchWeather(lat, lon);
        },
        (err) => console.error("Error getting location: ", err.message)
      );
    }
  }, []);

  const fetchDisasters = async () => {
    try {
      const response = await fetch('https://nepal-disaster-api.onrender.com/api/disasters');
      const data = await response.json();
      
      if (Array.isArray(data)) {
        setDisasterData(data);
      } else {
        console.error("Received bad data format:", data);
        setDisasterData([]);
      }
    } catch (error) { 
      console.error("Failed to connect to backend:", error); 
      setDisasterData([]);
    }
  };

  useEffect(() => {
    if (userLocation && Array.isArray(disasterData) && disasterData.length > 0) {
      const alerts = disasterData
        .filter(d => d.position && d.position.length === 2) 
        .map(d => {
          const distance = calculateDistance(userLocation[0], userLocation[1], d.position[0], d.position[1]);
          return { ...d, distance: distance.toFixed(1) };
        })
        .filter(d => d.distance < 50); 
      setNearbyAlerts(alerts);
    }
  }, [userLocation, disasterData]);

  const fetchWeather = async (lat, lon) => {
    try {
      const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=38d2c98bed3fe0a51c8e657c71b803d6&units=metric`);
      const data = await res.json();
      if (data.cod === 200) setWeatherData(data);
    } catch (error) { console.error("Failed to fetch weather."); }
  };

  const fetchEarthquakes = async () => {
    try {
      const res = await fetch('https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minlatitude=26&maxlatitude=31&minlongitude=80&maxlongitude=89&minmagnitude=2.0&limit=30');
      const data = await res.json();
      setEarthquakes(data.features);
    } catch (error) { console.error("Failed to fetch earthquake data."); }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery) return;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${searchQuery},Nepal`);
      const data = await res.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat); const lon = parseFloat(data[0].lon);
        setUserLocation([lat, lon]); setLocationName(data[0].name || searchQuery); fetchWeather(lat, lon); setSearchQuery(""); 
      } else { alert("Location not found in Nepal. Please try another city."); }
    } catch (error) { console.error("Geocoding error: ", error); }
  };

  function AddDisasterOnMapClick() {
    useMapEvents({
      click(e) { setClickedPosition([e.latlng.lat, e.latlng.lng]); },
    });
    return null;
  }

  const submitDisasterReport = async () => {
    const newDisaster = {
      type: reportType, position: clickedPosition, locationName: "User Reported Location",
      severity: reportSeverity, description: "Reported by a community user via the app.",
      radius: reportSeverity === 'High' ? 8000 : 4000
    };

    try {
      await fetch('https://nepal-disaster-api.onrender.com/api/disasters', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDisaster)
      });
      alert("✅ Disaster reported and saved to database!");
      setClickedPosition(null);
      fetchDisasters(); 
    } catch (error) { console.error("Error saving disaster:", error); }
  };

  const filteredDisasters = Array.isArray(disasterData) ? disasterData.filter(d => {
    const matchType = activeFilter === 'all' ? true : d.type === activeFilter;
    
    let matchTime = true;
    if (timeFilter !== 'all' && (d.date || d.createdAt)) {
      const disasterDate = new Date(d.date || d.createdAt);
      const now = new Date();
      const diffInHours = (now - disasterDate) / (1000 * 60 * 60);
      
      if (timeFilter === '24h') matchTime = diffInHours <= 24;
      if (timeFilter === '7d') matchTime = diffInHours <= (24 * 7);
    }
    
    return matchType && matchTime;
  }) : [];

  return (
    <div className="app-container">
      <h1 className="app-title">🌍 Nepal Disaster Alert Dashboard</h1>
      
      {nearbyAlerts.length > 0 && (
        <div className="emergency-banner">
          <h2>🚨 EMERGENCY WARNING 🚨</h2>
          {nearbyAlerts.map(alert => (
            <p key={alert._id || alert.id}>
              {locationName} is only {alert.distance} km away from a {alert.severity} severity {alert.type}!
            </p>
          ))}
        </div>
      )}

      <form onSubmit={handleSearch} className="search-form">
        <input type="text" className="search-input" placeholder="Search city in Nepal (e.g. Kathmandu)..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        <button type="submit" className="search-btn">🔍 Search</button>
      </form>

      <div className="filter-container" style={{ alignItems: 'center' }}>
        <button className={`filter-btn ${activeFilter === 'all' ? 'btn-all' : 'btn-inactive'}`} onClick={() => setActiveFilter('all')}>🌍 Show All</button>
        <button className={`filter-btn ${activeFilter === 'flood' ? 'btn-flood' : 'btn-inactive'}`} onClick={() => setActiveFilter('flood')}>🔴 Floods</button>
        <button className={`filter-btn ${activeFilter === 'landslide' ? 'btn-landslide' : 'btn-inactive'}`} onClick={() => setActiveFilter('landslide')}>🟠 Landslides</button>
        <button className={`filter-btn ${activeFilter === 'earthquake' ? 'btn-quake' : 'btn-inactive'}`} onClick={() => setActiveFilter('earthquake')}>💥 Earthquakes</button>
        <button className={`filter-btn ${showSafeZones ? 'btn-safe' : 'btn-inactive'}`} onClick={() => setShowSafeZones(!showSafeZones)}>{showSafeZones ? '🟢 Hide Safe Zones' : '🟢 Show Safe Zones'}</button>
        
        <select 
          value={timeFilter} 
          onChange={(e) => setTimeFilter(e.target.value)}
          style={{ padding: '12px', borderRadius: '30px', border: '1px solid #cbd5e1', fontFamily: 'Poppins', fontWeight: '600', color: '#1e293b', outline: 'none', cursor: 'pointer', marginLeft: '10px' }}
        >
          <option value="all">⏱️ All Time</option>
          <option value="24h">⏱️ Last 24 Hours</option>
          <option value="7d">⏱️ Last 7 Days</option>
        </select>
      </div>
      
      <p style={{ textAlign: 'center', color: '#7f8c8d', marginBottom: '10px' }}>
        💡 <strong>Tip:</strong> Click anywhere on the map to report a new disaster!
      </p>

      <div className="map-wrapper">
        <MapContainer center={nepalCenter} zoom={7} style={{ height: '100%', width: '100%', zIndex: 1 }}>
          <RecenterAutomatically location={userLocation} />
          <AddDisasterOnMapClick />
          
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Standard Street Map"><TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /></LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Esri Satellite"><TileLayer attribution='Tiles &copy; Esri' url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" /></LayersControl.BaseLayer>
          </LayersControl>

          {userLocation && (
            <Marker position={userLocation}>
              <Popup>📍 <strong>{locationName}</strong><br />{weatherData && `${weatherData.main.temp}°C`}</Popup>
            </Marker>
          )}

          {clickedPosition && (
            <Marker position={clickedPosition}>
              <Popup onClose={() => setClickedPosition(null)}>
                <div className="report-popup">
                  <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>Report a Disaster</h3>
                  <select value={reportType} onChange={(e) => setReportType(e.target.value)}>
                    <option value="flood">Flood</option>
                    <option value="landslide">Landslide</option>
                  </select>
                  <select value={reportSeverity} onChange={(e) => setReportSeverity(e.target.value)}>
                    <option value="High">High (Red Alert)</option>
                    <option value="Medium">Medium (Warning)</option>
                  </select>
                  <button onClick={submitDisasterReport}>Submit Report</button>
                </div>
              </Popup>
            </Marker>
          )}

          {filteredDisasters.map((d) => {
            if (!d.position || d.position.length !== 2) return null; 
            return (
              <React.Fragment key={d._id || d.id}>
                <Circle center={d.position} radius={d.radius} pathOptions={{ color: d.type === 'flood' ? '#e74c3c' : '#f39c12', fillColor: d.type === 'flood' ? '#e74c3c' : '#f39c12', fillOpacity: 0.2 }} />
                <Marker position={d.position} icon={d.type === 'flood' ? floodIcon : landslideIcon}>
                  <Popup>
                    <h3>{d.type.toUpperCase()}</h3>
                    <p>{d.description}</p>
                    {(d.date || d.createdAt) && <small style={{color: '#666'}}>Reported: {new Date(d.date || d.createdAt).toLocaleString()}</small>}
                  </Popup>
                </Marker>
              </React.Fragment>
            );
          })}

          {showSafeZones && safeZoneData.map((safe) => (
             <Marker key={safe.id} position={safe.position} icon={safeIcon}><Popup><h3>🟢 Safe Zone</h3>{safe.name}</Popup></Marker>
          ))}
        </MapContainer>

        <div className="map-legend">
          <h4>Map Legend</h4>
          <div className="legend-item"><span>📍</span> Active Location</div>
          <div className="legend-item"><span>🔴</span> Flood Warning</div>
          <div className="legend-item"><span>🟠</span> Landslide Warning</div>
          <div className="legend-item"><span>💥</span> Live Earthquake</div>
          <div className="legend-item"><span>🟢</span> Safe Zone / Hospital</div>
        </div>

      </div>
    </div>
  );
}

export default App;