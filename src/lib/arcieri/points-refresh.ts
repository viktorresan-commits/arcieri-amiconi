import { refreshLevels } from "./levels";
import { refreshActivity } from "./xp";

/**
 * Dopo un'importazione dal portale FITAST (o un salvataggio che conta): si richiedono al server i punti
 * dell'avatar e i livelli di tutti, così crescono subito con le gare e i podi arrivati.
 */
export function pointsChanged() {
  refreshLevels();
  refreshActivity();
}
