/** Ambientazioni della Home e del profilo: nome, colori del prato e un colore di riferimento per la foto profilo. */
export type SceneId =
  | "campo"
  | "foresta"
  | "castello"
  | "palazzo"
  | "montagna"
  | "lago"
  | "deserto"
  | "villaggio"
  | "neve"
  | "campagna"
  | "torneo"
  | "rovine"
  | "spiaggia"
  | "autunno";

export const SCENES: { id: SceneId; label: string; ground: [string, string]; tone: string }[] = [
  { id: "campo", label: "Campo di tiro", ground: ["#5d8a45", "#4c7639"], tone: "#3f6a3a" },
  { id: "foresta", label: "Foresta", ground: ["#3f6a32", "#33592a"], tone: "#24452a" },
  { id: "castello", label: "Castello", ground: ["#5f7d42", "#4e6a36"], tone: "#5a5f6a" },
  { id: "palazzo", label: "Palazzo reale", ground: ["#6a9a4a", "#58853c"], tone: "#8a6a3a" },
  { id: "montagna", label: "Montagna", ground: ["#6a8a4a", "#58773d"], tone: "#4a6a8a" },
  { id: "lago", label: "Lago", ground: ["#5d8a45", "#4c7639"], tone: "#2f6a8a" },
  { id: "deserto", label: "Deserto", ground: ["#d9b47a", "#c9a066"], tone: "#c08a4a" },
  { id: "villaggio", label: "Villaggio medievale", ground: ["#6a8a44", "#5a7838"], tone: "#8a5a3a" },
  { id: "neve", label: "Bosco innevato", ground: ["#e9eef3", "#d6dee6"], tone: "#6a8aa8" },
  { id: "campagna", label: "Colline e vigne", ground: ["#7a9a4a", "#6a8a3e"], tone: "#9a8a3a" },
  { id: "torneo", label: "Torneo", ground: ["#6a9045", "#5a7c3a"], tone: "#a03a3a" },
  { id: "rovine", label: "Rovine antiche", ground: ["#8a9a5a", "#7a8a4c"], tone: "#a89a7a" },
  { id: "spiaggia", label: "Spiaggia", ground: ["#e6cf9a", "#d9bf86"], tone: "#2f8aa8" },
  { id: "autunno", label: "Bosco d'autunno", ground: ["#8a7a3a", "#7a6a30"], tone: "#b0602a" },
];

export const sceneById = (id: string | undefined) => SCENES.find((s) => s.id === id) ?? SCENES[0];

export const FACE_BGS = ["", "#1f3a5f", "#2f6f62", "#5b2b6e", "#8a2f2f", "#c7a03a", "#3a3a3a", "#e9e4d8", "#2a5d8a", "#c46b2b", "#4b6b2e", "#ff5fa2"];
