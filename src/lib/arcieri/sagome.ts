export type Zone = { cx: number; cy: number; rx: number; ry: number };

export type Animal = {
  id: string;
  label: string;
  src: string;
  red: Zone;
  yellow: Zone;
  blue: Zone;
};

function animal(id: string, label: string, red: Zone, yellow: Zone, blue: Zone, src?: string): Animal {
  return { id, label, src: src ?? `/sagome/${id}.png?v=4`, red, yellow, blue };
}

/** Bersaglio riassuntivo della gara: non è un animale da piazzola. */
export const SAGOME_3D = animal(
  "sagome-3d",
  "Sagome 3D",
  { cx: 0.5753, cy: 0.4795, rx: 0.0438, ry: 0.0567 },
  { cx: 0.5725, cy: 0.4791, rx: 0.1055, ry: 0.1346 },
  { cx: 0.5652, cy: 0.4828, rx: 0.1788, ry: 0.2293 },
  "/sagome-3d-v2.png",
);

export const ANIMALS: Animal[] = [
  animal("orso", "Orso", { cx: 0.4976, cy: 0.3188, rx: 0.0259, ry: 0.0399 }, { cx: 0.5118, cy: 0.3062, rx: 0.059, ry: 0.0888 }, { cx: 0.546, cy: 0.3098, rx: 0.1144, ry: 0.1286 }),
  animal("stambecco", "Stambecco", { cx: 0.5914, cy: 0.5337, rx: 0.0259, ry: 0.0245 }, { cx: 0.6052, cy: 0.5291, rx: 0.0638, ry: 0.0567 }, { cx: 0.6362, cy: 0.5307, rx: 0.1155, ry: 0.0798 }),
  animal("pantera-seduta", "Pantera seduta", { cx: 0.2795, cy: 0.5016, rx: 0.0354, ry: 0.031 }, { cx: 0.2933, cy: 0.4967, rx: 0.0807, ry: 0.0719 }, { cx: 0.3189, cy: 0.4984, rx: 0.1299, ry: 0.1029 }),
  animal("volpe-sdraiata", "Volpe sdraiata", { cx: 0.4617, cy: 0.5684, rx: 0.028, ry: 0.0448 }, { cx: 0.4735, cy: 0.5566, rx: 0.0634, ry: 0.1038 }, { cx: 0.5059, cy: 0.5519, rx: 0.1136, ry: 0.1462 }),
  animal("avvoltoio", "Avvoltoio", { cx: 0.5224, cy: 0.4458, rx: 0.0362, ry: 0.0367 }, { cx: 0.5362, cy: 0.4406, rx: 0.081, ry: 0.0839 }, { cx: 0.569, cy: 0.4476, rx: 0.1379, ry: 0.1189 }),
  animal("lince-seduta", "Lince seduta", { cx: 0.2721, cy: 0.4758, rx: 0.0332, ry: 0.0242 }, { cx: 0.2876, cy: 0.471, rx: 0.0796, ry: 0.0613 }, { cx: 0.3296, cy: 0.4726, rx: 0.1482, ry: 0.0887 }),
  animal("capra-montes", "Capra montes", { cx: 0.545, cy: 0.4919, rx: 0.0294, ry: 0.0274 }, { cx: 0.5623, cy: 0.4855, rx: 0.0675, ry: 0.0661 }, { cx: 0.6021, cy: 0.4855, rx: 0.1349, ry: 0.0919 }),
  animal("gufo", "Gufo", { cx: 0.3528, cy: 0.5137, rx: 0.0417, ry: 0.0274 }, { cx: 0.3722, cy: 0.5103, rx: 0.1, ry: 0.0685 }, { cx: 0.4, cy: 0.5103, rx: 0.1667, ry: 0.0993 }),
  animal("pecora-sdraiata", "Pecora sdraiata", { cx: 0.5234, cy: 0.5308, rx: 0.0292, ry: 0.0521 }, { cx: 0.5351, cy: 0.5237, rx: 0.0702, ry: 0.1161 }, { cx: 0.5702, cy: 0.5237, rx: 0.1287, ry: 0.1635 }),
  animal("lince-piedi", "Lince in piedi", { cx: 0.5664, cy: 0.4199, rx: 0.0282, ry: 0.032 }, { cx: 0.5814, cy: 0.4128, rx: 0.0664, ry: 0.0712 }, { cx: 0.6163, cy: 0.4164, rx: 0.1213, ry: 0.1032 }),
  animal("multiplo", "Multiplo animale", { cx: 0.5218, cy: 0.5482, rx: 0.0234, ry: 0.0268 }, { cx: 0.5343, cy: 0.5429, rx: 0.0576, ry: 0.0679 }, { cx: 0.5639, cy: 0.5446, rx: 0.1059, ry: 0.0946 }),
  animal("capriolo", "Capriolo allerta", { cx: 0.3612, cy: 0.4946, rx: 0.0237, ry: 0.0268 }, { cx: 0.3754, cy: 0.4893, rx: 0.0568, ry: 0.0643 }, { cx: 0.4069, cy: 0.4893, rx: 0.1073, ry: 0.0893 }),
  animal("giavellina", "Giavellina", { cx: 0.4292, cy: 0.3648, rx: 0.0259, ry: 0.0429 }, { cx: 0.4441, cy: 0.3562, rx: 0.0599, ry: 0.0987 }, { cx: 0.4728, cy: 0.3605, rx: 0.1104, ry: 0.1373 }),
  animal("cinghiale-solengo", "Cinghiale solengo", { cx: 0.5271, cy: 0.3721, rx: 0.0303, ry: 0.0388 }, { cx: 0.5398, cy: 0.3663, rx: 0.0717, ry: 0.0911 }, { cx: 0.5748, cy: 0.3721, rx: 0.129, ry: 0.1318 }),
  animal("gallo-cedrone", "Gallo cedrone", { cx: 0.4069, cy: 0.5353, rx: 0.0347, ry: 0.0372 }, { cx: 0.4234, cy: 0.5297, rx: 0.0803, ry: 0.0836 }, { cx: 0.4635, cy: 0.5297, rx: 0.146, ry: 0.1171 }),
  animal("puma", "Puma", { cx: 0.5517, cy: 0.3498, rx: 0.0265, ry: 0.0412 }, { cx: 0.5663, cy: 0.3416, rx: 0.0597, ry: 0.0947 }, { cx: 0.5889, cy: 0.3457, rx: 0.1034, ry: 0.1358 }),
  animal("cucciolo-orso", "Cucciolo Orso", { cx: 0.4332, cy: 0.4091, rx: 0.0295, ry: 0.0411 }, { cx: 0.4472, cy: 0.4026, rx: 0.0652, ry: 0.0952 }, { cx: 0.4783, cy: 0.4048, rx: 0.118, ry: 0.132 }),
  animal("castoro", "Castoro", { cx: 0.4427, cy: 0.3933, rx: 0.0287, ry: 0.0422 }, { cx: 0.4586, cy: 0.3911, rx: 0.0669, ry: 0.0978 }, { cx: 0.4889, cy: 0.4044, rx: 0.1194, ry: 0.1422 }),
  animal("gatto-selvatico", "Gatto selvatico", { cx: 0.4534, cy: 0.4398, rx: 0.028, ry: 0.0382 }, { cx: 0.4658, cy: 0.4337, rx: 0.0652, ry: 0.0884 }, { cx: 0.5, cy: 0.4317, rx: 0.1211, ry: 0.1265 }),
  animal("sciacallo", "Sciacallo", { cx: 0.4661, cy: 0.4583, rx: 0.0265, ry: 0.0344 }, { cx: 0.4808, cy: 0.4493, rx: 0.0619, ry: 0.0761 }, { cx: 0.5147, cy: 0.4493, rx: 0.1165, ry: 0.1087 }),
];

const ALIAS: Record<string, string> = {
  pantera: "pantera-seduta",
  volpe: "volpe-sdraiata",
  lince: "lince-piedi",
  "cinghiale solengo": "cinghiale-solengo",
  "cucciolo orso": "cucciolo-orso",
};

export function animalByLabel(label: string | undefined | null): Animal {
  const key = (label ?? "").trim().toLowerCase();
  if (key === "sagome-3d" || key === "sagome 3d") return SAGOME_3D;
  const direct = ANIMALS.find((item) => item.id === key || item.label.toLowerCase() === key);
  if (direct) return direct;
  const alias = ALIAS[key];
  if (alias) return ANIMALS.find((item) => item.id === alias) ?? SAGOME_3D;
  return SAGOME_3D;
}
