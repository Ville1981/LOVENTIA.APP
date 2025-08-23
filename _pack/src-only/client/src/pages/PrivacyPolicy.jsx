const PrivacyPolicy = () => {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 text-sm text-gray-800">
      <h1 className="text-2xl font-semibold mb-4">Tietosuojaseloste</h1>

      <p className="mb-4">
        Tämä sivusto kerää ja käsittelee henkilötietoja tarjotakseen turvallisen
        ja toimivan deittipalvelun. Kerättäviä tietoja ovat esimerkiksi nimi,
        sähköposti, ikä, sijainti, kiinnostuksen kohteet ja viestit.
      </p>

      <p className="mb-4">Tietoja käytetään mm. seuraaviin tarkoituksiin:</p>
      <ul className="list-disc pl-6 mb-4">
        <li>Käyttäjäprofiilin näyttäminen ja hallinta</li>
        <li>Matchien ja keskustelujen luominen</li>
        <li>Premium-jäsenyyksien käsittely (Stripe)</li>
        <li>Ylläpidon ja turvallisuuden takaaminen</li>
      </ul>

      <p className="mb-4">
        Tietoja ei jaeta ulkopuolisille ilman suostumustasi, lukuun ottamatta
        maksupalveluntarjoajaa (Stripe). Käytämme evästeitä sivuston toiminnan
        ja käyttökokemuksen parantamiseksi.
      </p>

      <p className="mb-4">
        Voit koska tahansa poistaa tilisi asetuksista, jolloin kaikki tietosi
        poistetaan palvelustamme.
      </p>

      <p className="text-sm text-gray-500 mb-2">
        Jos sinulla on kysyttävää tietosuojasta, voit ottaa yhteyttä:{" "}
        tietosuoja@deittiapp.fi
      </p>

      <p className="text-xs text-gray-400">
        Päivitetty: {new Date().toLocaleDateString("fi-FI")}
      </p>
    </div>
  );
};

export default PrivacyPolicy;
