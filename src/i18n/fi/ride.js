// Ride Mode: the get-off alert, its setup, and what it says, shows and sends
// during the ride. Shared phrases ("Stop {id}", "{minutes} min", "Line",
// "around {time}", "Ride Mode active") are translated in board.js and app.js.
export default {
  // The stage, from boarding to the stop
  "No need to watch for your stop": "Pysäkkiäsi ei tarvitse vahtia",
  "We will warn you as your stop gets closer.":
    "Varoitamme, kun pysäkkisi lähestyy.",
  "Get ready": "Valmistaudu",
  "Your stop is coming up": "Pysäkkisi lähestyy",
  "Gather your things and get ready to move toward the doors.":
    "Kerää tavarasi ja valmistaudu siirtymään ovelle.",
  "Next stop": "Seuraava pysäkki",
  "Your stop is next": "Pysäkkisi on seuraavana",
  "Press the STOP button now.": "Paina STOP-nappia nyt.",
  "This is your stop": "Tämä on pysäkkisi",
  "Get off now": "Jää pois nyt",
  "Move to the doors and step off here.": "Siirry ovelle ja jää pois tässä.",
  Recovery: "Paluuohjeet",
  "Your stop may be behind you": "Pysäkkisi saattoi jäädä taakse",
  "Get off at the next stop and use the recovery action below.":
    "Jää pois seuraavalla pysäkillä ja avaa sen lähdöt alta.",
  "Get ready to exit at the next stop.":
    "Valmistaudu jäämään pois seuraavalla pysäkillä.",

  // Estimate and stops left. "1 stop" and "{count} stops" (2 or more) take
  // the Finnish singular and partitive forms as they stand.
  now: "nyt",
  "running late": "myöhässä",
  "about now": "ihan kohta",
  "you are here": "olet perillä",
  "behind you": "jäi taakse",
  "almost there": "melkein perillä",
  "1 stop": "1 pysäkki",
  "{count} stops": "{count} pysäkkiä",
  Remaining: "Jäljellä",
  Estimate: "Arvio",
  tracking: "seurataan",
  "Ride progress": "Matkan eteneminen",

  // What the live data shows
  "Following your bus": "Seurataan bussiasi",
  "Live tracking is catching up": "Reaaliaikatieto viivästyy",
  "Going by the timetable": "Aikataulun mukaan",
  "Your bus is confirmed": "Bussisi on vahvistettu",
  "in Föli’s live arrival data": "Fölin reaaliaikatiedoista",
  "on its way to {name}": "matkalla pysäkille {name}",
  "Waiting for a live update": "Odotetaan reaaliaikapäivitystä",
  "last seen in Föli’s live data about a minute ago":
    "nähty viimeksi Fölin reaaliaikatiedoissa noin minuutti sitten",
  "Looking for your bus": "Etsitään bussiasi",

  // Where the phone is
  "last seen {minutes} min ago": "viimeisin sijainti {minutes} min sitten",
  "last seen over a minute ago": "viimeisin sijainti yli minuutti sitten",
  "using arrival data only": "käytetään vain saapumistietoja",
  "about {meters} m past your stop": "noin {meters} m pysäkkisi jälkeen",
  "about {meters} m to go": "noin {meters} m jäljellä",
  "roughly {meters} m away": "suunnilleen {meters} m päässä",
  "waiting for a location": "odotetaan sijaintia",
  "Not using your location": "Sijaintiasi ei käytetä",
  "Lost track of your location": "Sijaintisi seuranta katkesi",
  "You may not be on this route": "Et ehkä ole tällä reitillä",
  "Following you along the route": "Seurataan sinua reittiä pitkin",
  "Following you, roughly": "Seurataan sijaintiasi likimääräisesti",
  "Weak location signal": "Heikko sijaintisignaali",
  "Finding your location": "Haetaan sijaintiasi",
  "Cannot use your location": "Sijaintiasi ei voi käyttää",
  "This phone cannot share location": "Tämä puhelin ei voi jakaa sijaintia",
  "Waiting for your location": "Odotetaan sijaintiasi",
  "Location backup is unavailable on this device.":
    "Sijainnin seuranta ei ole käytettävissä tällä laitteella.",
  "Location backup was not allowed.": "Sijainnin käyttöä ei sallittu.",
  "Location backup is temporarily unavailable.":
    "Sijainnin seuranta ei ole tilapäisesti käytettävissä.",
  "Ride tracking continues without device location.":
    "Matkan seuranta jatkuu ilman laitteen sijaintia.",

  // The panel
  "Your stop": "Pysäkkisi",
  "after {name}": "pysäkin {name} jälkeen",
  "Alert sound check": "Hälytysäänen tarkistus",
  "Did you hear the test alert?": "Kuulitko testihälytyksen?",
  Yes: "Kyllä",
  No: "Ei",
  "Let's get the sound working": "Laitetaan ääni toimimaan",
  "Turn the media volume up.": "Nosta median äänenvoimakkuutta.",
  "Switch off silent or focus mode.":
    "Poista äänetön tila tai keskittymistila käytöstä.",
  "Check the sound is not going to other headphones.":
    "Tarkista, ettei ääni mene muihin kuulokkeisiin.",
  "Play it again": "Toista uudelleen",
  "I can hear it now": "Nyt kuuluu",
  "Tracking is already running. Your phone will also vibrate and show a notification.":
    "Seuranta on jo käynnissä. Puhelimesi myös värisee ja näyttää ilmoituksen.",
  "Next planned stop: {name}": "Seuraava pysäkki reitillä: {name}",
  "Open next stop": "Avaa seuraava pysäkki",
  "I'm getting off": "Jään pois",
  "Test alert": "Testaa hälytys",
  "End ride": "Lopeta matka",
  "Keeping your screen on": "Näyttö pidetään päällä",
  "Cannot keep your screen on": "Näyttöä ei voi pitää päällä",
  "Your screen may switch off": "Näyttö voi sammua",
  "Most reliable while this page stays open and visible":
    "Luotettavin, kun tämä sivu pysyy auki ja näkyvissä",
  "We cannot see your bus in the live data right now, so we are going by the timetable. You will still get the early warnings, but we will not say “get off now” on the timetable alone.":
    "Emme näe bussiasi reaaliaikatiedoissa juuri nyt, joten seuraamme aikataulua. Saat silti ennakkovaroitukset, mutta pelkän aikataulun perusteella emme sano ”jää pois nyt”.",
  "Check your bus": "Tarkista bussisi",
  "For two minutes you have not been moving along line {line} to {destination}. Are you still on this bus?":
    "Et ole kahteen minuuttiin liikkunut linjan {line} reittiä suuntaan {destination}. Oletko yhä tässä bussissa?",
  "For two minutes you have not been moving along line {line}. Are you still on this bus?":
    "Et ole kahteen minuuttiin liikkunut linjan {line} reittiä pitkin. Oletko yhä tässä bussissa?",
  "For two minutes you have not been moving along this route to {destination}. Are you still on this bus?":
    "Et ole kahteen minuuttiin liikkunut tätä reittiä suuntaan {destination}. Oletko yhä tässä bussissa?",
  "For two minutes you have not been moving along this route. Are you still on this bus?":
    "Et ole kahteen minuuttiin liikkunut tätä reittiä pitkin. Oletko yhä tässä bussissa?",
  "Yes, keep tracking": "Kyllä, jatka seurantaa",
  "We could not load this route's path, so we are following your distance to the stop instead. Live arrival data still applies.":
    "Emme saaneet ladattua tämän reitin kulkua, joten seuraamme sen sijaan etäisyyttäsi pysäkille. Reaaliaikaiset saapumistiedot ovat yhä käytössä.",
  "Ride Mode is travel help, not a guaranteed alarm. A browser can pause a page it thinks you have left, so keep this screen open with the sound on.":
    "Matkatila auttaa matkalla, mutta se ei ole taattu hälytys. Selain voi keskeyttää sivun, jolta se luulee sinun poistuneen, joten pidä tämä sivu auki ja ääni päällä.",

  // Setup
  "Set up get-off alerts": "Aseta poistumishälytys",
  "Ride Mode": "Matkatila",
  "Where do you want to get off?": "Missä haluat jäädä pois?",
  "Pick your stop, then keep this page open with the sound on. You do not have to watch it: we tell you when to get ready, when to press STOP, and when to step off.":
    "Valitse pysäkkisi ja pidä tämä sivu auki ääni päällä. Sivua ei tarvitse katsoa: kerromme, milloin valmistautua, milloin painaa STOP-nappia ja milloin jäädä pois.",
  Cancel: "Peruuta",
  "Loading this trip's planned stops…": "Ladataan tämän vuoron pysäkkejä…",
  "This trip's stop sequence is temporarily unavailable. Ride Mode cannot start safely without it.":
    "Tämän vuoron pysäkkijärjestys ei ole tilapäisesti saatavilla. Matkatilaa ei voi käynnistää turvallisesti ilman sitä.",
  "This bus comes back to this stop later on its route, and we cannot tell which pass you are boarding. We will not guess about your stop.":
    "Tämä bussi palaa tälle pysäkille myöhemmin reitillään, emmekä voi tietää, millä kerralla nouset kyytiin. Emme arvaile pysäkkiäsi.",
  "No later drop-off stops are available for this trip.":
    "Tällä vuorolla ei ole myöhempiä pysäkkejä, joilla voi jäädä pois.",
  "Choose your exit stop": "Valitse pysäkki, jolla jäät pois",
  "{count} stops away": "{count} pysäkin päässä",
  "Follow my location (recommended)": "Seuraa sijaintiani (suositeltu)",
  "Alerts you by where you actually are, not only by where the timetable expects the bus to be. Your location stays on this phone and is forgotten when the ride ends.":
    "Hälyttää sen mukaan, missä oikeasti olet, eikä vain sen mukaan, missä bussin pitäisi aikataulun mukaan olla. Sijaintisi pysyy tässä puhelimessa, ja se unohdetaan, kun matka päättyy.",
  "Also show notifications": "Näytä myös ilmoitukset",
  "Only while this page stays open: a browser can pause a page it thinks you have left, and a locked phone often does.":
    "Vain niin kauan kuin tämä sivu pysyy auki: selain voi keskeyttää sivun, jolta se luulee sinun poistuneen, ja lukitussa puhelimessa niin käy usein.",
  "On iPhone, notifications need this app on your Home Screen (Share, then Add to Home Screen). Sound and vibration work here as long as this page stays open.":
    "iPhonessa ilmoitukset vaativat, että sovellus on lisätty Koti-valikkoon (Jaa ja sitten Lisää Koti-valikkoon). Ääni ja värinä toimivat täällä niin kauan kuin tämä sivu pysyy auki.",
  "Before you rely on it": "Ennen kuin luotat siihen",
  "Starting plays a test alert, so you can check your sound and vibration now rather than when it matters. If live tracking drops out you still get the early warnings, and we only say “get off now” when live bus data or your location confirms it.":
    "Käynnistys soittaa testihälytyksen, joten voit tarkistaa äänen ja värinän nyt eikä vasta silloin, kun sillä on väliä. Jos reaaliaikaseuranta katkeaa, saat silti ennakkovaroitukset, ja sanomme ”jää pois nyt” vain, kun bussin reaaliaikatieto tai sijaintisi vahvistaa sen.",
  "Choose the stop you want to get off at before starting Ride Mode.":
    "Valitse pysäkki, jolla jäät pois, ennen kuin käynnistät matkatilan.",
  "We do not have a departure time for this bus yet. Wait for the board to refresh and try again.":
    "Tälle bussille ei ole vielä lähtöaikaa. Odota, että lähtötaulu päivittyy, ja yritä uudelleen.",
  "We cannot work out a reliable plan for that stop on this trip. Try another stop, or start the ride from a different departure.":
    "Emme pysty laatimaan luotettavaa suunnitelmaa tälle pysäkille tällä vuorolla. Kokeile toista pysäkkiä tai aloita matka toisesta lähdöstä.",
  "Start Ride Mode": "Käynnistä matkatila",
  "Get off at {name}": "Jää pois: {name}",
  "Line {line} leaves {time}": "Linja {line} lähtee klo {time}",
  "Line {line}": "Linja {line}",
  "This trip leaves {time}": "Tämä vuoro lähtee klo {time}",
  "This trip": "Tämä vuoro",

  // Spoken. The stop name is read on its own, by the Finnish voice. The
  // spoken instruction keeps the stop button in lower case, as the English
  // one does.
  "your stop": "pysäkkisi",
  "Ride alerts are working.": "Matkatilan hälytykset toimivat.",
  "Get ready. Your stop is coming up.": "Valmistaudu. Pysäkkisi lähestyy.",
  "The next stop is yours.": "Pysäkkisi on seuraavana.",
  "Press the stop button now.": "Paina stop-nappia nyt.",
  "This is your stop.": "Tämä on pysäkkisi.",
  "Get off now.": "Jää pois nyt.",
  "It looks like your stop is behind you. Get off at the next stop.":
    "Näyttää siltä, että pysäkkisi jäi taakse. Jää pois seuraavalla pysäkillä.",

  // Notifications
  "{name} is coming up soon.": "{name} lähestyy pian.",
  "Next stop: {name}": "Seuraava pysäkki: {name}",
  "This is your stop: {name}": "Tämä on pysäkkisi: {name}",
  "Get off at the next stop and use recovery help.":
    "Jää pois seuraavalla pysäkillä ja katso sovelluksesta, miten pääset takaisin.",
  "Ride alerts are working": "Matkatilan hälytykset toimivat",
};
