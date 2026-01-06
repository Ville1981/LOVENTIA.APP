// PATH: client/src/pages/MapPage.jsx
// File: client/src/pages/MapPage.jsx

import L from "leaflet";
import PropTypes from "prop-types";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";

import api from "../utils/axiosInstance";

// --- REPLACE START: keep Leaflet CSS scoped to the Map route chunk (bundle hygiene) ---
// NOTE:
// - This file is lazy-loaded via App.jsx (route-level code splitting).
// - Keeping Leaflet CSS import HERE ensures it is NOT part of the initial homepage bundle.
// - Make sure main.jsx does NOT also import leaflet.css, otherwise it ends up in the entry chunk.
import "leaflet/dist/leaflet.css";
// --- REPLACE END ---

import AdGate from "../components/AdGate";
import AdBanner from "../components/AdBanner";

// --- REPLACE START: configure default Leaflet icon URLs ---
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});
// --- REPLACE END ---

/**
 * Haversine formula to compute distance (km) between two [lat, lon] points.
 */
function getDistance([lat1, lon1], [lat2, lon2]) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Automatically locates the user via Leaflet and tell parent via onLocate. */
function LocateControl({ onLocate }) {
  const map = useMap();

  useEffect(() => {
    map.locate({
      watch: false,
      setView: true,
      maxZoom: 16,
      enableHighAccuracy: true,
    });

    const handleFound = (e) => onLocate([e.latlng.lat, e.latlng.lng]);
    const handleError = () => {};

    map.on("locationfound", handleFound);
    map.on("locationerror", handleError);

    return () => {
      map.off("locationfound", handleFound);
      map.off("locationerror", handleError);
    };
  }, [map, onLocate]);

  return null;
}

LocateControl.propTypes = { onLocate: PropTypes.func.isRequired };

/** Renders a "Home" button that resets the map view to the home coordinates. */
function HomeButton({ home }) {
  const map = useMap();
  const handleClick = () => map.setView(home, map.getZoom());

  return (
    <button
      type="button"
      onClick={handleClick}
      style={{
        position: "absolute",
        top: 16,
        right: 16,
        zIndex: 1000,
        background: "#fff",
        padding: "8px",
        borderRadius: 4,
        boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
      }}
    >
      🏠 Home
    </button>
  );
}

HomeButton.propTypes = { home: PropTypes.arrayOf(PropTypes.number).isRequired };

/** Captures map clicks and calls onMapClick with [lat, lng]. */
function ClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

ClickHandler.propTypes = { onMapClick: PropTypes.func.isRequired };

const MapPage = ({ onLocationSelect }) => {
  const { t } = useTranslation();
  const [home, setHome] = useState(null);
  const [marker, setMarker] = useState(null);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");

  // --- REPLACE START: initialize map center from logged-in user's saved coordinates ---
  /**
   * On mount, try to center the map on the logged-in user's saved location
   * (home location from profile). We support both:
   *  - flat fields: latitude / longitude
   *  - GeoJSON-style: location.coordinates = [lng, lat]
   *
   * If no usable coordinates are found, we silently fall back to the
   * existing browser geolocation / default center.
   */
  useEffect(() => {
    let cancelled = false;

    api
      .get("/auth/me")
      .then((res) => {
        const me = res.data || {};

        let lat = me.latitude;
        let lng = me.longitude;

        // Support GeoJSON-style coordinates: [lng, lat]
        if (
          (lat == null || lng == null) &&
          me.location &&
          Array.isArray(me.location.coordinates) &&
          me.location.coordinates.length >= 2
        ) {
          const [coordLng, coordLat] = me.location.coordinates;
          lat = coordLat;
          lng = coordLng;
        }

        if (lat != null && lng != null) {
          const latNum = Number(lat);
          const lngNum = Number(lng);

          if (
            !cancelled &&
            Number.isFinite(latNum) &&
            Number.isFinite(lngNum)
          ) {
            const coords = [latNum, lngNum];
            setHome(coords);
            setMarker(coords);
            if (onLocationSelect) {
              onLocationSelect(coords);
            }
          }
        }
      })
      .catch(() => {
        // Ignore errors here; LocateControl + default center will still work.
      });

    return () => {
      cancelled = true;
    };
  }, [onLocationSelect]);
  // --- REPLACE END: initialize map center from logged-in user's saved coordinates ---

  // When locate fires, set home & marker
  const handleLocate = (coords) => {
    setHome(coords);
    setMarker(coords);
    if (onLocationSelect) onLocationSelect(coords);
  };

  // When 'home' changes, reverse-geocode and fetch nearby users
  useEffect(() => {
    if (!home) return;

    fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${home[0]}&lon=${home[1]}`
    )
      .then((res) => res.json())
      .then((data) => {
        const city = data.address.city || data.address.town || data.address.village;
        if (!city) throw new Error(t("map.cityNotFound"));
        return api.get(`/users/nearby?city=${encodeURIComponent(city)}`);
      })
      .then((res) => {
        setUsers(res.data.filter((u) => u.latitude != null && u.longitude != null));
      })
      .catch((err) => setError(err.message));
  }, [home, t]);

  return (
    <div style={{ position: "relative", height: "80vh", padding: "1rem" }}>
      <h2 className="text-xl font-semibold mb-4 text-center">
        🗺️ {t("map.title")}
      </h2>

      {error && <p className="text-red-500 text-center">{error}</p>}

      <MapContainer
        center={home || [60.1699, 24.9384]}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
        />

        <LocateControl onLocate={handleLocate} />
        {home && <HomeButton home={home} />}
        <ClickHandler onMapClick={setMarker} />

        {marker && (
          <Marker position={marker}>
            <Popup>
              🧍 {t("map.youAreHere")}
              <br />
              <small>
                {marker[0].toFixed(5)}, {marker[1].toFixed(5)}
              </small>
            </Popup>
          </Marker>
        )}

        {users.map((u) => {
          const pos = [u.latitude, u.longitude];
          const dist = home ? getDistance(home, pos).toFixed(2) : "?";

          return (
            <Marker key={u._id} position={pos}>
              <Popup>
                <strong>{u.name}</strong>
                <br />
                {u.age} {t("profile:age")}
                <br />
                {u.interests?.join(", ")}
                <br />
                <small>
                  {t("map.distance")} {dist} km
                </small>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* --- REPLACE START: standard content ad slot (inline) --- */}
      <AdGate type="inline" debug={false}>
        <div className="max-w-3xl mx-auto mt-6">
          <AdBanner
            imageSrc="/ads/ad-right1.png"
            headline="Sponsored"
            body="Upgrade to Premium to remove all ads."
          />
        </div>
      </AdGate>
      {/* --- REPLACE END --- */}
    </div>
  );
};

MapPage.propTypes = { onLocationSelect: PropTypes.func };

export default MapPage;

