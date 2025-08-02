import React from 'react';

const ProfessionReligionFields = ({ profession, setProfession, religion, setReligion }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
    <div>
      <label className="block font-medium">💼 Ammatti</label>
      <input
        type="text"
        placeholder="Ammatti"
        value={profession}
        onChange={(e) => setProfession(e.target.value)}
        className="p-2 border rounded w-full"
      />
    </div>
    <div>
      <label className="block font-medium">🕊 Uskonto</label>
      <select
        value={religion}
        onChange={(e) => setReligion(e.target.value)}
        className="p-2 border rounded w-full"
      >
        <option value="">Valitse uskonto</option>
        <option value="Kristinusko">Kristinusko</option>
        <option value="Islam">Islam</option>
        <option value="Hindulaisuus">Hindulaisuus</option>
        <option value="Buddhalaisuus">Buddhalaisuus</option>
        <option value="Kansanusko">Kansanusko</option>
        <option value="Uskonnottomuus">Uskonnottomuus</option>
        <option value="Muu">Muu</option>
      </select>
    </div>
  </div>
);

export default ProfessionReligionFields;
