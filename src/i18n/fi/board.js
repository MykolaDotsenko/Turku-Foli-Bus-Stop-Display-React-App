// The departure board, its next stops, and the times and distances it shows.
export default {
  // Times (utils/time.js)
  Due: "Nyt",
  "column|Due": "Lähtee",
  "{minutes} min": "{minutes} min",
  Today: "Tänään",
  Tomorrow: "Huomenna",
  "on time": "ajallaan",
  "{minutes} min late": "{minutes} min myöhässä",
  "{minutes} min early": "{minutes} min etuajassa",
  Scheduled: "Aikataulu",
  Live: "Reaaliaika",
  "Live data · {minutes} min old": "Reaaliaikatieto · {minutes} min vanha",
  "Live data · 1 min old": "Reaaliaikatieto · 1 min vanha",
  "just now": "juuri nyt",
  "1 min ago": "1 min sitten",
  "{minutes} min ago": "{minutes} min sitten",

  // Where the bus is
  "Bus at stop · board now": "Bussi pysäkillä · nouse kyytiin",
  "Last bus position ≈{distance} from stop · {minutes} min old":
    "Bussin viimeisin sijainti ≈{distance} pysäkiltä · {minutes} min vanha",
  "Bus at or near stop": "Bussi pysäkillä tai sen lähellä",
  "Bus nearby · ≈{distance} from stop": "Bussi lähellä · ≈{distance} pysäkiltä",
  "Bus ≈{distance} from stop": "Bussi ≈{distance} pysäkiltä",
  "Waterbus at stop · board now": "Vesibussi laiturilla · nouse kyytiin",
  "Last waterbus position ≈{distance} from stop · {minutes} min old":
    "Vesibussin viimeisin sijainti ≈{distance} laiturilta · {minutes} min vanha",
  "Waterbus at or near stop": "Vesibussi laiturilla tai sen lähellä",
  "Waterbus nearby · ≈{distance} from stop":
    "Vesibussi lähellä · ≈{distance} laiturilta",
  "Waterbus ≈{distance} from stop": "Vesibussi ≈{distance} laiturilta",
  "Wheelchair accessible": "Esteetön",
  "Not wheelchair accessible": "Ei esteetön",

  // Board
  "Loading…": "Ladataan…",
  "Remove {name} from favourites": "Poista suosikeista: {name}",
  "Save {name} to favourites": "Lisää suosikkeihin: {name}",
  "Remove favourite": "Poista suosikki",
  "Save favourite": "Lisää suosikiksi",
  "Updated {time}": "Päivitetty klo {time}",
  "Refreshing…": "Päivitetään…",
  Refresh: "Päivitä",
  "Departure data summary": "Lähtötietojen yhteenveto",
  "{count} upcoming": "{count} tulossa",
  "Filter lines": "Suodata linjoja",
  "Only line {line}": "Vain linja {line}",
  "Only lines {lines}": "Vain linjat {lines}",
  "Show only these lines": "Näytä vain nämä linjat",
  "All lines": "Kaikki linjat",
  "No departures on line {line} right now.":
    "Linjalla {line} ei ole lähtöjä juuri nyt.",
  "No departures on lines {lines} right now.":
    "Linjoilla {lines} ei ole lähtöjä juuri nyt.",
  "Other lines are leaving from this stop.":
    "Tältä pysäkiltä lähtee muita linjoja.",
  "Show all lines": "Näytä kaikki linjat",
  realtime: ({ count }) => (count === 1 ? "reaaliaikainen" : "reaaliaikaista"),
  "{count} scheduled": ({ count }) =>
    count === 1 ? "1 aikataulun mukainen" : `${count} aikataulun mukaista`,
  "Live update failed": "Reaaliaikapäivitys epäonnistui",
  "Live data is getting old": "Reaaliaikatiedot eivät ole tuoreita",
  "last successful update {age}": "viimeisin onnistunut päivitys {age}",
  "Live updates are unavailable · showing scheduled Föli times.":
    "Reaaliaikatietoja ei ole saatavilla · näytetään Fölin aikataulun mukaiset ajat.",
  "No live departure is published right now · showing the next scheduled Föli times.":
    "Reaaliaikaisia lähtöjä ei juuri nyt julkaista · näytetään seuraavat aikataulun mukaiset ajat.",
  "Later departures could not be checked, so more buses may run after these.":
    "Myöhempiä lähtöjä ei voitu tarkistaa, joten näiden jälkeen voi kulkea muitakin busseja.",
  "Connecting to Föli": "Yhdistetään Föliin",
  "Loading departures…": "Ladataan lähtöjä…",
  "Couldn’t load departures.": "Lähtöjä ei voitu ladata.",
  "Check the stop number or connection and try again.":
    "Tarkista pysäkin numero tai yhteys ja yritä uudelleen.",
  "Try again": "Yritä uudelleen",
  "No live departures right now.": "Ei reaaliaikaisia lähtöjä juuri nyt.",
  "The timetable could not be checked just now, so later buses may still run.":
    "Aikataulua ei voitu juuri nyt tarkistaa, joten myöhempiä busseja voi vielä kulkea.",
  Updating: "Päivitetään",
  "Checking for the next departures…": "Tarkistetaan seuraavia lähtöjä…",
  "No upcoming departures.": "Ei tulevia lähtöjä.",
  "Try refreshing or choosing another nearby stop.":
    "Päivitä tai valitse toinen lähellä oleva pysäkki.",
  Line: "Linja",
  Destination: "Määränpää",
  "Unknown destination": "Tuntematon määränpää",
  "Cancelled at this stop · was due {time}":
    "Peruttu tällä pysäkillä · aikataulun mukaan klo {time}",
  "Ride Mode active": "Matkatila käytössä",
  "Close get-off setup": "Sulje hälytyksen asetukset",
  "Alert me when to get off": "Muistuta, kun pitää jäädä pois",
  Cancelled: "Peruttu",
  "About live estimates": "Tietoa reaaliaika-arvioista",
  "Live times are estimates from vehicle data. Vehicle distance is a straight-line estimate from the latest reported position. Scheduled means no current realtime feed is available for that trip.":
    "Reaaliaikaiset ajat ovat arvioita ajoneuvojen tiedoista. Ajoneuvon etäisyys on linnuntie-etäisyys viimeisimmästä ilmoitetusta sijainnista. Aikataulu tarkoittaa, ettei vuorolle ole juuri nyt reaaliaikaista tietoa.",

  // Next stops
  "Hide next stops": "Piilota seuraavat pysäkit",
  "Next stops": "Seuraavat pysäkit",
  "Next stops · timetable times": "Seuraavat pysäkit · aikataulun ajat",
  "Loading planned stops…": "Ladataan pysäkkejä…",
  "Next stops are temporarily unavailable.":
    "Seuraavat pysäkit eivät ole tilapäisesti saatavilla.",
  "No later stops are listed.": "Myöhempiä pysäkkejä ei ole listattu.",
  "around {time}": "noin klo {time}",
  planned: "suunniteltu",
  // Finnish timetables' own term for a stop where no one may get off.
  "no drop-off": "vain nousu",
  "+{count} more · final stop": "+{count} lisää · päätepysäkki",
};
