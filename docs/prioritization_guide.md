# Priorisointikehikko ja ohjeistus

Tässä dokumentissa kuvataan **featurejen priorisointiprosessi** käyttäjäpalautteen pohjalta.

## 1. Impact (vaikutus)

- Skaala 1–10, missä:
  - 1 = vähäinen vaikutus käyttäjille
  - 10 = kriittinen vaikutus liiketoiminnalle tai käyttäjäkokemukselle
- Arvio perustuu:
  - palvelusesityksen välitön asiakaspalaute
  - kvantitatiiviset mittarit (kyselyt, NPS)

## 2. Effort (työmäärä)

- Skaala 1–10, missä:
  - 1 = erittäin kevyt toteutus
  - 10 = laaja ja monimutkainen kehitys
- Arvio perustuu:
  - kehittäjän työmatriisit
  - arkkitehtuuri- ja suunnittelukustannukset

## 3. Prioriteetin laskenta

Prioriteetti = **impact / effort**

- Mitä suurempi arvo, sitä suurempi prioriteetti
- Erityistapaukset:
  - Jos `effort` = 0, pisteet asetetaan äärettömäksi (korkein prioriteetti)

## 4. Käyttö

1. Kerää käyttäjäpalautteet CSV- tai JSON-muodossa, sisältäen `impact` ja `effort`.
2. Aja `scripts/backlogProcessor.js <input> <output>`.
3. Tuloksena on lista featureistä, niiden pisteet ja painoarvot.

## 5. Seuranta ja päivitys

- Päivitä vaikutus- ja työmääräarviot säännöllisesti (esim. sprintin alussa).
- Tarkista priorisoinnin tulokset tiimin review-kokouksessa.

---

© 2025 Your Company Name
