// src/components/discoverFields/DiscoverLocation.jsx
import React from "react";
import PropTypes from "prop-types";
import { countryRegions, regionCities } from "../../utils/locationData";

const DiscoverLocation = ({
  country, setCountry,
  region,  setRegion,
  city,    setCity,
  customCountry, setCustomCountry,
  customRegion,  setCustomRegion,
  customCity,    setCustomCity,
}) => {
  const regionOptions = country ? countryRegions[country] : [];
  const cityOptions   = country && region
    ? regionCities[country]?.[region] || []
    : [];

  return (
    <div className="flex flex-col space-y-6 w-full text-left">
      {/* Country */}
      <div>
        <label className="block font-medium mb-1">🌍 Country</label>
        <select
          value={country}
          onChange={e => setCountry(e.target.value)}
          className="p-2 border rounded w-full"
        >
          <option value="">Select country</option>
          {Object.keys(countryRegions).map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Other country"
          value={customCountry}
          onChange={e => setCustomCountry(e.target.value)}
          className="mt-2 p-2 border rounded w-full"
        />
      </div>
      {/* Region */}
      <div>
        <label className="block font-medium mb-1">🗺 Region</label>
        <select
          value={region}
          onChange={e => setRegion(e.target.value)}
          disabled={!country}
          className="p-2 border rounded w-full"
        >
          <option value="">Select region</option>
          {regionOptions.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Other region"
          value={customRegion}
          onChange={e => setCustomRegion(e.target.value)}
          className="mt-2 p-2 border rounded w-full"
        />
      </div>
      {/* City */}
      <div>
        <label className="block font-medium mb-1">🏩 City</label>
        <select
          value={city}
          onChange={e => setCity(e.target.value)}
          disabled={!region}
          className="p-2 border rounded w-full"
        >
          <option value="">Select city</option>
          {cityOptions.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Other city"
          value={customCity}
          onChange={e => setCustomCity(e.target.value)}
          className="mt-2 p-2 border rounded w-full"
        />
      </div>
    </div>
  );
};

DiscoverLocation.propTypes = {
  country: PropTypes.string.isRequired,
  setCountry: PropTypes.func.isRequired,
  region: PropTypes.string.isRequired,
  setRegion: PropTypes.func.isRequired,
  city: PropTypes.string.isRequired,
  setCity: PropTypes.func.isRequired,
  customCountry: PropTypes.string.isRequired,
  setCustomCountry: PropTypes.func.isRequired,
  customRegion: PropTypes.string.isRequired,
  setCustomRegion: PropTypes.func.isRequired,
  customCity: PropTypes.string.isRequired,
  setCustomCity: PropTypes.func.isRequired,
};

export default DiscoverLocation;
