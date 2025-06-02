import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import axios from "axios";
import { useTranslation } from "react-i18next";

// Oletusikoni toimii Leafletissä
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const MapView = () => {
  const { t } = useTranslation();
  const [position, setPosition] = useState(null); // oma sijainti
  const [users, setUsers] = useState([]); // muut käyttäjät
  const [error, setError] = useState("");
  const token = localStorage.getItem("token");

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setPosition([latitude, longitude]);

        try {
          // Hae oma kaupunki nimellä
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          const geoData = await geoRes.json();
          const city =
            geoData.address.city ||
            geoData.address.town ||
            geoData.address.village;

          if (!city) {
            setError(t("map.cityNotFound"));
            return;
          }

          // Hae muiden käyttäjien tiedot tältä paikkakunnalta
          const res = await axios.get(`http://localhost:5000/api/users/nearby?city=${city}`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          // Suodata: näytetään vain käyttäjät, joilla on sijainti ja koordinaatit
          const filtered = res.data.filter(
            (u) => u.location && u.latitude && u.longitude
          );

          setUsers(filtered);
        } catch (err) {
          console.error("Virhe käyttäjien haussa:", err);
          setError(t("map.fetchError"));
        }
      },
      () => setError(t("map.locationError"))
    );
  }, [token]);

  return (
    <div className="h-[80vh] p-4">
      <h2 className="text-xl font-semibold mb-4 text-center">🗺️ {t("map.title")}</h2>
      {error && <p className="text-red-500 text-center">{error}</p>}

      {position ? (
        <MapContainer center={position} zoom={13} className="h-full w-full rounded shadow">
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
          />

          {/* Oma sijainti */}
          <Marker position={position}>
            <Popup>🧍 {t("map.youAreHere")}</Popup>
          </Marker>

          {/* Muut käyttäjät */}
          {users.map((user) => (
            <Marker key={user._id} position={[user.latitude, user.longitude]}>
              <Popup>
                <strong>{user.name}</strong>
                <br />
                {user.age} {t("profile.age")}
                <br />
                {user.interests?.join(", ")}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      ) : (
        <p className="text-center text-gray-500">🔄 {t("map.loadingLocation")}</p>
      )}
    </div>
  );
};

export default MapView;
