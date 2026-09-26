import { realStopName, stopLabel } from "../utils/stopNames";

// A stop's name as Föli publishes it, marked Finnish, so a screen reader in
// either language says "Kauppatori" as it is written. A stop with no name
// yet is called by its number, in the language on screen.
export default function StopName({ stop, id = stop?.id }) {
  const name = realStopName(stop?.name);
  return name ? <span lang="fi">{name}</span> : stopLabel(stop, id);
}
