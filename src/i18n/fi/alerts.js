// Service updates: Föli's notices, their labels and the panel around them.
// The notices' own text comes from Föli in the chosen language where Föli
// has it.
export default {
  // What Föli's effect codes mean
  "No service": "Ei liikennettä",
  "Reduced service": "Vähennetty liikenne",
  "Significant delays": "Merkittäviä viivästyksiä",
  Detour: "Poikkeusreitti",
  "Additional service": "Lisävuoroja",
  "Modified service": "Muutettu liikenne",
  "Stop moved": "Pysäkki siirretty",
  "Service update": "Liikennetiedote",
  "Föli service notice": "Fölin tiedote",
  "Emergency service notice": "Liikenteen hätätiedote",
  "Cancelled departure": "Peruttu lähtö",

  // Causes
  "Unknown cause": "Tuntematon syy",
  "Other cause": "Muu syy",
  "Technical problem": "Tekninen vika",
  Strike: "Lakko",
  Demonstration: "Mielenosoitus",
  Accident: "Onnettomuus",
  Holiday: "Juhlapyhä",
  Weather: "Sää",
  Maintenance: "Huolto",
  "Construction work": "Rakennustyöt",
  "Police activity": "Poliisin toiminta",
  "Medical emergency": "Sairaskohtaus",

  // The panel
  "Valid until {date}, {time}": "Voimassa {date} klo {time} asti",
  "Line {line}": "Linja {line}",
  "Lines {lines}": "Linjat {lines}",
  "A departure": "Lähtö",
  "All Föli services": "Kaikki Fölin palvelut",
  "Open image for {title}": "Avaa kuva: {title}",
  "{title} illustration": "Kuva: {title}",
  "Open full image": "Avaa koko kuva",
  "Before you go": "Ennen lähtöä",
  "Service update check unavailable":
    "Liikennetiedotteiden tarkistus ei käytettävissä",
  "Föli disruption data could not be confirmed":
    "Fölin häiriötietoja ei voitu vahvistaa",
  "last checked {age}": "tarkistettu {age}",
  "Live departure data may still work separately.":
    "Reaaliaikaiset lähtötiedot voivat silti toimia erikseen.",
  "Important now": "Tärkeää nyt",
  "Emergency notice": "Hätätiedote",
  "Service updates": "Liikennetiedotteet",
  "1 service update": "1 liikennetiedote",
  "{count} service updates": ({ count }) => `${count} liikennetiedotetta`,
  "Update check failed": "Tarkistus epäonnistui",
  "Service update check is getting old": "Liikennetiedotteiden tarkistus vanhenee",
  "Show fewer updates": "Näytä vähemmän",
  "Show 1 more update": "Näytä 1 tiedote lisää",
  "Show {count} more updates": ({ count }) => `Näytä ${count} tiedotetta lisää`,
};
