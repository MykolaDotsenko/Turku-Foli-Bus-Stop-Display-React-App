// My Places, Get me Home, the printed Home card and the driver card's
// buttons. What the driver reads is Finnish already and never goes through
// here.
export default {
  // The places, named by id (hooks/useSavedPlaces.js)
  Home: "Koti",
  School: "Koulu",
  Work: "Työ",

  // My Places
  "My Places": "Omat paikat",
  "No address to remember": "Osoitetta ei tarvitse muistaa",
  "Save Home, School or Work as public stops — no address to type or remember.":
    "Tallenna kodin, koulun tai työpaikan lähin pysäkki – osoitetta ei tarvita.",
  "Finding the closest Föli stops…": "Etsitään lähimpiä Fölin pysäkkejä…",
  "Transit links open externally with only the public destination stop. Your starting location is not embedded in the link.":
    "Reittilinkit avautuvat toisessa palvelussa, ja niissä on vain julkinen määränpääpysäkki. Lähtösijaintiasi ei lisätä linkkiin.",
  "Stop locations are temporarily unavailable.":
    "Pysäkkien sijainnit eivät ole tilapäisesti saatavilla.",
  "This location appears outside Föli’s published service area. Choose a public stop manually instead.":
    "Sijainti näyttää olevan Fölin julkaiseman palvelualueen ulkopuolella. Valitse sen sijaan julkinen pysäkki itse.",
  "The nearest Föli stop is {distance} away. Move closer to the place before saving it.":
    "Lähin Fölin pysäkki on {distance} päässä. Mene lähemmäs paikkaa ennen kuin tallennat sen.",

  // A place not set up yet
  "Not set": "Ei vielä tallennettu",
  "Save the stops you use, without typing an address.":
    "Tallenna käyttämäsi pysäkit kirjoittamatta osoitetta.",
  "Use my location": "Käytä sijaintiani",
  "Use {name}": "Käytä pysäkkiä {name}",

  // Choosing a place's stops
  "Choose stops for Home": "Valitse kodin pysäkit",
  "Choose stops for School": "Valitse koulun pysäkit",
  "Choose stops for Work": "Valitse työpaikan pysäkit",
  "Tick the stops you use to get Home, and mark one as Primary.":
    "Valitse pysäkit, joita käytät kotimatkalla, ja merkitse yksi pääpysäkiksi.",
  "Tick the stops you use to get to School, and mark one as Primary.":
    "Valitse pysäkit, joita käytät koulumatkalla, ja merkitse yksi pääpysäkiksi.",
  "Tick the stops you use to get to Work, and mark one as Primary.":
    "Valitse pysäkit, joita käytät työmatkalla, ja merkitse yksi pääpysäkiksi.",
  "How this works": "Miten tämä toimii",
  Cancel: "Peruuta",
  "Review the public stop you selected and confirm that it is suitable for this destination.":
    "Tarkista valitsemasi julkinen pysäkki ja vahvista, että se sopii tähän määränpäähän.",
  "When location quality is good and a stop is reasonably close, the nearest stop is selected first. Otherwise you must choose manually.":
    "Kun sijainti on tarkka ja pysäkki riittävän lähellä, lähin pysäkki valitaan valmiiksi. Muuten valitse pysäkki itse.",
  "Add backup stops only if you know they are suitable and familiar for arriving at Home.":
    "Lisää varapysäkkejä vain, jos tiedät, että ne sopivat ja ovat sinulle tuttuja, kun tulet kotiin.",
  "Add backup stops only if you know they are suitable and familiar for arriving at School.":
    "Lisää varapysäkkejä vain, jos tiedät, että ne sopivat ja ovat sinulle tuttuja, kun tulet kouluun.",
  "Add backup stops only if you know they are suitable and familiar for arriving at Work.":
    "Lisää varapysäkkejä vain, jos tiedät, että ne sopivat ja ovat sinulle tuttuja, kun tulet töihin.",
  // Named actions, one per place, so Finnish can put the place in its case.
  "Use my location to set up Home": "Käytä sijaintiani kodin asettamiseen",
  "Use my location to set up School": "Käytä sijaintiani koulun asettamiseen",
  "Use my location to set up Work": "Käytä sijaintiani työpaikan asettamiseen",
  "Use {name} for Home": "Käytä pysäkkiä {name} kodin pysäkkinä",
  "Use {name} for School": "Käytä pysäkkiä {name} koulun pysäkkinä",
  "Use {name} for Work": "Käytä pysäkkiä {name} työpaikan pysäkkinä",
  "Manage Home": "Kodin asetukset",
  "Manage School": "Koulun asetukset",
  "Manage Work": "Työpaikan asetukset",
  "Sharing Home reveals its saved public stop names and IDs, which can indicate the general area.":
    "Jakaminen paljastaa kodin tallennettujen julkisten pysäkkien nimet ja numerot, joista voi päätellä likimääräisen alueen.",
  "Sharing School reveals its saved public stop names and IDs, which can indicate the general area.":
    "Jakaminen paljastaa koulun tallennettujen julkisten pysäkkien nimet ja numerot, joista voi päätellä likimääräisen alueen.",
  "Sharing Work reveals its saved public stop names and IDs, which can indicate the general area.":
    "Jakaminen paljastaa työpaikan tallennettujen julkisten pysäkkien nimet ja numerot, joista voi päätellä likimääräisen alueen.",
  "Only public stop IDs and names are saved; your exact location is discarded.":
    "Vain julkisten pysäkkien numerot ja nimet tallennetaan. Tarkkaa sijaintiasi ei tallenneta.",
  "Using the stop you selected manually": "Käytetään itse valitsemaasi pysäkkiä",
  "Location accuracy ±{accuracy}": "Sijainnin tarkkuus ±{accuracy}",
  "Location accuracy unavailable": "Sijainnin tarkkuus ei ole tiedossa",
  "no stop was preselected — choose and confirm an arrival stop yourself":
    "pysäkkiä ei valittu valmiiksi – valitse ja vahvista saapumispysäkki itse",
  "Main stop": "Pääpysäkki",
  "Yes, this is the right stop for Home.": "Kyllä, tämä on oikea pysäkki kotiin.",
  "Yes, these are the right stops for Home.":
    "Kyllä, nämä ovat oikeat pysäkit kotiin.",
  "Yes, this is the right stop for School.":
    "Kyllä, tämä on oikea pysäkki kouluun.",
  "Yes, these are the right stops for School.":
    "Kyllä, nämä ovat oikeat pysäkit kouluun.",
  "Yes, this is the right stop for Work.": "Kyllä, tämä on oikea pysäkki töihin.",
  "Yes, these are the right stops for Work.":
    "Kyllä, nämä ovat oikeat pysäkit töihin.",
  "Save {label}": "Tallenna {label}",

  // A place shared by link
  "Shared place": "Jaettu paikka",
  "Add {label}?": "Lisätäänkö {label}?",
  "Replace {label}?": "Korvataanko {label}?",
  "This link contains public Föli stop IDs and names, not an exact private address. Those stops can still reveal the general area of this place. The app cannot verify who created the link, so accept shared places only from someone you trust.":
    "Linkissä on Fölin julkisten pysäkkien numerot ja nimet, ei tarkkaa yksityistä osoitetta. Pysäkeistä voi silti päätellä paikan likimääräisen alueen. Sovellus ei voi tarkistaa, kuka linkin teki, joten hyväksy jaettuja paikkoja vain henkilöltä, johon luotat.",
  primary: "pääpysäkki",
  "Add {label}": "Lisää {label}",
  "Replace {label}": "Korvaa {label}",
  "Not now": "Ei nyt",

  // A saved place
  "Needs review": "Tarkistettava",
  "stop {id}": "pysäkki {id}",
  "Main stop: {name} · stop {id}":
    "Pääpysäkki: {name} · pysäkki {id}",
  "One or more saved stops no longer appear in the current Föli stop catalogue. Review this place before relying on it.":
    "Yksi tai useampi tallennettu pysäkki puuttuu Fölin nykyisestä pysäkkiluettelosta. Tarkista tämä paikka, ennen kuin luotat siihen.",

  "Go to School": "Reitti kouluun",
  "Go to Work": "Reitti töihin",
  "{action} by public transit": "{action} joukkoliikenteellä",
  "Show to driver": "Näytä kuljettajalle",
  "Open School stop": "Avaa koulun pysäkki",
  "Open Work stop": "Avaa työpaikan pysäkki",
  "1 backup stop": "1 varapysäkki",
  "{count} backup stops": "{count} varapysäkkiä",
  "Make main stop": "Tee pääpysäkiksi",

  "Replace using where I am now": "Korvaa nykyisen sijaintini perusteella",
  "Share {label}": "Jaa {label}",
  "Remove {label} from My Places?": "Poistetaanko {label} Omista paikoista?",
  "Remove {label}": "Poista {label}",
  "Share link for {label}": "Jakolinkki: {label}",
  "{label} · My Places": "{label} · Omat paikat",
  "Add {label} to My Places": "Lisää {label} Omiin paikkoihin",
  "Link shared.": "Linkki jaettu.",
  "Share link copied.": "Jakolinkki kopioitu.",
  "Copy the share link below.": "Kopioi jakolinkki alta.",

  // Get me Home
  "Travel recovery": "Matka-apu",
  "Need help getting home?": "Tarvitsetko apua kotimatkalla?",
  "Travel help. In an emergency, call 112.":
    "Matka-apua. Hätätilanteessa soita 112.",
  "Home needs review because a saved stop changed or disappeared from the current Föli catalogue.":
    "Tarkista Koti: tallennettu pysäkki on muuttunut tai poistunut Fölin nykyisestä pysäkkiluettelosta.",
  "Get me Home": "Vie minut kotiin",
  "Get me Home by public transit": "Vie minut kotiin joukkoliikenteellä",
  "Home options": "Näytä lisää",
  "Fewer options": "Näytä vähemmän",
  "Open Home stop": "Avaa kotipysäkki",
  "Get me Home opens a route in Google Maps. Check it before you travel.":
    "Vie minut kotiin avaa reitin Google Mapsissa. Tarkista reitti ennen lähtöä.",
  "Transit directions are temporarily unavailable until public stop coordinates load. Your saved stop and driver card still work.":
    "Reittiohjeet eivät ole saatavilla, ennen kuin pysäkkien sijainnit latautuvat. Tallennettu pysäkkisi ja kuljettajalle näytettävä kortti toimivat silti.",
  "Directions need an internet connection.": "Reittiohjeet tarvitsevat verkkoyhteyden.",
  "Backup Home stop": "Kodin varapysäkki",
  "Backup Home stops": "Kodin varapysäkit",
  "If the usual stop is unavailable, choose another stop you approved for Home.":
    "Jos tavallista pysäkkiä ei voi käyttää, valitse toinen kotipysäkki, jonka olet hyväksynyt.",
  "Route there: backup Home stop {name}, stop {id}, by public transit":
    "Reitti sinne: kodin varapysäkki {name}, pysäkki {id}, joukkoliikenteellä",
  "Route there": "Reitti sinne",
  "Open stop": "Avaa pysäkki",
  "Print a backup card": "Tulosta varakortti",
  "A web app cannot help after the phone powers off. Print or save a small Home backup card in advance so the destination still exists outside the phone. The card reveals the saved public Home stop area, so keep it only with the intended user.":
    "Verkkosovellus ei voi auttaa, kun puhelimesta on loppunut virta. Tulosta tai tallenna etukäteen pieni kotimatkakortti, niin määränpää on tallessa myös puhelimen ulkopuolella. Kortista näkee tallennetun kotipysäkin alueen, joten anna se vain sille, jolle se on tarkoitettu.",
  "Print / save Home backup card": "Tulosta / tallenna kotimatkakortti",

  // The printed Home card (its request to the driver stays Finnish)
  "Home backup card": "Kotimatkakortti",
  "Backup stops": "Varapysäkit",
  "Show this card to a driver or trusted adult. This card contains public stop information, not a private home address.":
    "Näytä tämä kortti kuljettajalle tai luotettavalle aikuiselle. Kortissa on julkisen pysäkin tiedot, ei kotiosoitetta.",

  // The driver card's own controls (what the driver reads never changes)
  "Show this screen to the driver": "Näytä tämä kuljettajalle",
  "Read aloud in Finnish": "Lue ääneen suomeksi",
  Close: "Sulje",
};
