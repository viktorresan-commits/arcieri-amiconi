/** Ambientazioni della Home e del profilo: nome, colori del prato e un colore di riferimento per la foto profilo. */
export type SceneId =
  | "fabriano"
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
  | "autunno"
  | "cascata"
  | "porto"
  | "giardino"
  | "mulino"
  | "palestra"
  | "palazzetto"
  | "capannone"
  | "salone"
  // del Fondatore
  | "trono"
  | "drago"
  | "cielo"
  // del Demone di Montelago (solo per chi ha il costume)
  | "montelago";

export const SCENES: { id: SceneId; label: string; ground: [string, string]; tone: string; indoor?: boolean; /** cielo e luce propri, uguali a ogni ora */ ownSky?: boolean }[] = [
  { id: "fabriano", label: "Piazza del Comune, Fabriano", ground: ["#86827b", "#5f5c57"], tone: "#a8402f" },
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
  { id: "cascata", label: "Cascata nella valle", ground: ["#5d8a45", "#4c7639"], tone: "#2f7a8a" },
  { id: "porto", label: "Porto al tramonto", ground: ["#8a7a62", "#74664f"], tone: "#2f5a8a" },
  { id: "giardino", label: "Giardino dei ciliegi", ground: ["#7aa05a", "#6a904c"], tone: "#c4607a" },
  { id: "mulino", label: "Prateria del mulino", ground: ["#8aaa4a", "#7a9a3e"], tone: "#c9a227" },
  // al chiuso: niente cielo né vento
  { id: "palestra", label: "Palestra (al chiuso)", ground: ["#b98a55", "#a0723f"], tone: "#6a7a8a", indoor: true },
  { id: "palazzetto", label: "Palazzetto federale (al chiuso)", ground: ["#2f5f8a", "#264e72"], tone: "#2a4a7a", indoor: true },
  { id: "capannone", label: "Fienile del club (al chiuso)", ground: ["#8a6a42", "#74583a"], tone: "#7a5a3a", indoor: true },
  { id: "salone", label: "Sala d'armi del castello (al chiuso)", ground: ["#6a4a30", "#583c26"], tone: "#5a4a3a", indoor: true },
  // nate per i completi del Fondatore, ma di tutti
  { id: "trono", label: "Sala del Trono", ground: ["#3a2c34", "#140d12"], tone: "#8a1424", indoor: true, ownSky: true },
  { id: "drago", label: "Picco del Drago", ground: ["#1a0e0e", "#0a0606"], tone: "#9a2a0c", ownSky: true },
  { id: "cielo", label: "Cittadella Celeste", ground: ["#f4ecdc", "#c9b89a"], tone: "#5a3c86", ownSky: true },
  { id: "montelago", label: "L'Arpa di Montelago, di notte", ground: ["#2a2418", "#141008"], tone: "#8a2a14", ownSky: true },
];

export const isIndoor = (id: string | undefined) => Boolean(sceneById(id).indoor);

export const sceneById = (id: string | undefined) => SCENES.find((s) => s.id === id) ?? SCENES[0];

export const FACE_BGS = ["", "#1f3a5f", "#2f6f62", "#5b2b6e", "#8a2f2f", "#c7a03a", "#3a3a3a", "#e9e4d8", "#2a5d8a", "#c46b2b", "#4b6b2e", "#ff5fa2", "#14213d", "#0f5257", "#6d597a", "#b56576", "#e56b6f", "#355070", "#bc6c25", "#7d8f69", "#2b2d42", "#06d6a0", "#118ab2", "#ffd166"];
