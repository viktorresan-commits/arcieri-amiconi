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
  return { id, label, src: src ?? `/sagome/${id}.png?v=5`, red, yellow, blue };
}

/** Bersaglio riassuntivo della gara: non è un animale da piazzola. */
export const SAGOME_3D = animal(
  "sagome-3d",
  "Sagome 3D",
  { cx: 0.5753, cy: 0.4795, rx: 0.0438, ry: 0.0567 },
  { cx: 0.5725, cy: 0.4791, rx: 0.1055, ry: 0.1346 },
  { cx: 0.5652, cy: 0.4828, rx: 0.1788, ry: 0.2293 },
  "/sagome-3d-v4.png",
);

export const ANIMALS: Animal[] = [
  animal("orso", "Orso", { cx: 0.4971, cy: 0.3393, rx: 0.0282, ry: 0.0472 }, { cx: 0.5113, cy: 0.3275, rx: 0.0615, ry: 0.1035 }, { cx: 0.5454, cy: 0.3342, rx: 0.1197, ry: 0.1512 }),
  animal("stambecco", "Stambecco", { cx: 0.5948, cy: 0.5537, rx: 0.0293, ry: 0.0279 }, { cx: 0.6077, cy: 0.5482, rx: 0.0792, ry: 0.071 }, { cx: 0.6404, cy: 0.5515, rx: 0.127, ry: 0.0934 }),
  animal("pantera-seduta", "Pantera seduta", { cx: 0.2704, cy: 0.5019, rx: 0.0374, ry: 0.0326 }, { cx: 0.2857, cy: 0.4973, rx: 0.086, ry: 0.0757 }, { cx: 0.3119, cy: 0.4988, rx: 0.1405, ry: 0.112 }),
  animal("volpe-sdraiata", "Volpe sdraiata", { cx: 0.4617, cy: 0.5695, rx: 0.03, ry: 0.0485 }, { cx: 0.4744, cy: 0.5593, rx: 0.0672, ry: 0.1115 }, { cx: 0.5037, cy: 0.553, rx: 0.1185, ry: 0.1617 }),
  animal("avvoltoio", "Avvoltoio", { cx: 0.5249, cy: 0.4418, rx: 0.0387, ry: 0.0401 }, { cx: 0.5392, cy: 0.4368, rx: 0.0854, ry: 0.0887 }, { cx: 0.5721, cy: 0.4469, rx: 0.1478, ry: 0.1286 }),
  animal("lince-seduta", "Lince seduta", { cx: 0.2614, cy: 0.5437, rx: 0.0383, ry: 0.0295 }, { cx: 0.2768, cy: 0.5388, rx: 0.0862, ry: 0.0688 }, { cx: 0.3129, cy: 0.5427, rx: 0.1522, ry: 0.1004 }),
  animal("capra-montes", "Capra montes", { cx: 0.5471, cy: 0.5284, rx: 0.034, ry: 0.0308 }, { cx: 0.5644, cy: 0.522, rx: 0.0746, ry: 0.0691 }, { cx: 0.6032, cy: 0.5252, rx: 0.1439, ry: 0.0993 }),
  animal("gufo", "Gufo", { cx: 0.3461, cy: 0.516, rx: 0.0493, ry: 0.0313 }, { cx: 0.3662, cy: 0.5116, rx: 0.1118, ry: 0.0734 }, { cx: 0.396, cy: 0.5161, rx: 0.1783, ry: 0.1102 }),
  animal("pecora-sdraiata", "Pecora sdraiata", { cx: 0.5254, cy: 0.5306, rx: 0.0322, ry: 0.0554 }, { cx: 0.5385, cy: 0.524, rx: 0.0742, ry: 0.1258 }, { cx: 0.5724, cy: 0.528, rx: 0.1348, ry: 0.1802 }),
  animal("lince-piedi", "Lince in piedi", { cx: 0.5686, cy: 0.4135, rx: 0.0304, ry: 0.035 }, { cx: 0.5841, cy: 0.408, rx: 0.0718, ry: 0.078 }, { cx: 0.6166, cy: 0.4111, rx: 0.1305, ry: 0.1128 }),
  animal("multiplo", "Multiplo animale", { cx: 0.5227, cy: 0.5597, rx: 0.0269, ry: 0.0281 }, { cx: 0.5341, cy: 0.5563, rx: 0.0619, ry: 0.0653 }, { cx: 0.5639, cy: 0.5583, rx: 0.1147, ry: 0.0938 }),
  animal("capriolo", "Capriolo allerta", { cx: 0.4484, cy: 0.5176, rx: 0.0332, ry: 0.0272 }, { cx: 0.4653, cy: 0.5122, rx: 0.0767, ry: 0.0619 }, { cx: 0.5043, cy: 0.5145, rx: 0.1433, ry: 0.0889 }),
  animal("giavellina", "Giavellina", { cx: 0.5669, cy: 0.3584, rx: 0.0316, ry: 0.0466 }, { cx: 0.5818, cy: 0.3501, rx: 0.0734, ry: 0.1056 }, { cx: 0.6154, cy: 0.3557, rx: 0.1339, ry: 0.1515 }),
  animal("cinghiale-solengo", "Cinghiale solengo", { cx: 0.5719, cy: 0.3688, rx: 0.0302, ry: 0.0423 }, { cx: 0.5852, cy: 0.363, rx: 0.0692, ry: 0.0979 }, { cx: 0.6149, cy: 0.3688, rx: 0.124, ry: 0.1437 }),
  animal("gallo-cedrone", "Gallo cedrone", { cx: 0.4027, cy: 0.5393, rx: 0.0381, ry: 0.0391 }, { cx: 0.4198, cy: 0.5323, rx: 0.0857, ry: 0.0895 }, { cx: 0.4599, cy: 0.536, rx: 0.1583, ry: 0.1278 }),
  animal("puma", "Puma", { cx: 0.5533, cy: 0.3437, rx: 0.0278, ry: 0.0451 }, { cx: 0.5672, cy: 0.3347, rx: 0.0634, ry: 0.1027 }, { cx: 0.591, cy: 0.3401, rx: 0.1101, ry: 0.147 }),
  animal("cucciolo-orso", "Cucciolo Orso", { cx: 0.5549, cy: 0.4058, rx: 0.0398, ry: 0.045 }, { cx: 0.5739, cy: 0.3983, rx: 0.0905, ry: 0.1009 }, { cx: 0.6137, cy: 0.4024, rx: 0.163, ry: 0.1458 }),
  animal("castoro", "Castoro", { cx: 0.4658, cy: 0.3866, rx: 0.0297, ry: 0.0472 }, { cx: 0.4808, cy: 0.3843, rx: 0.0685, ry: 0.1052 }, { cx: 0.5105, cy: 0.4038, rx: 0.1219, ry: 0.1574 }),
  animal("gatto-selvatico", "Gatto selvatico", { cx: 0.4521, cy: 0.435, rx: 0.0314, ry: 0.0419 }, { cx: 0.4649, cy: 0.4294, rx: 0.0704, ry: 0.0946 }, { cx: 0.4983, cy: 0.4283, rx: 0.129, ry: 0.1356 }),
  animal("sciacallo", "Sciacallo", { cx: 0.4663, cy: 0.4647, rx: 0.029, ry: 0.0361 }, { cx: 0.4799, cy: 0.4575, rx: 0.0667, ry: 0.0817 }, { cx: 0.5116, cy: 0.4594, rx: 0.1239, ry: 0.1168 }),
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
