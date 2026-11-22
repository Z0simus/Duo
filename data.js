// Inhalte der App: Übungen, Workouts, Challenges, Rezepte, Abzeichen.
// Alles hier kann frei erweitert werden.

// unit: 'reps' = Wiederholungen, 'sec' = Sekunden, 'min' = Minuten, 'steps' = Schritte
export const EXERCISES = {
  squats:   { name: 'Kniebeugen', emoji: '🦵', unit: 'reps', base: 10,
    how: 'Füße schulterbreit, Po nach hinten schieben wie beim Hinsetzen, Brust bleibt oben, Knie zeigen in Richtung Zehen.',
    easier: 'Nur halb so tief gehen oder dich auf einen Stuhl setzen und wieder aufstehen.' },
  pushups:  { name: 'Liegestütze', emoji: '💪', unit: 'reps', base: 6,
    how: 'Hände etwas breiter als die Schultern, Körper bildet eine gerade Linie, Brust Richtung Boden senken.',
    easier: 'Auf den Knien oder mit den Händen an einer Wand / Tischkante.' },
  plank:    { name: 'Plank (Unterarmstütz)', emoji: '🧱', unit: 'sec', base: 20,
    how: 'Auf Unterarmen und Zehen, Bauch und Po anspannen, kein Hohlkreuz.',
    easier: 'Knie auf dem Boden ablegen.' },
  lunges:   { name: 'Ausfallschritte', emoji: '🚶', unit: 'reps', base: 8,
    how: 'Großer Schritt nach vorne, hinteres Knie Richtung Boden senken, zurückdrücken. Seiten abwechseln.',
    easier: 'Kleinere Schritte und an einer Wand festhalten.' },
  bridge:   { name: 'Beckenheben', emoji: '🌉', unit: 'reps', base: 12,
    how: 'Rückenlage, Füße aufgestellt, Po anspannen und Becken hochdrücken bis Knie–Hüfte–Schulter eine Linie bilden.',
    easier: 'Weniger hoch drücken, kurz oben halten.' },
  jacks:    { name: 'Hampelmänner', emoji: '⭐', unit: 'reps', base: 20,
    how: 'Springend Beine grätschen und Arme über den Kopf, dann zurück.',
    easier: 'Ohne Sprung: abwechselnd ein Bein zur Seite tippen.' },
  superman: { name: 'Superman', emoji: '🦸', unit: 'reps', base: 10,
    how: 'Bauchlage, Arme nach vorne, Arme und Beine gleichzeitig leicht anheben, kurz halten.',
    easier: 'Nur Arme oder nur Beine anheben.' },
  climbers: { name: 'Bergsteiger', emoji: '⛰️', unit: 'reps', base: 16,
    how: 'Liegestützposition, Knie abwechselnd zügig Richtung Brust ziehen.',
    easier: 'Langsam und kontrolliert, Hände auf einer Erhöhung.' },
  wallsit:  { name: 'Wandsitzen', emoji: '🪑', unit: 'sec', base: 20,
    how: 'Rücken an die Wand, runterrutschen bis die Knie ca. 90° gebeugt sind, halten.',
    easier: 'Nicht so tief rutschen.' },
  sideplank:{ name: 'Seitstütz (pro Seite)', emoji: '📐', unit: 'sec', base: 15,
    how: 'Auf einem Unterarm seitlich stützen, Körper gerade, Hüfte oben.',
    easier: 'Unteres Knie ablegen.' },
  crunches: { name: 'Crunches', emoji: '🔥', unit: 'reps', base: 12,
    how: 'Rückenlage, Beine aufgestellt, Schultern mit Bauchkraft leicht vom Boden lösen.',
    easier: 'Hände an die Oberschenkel und nur so weit hoch, wie es angenehm ist.' },
  calfraise:{ name: 'Wadenheben', emoji: '🦶', unit: 'reps', base: 15,
    how: 'Auf die Zehenspitzen drücken, langsam wieder absenken.',
    easier: 'Mit beiden Händen an der Wand festhalten.' },
};

// Ausdauer-/Alltagsaktivitäten zum Eintragen
export const ACTIVITIES = {
  walk:  { name: 'Spazieren', emoji: '🚶‍♀️', unit: 'min' },
  run:   { name: 'Joggen', emoji: '🏃', unit: 'min' },
  bike:  { name: 'Radfahren', emoji: '🚴', unit: 'min' },
  yoga:  { name: 'Yoga / Dehnen', emoji: '🧘', unit: 'min' },
  dance: { name: 'Tanzen', emoji: '💃', unit: 'min' },
  swim:  { name: 'Schwimmen', emoji: '🏊', unit: 'min' },
  steps: { name: 'Schritte', emoji: '👟', unit: 'steps' },
};

export const UNIT_LABEL = { reps: 'Wdh.', sec: 'Sek.', min: 'Min.', steps: 'Schritte' };

// Exercises that work for the daily challenge (3 Sätze)
export const DAILY_POOL = ['squats','pushups','plank','lunges','bridge','jacks','superman','climbers','wallsit','crunches','calfraise','sideplank'];

// Gewohnheit des Tages
export const HABITS = [
  { id: 'water',    emoji: '💧', title: '2 Liter Wasser trinken' },
  { id: 'walk30',   emoji: '🚶‍♀️', title: '30 Minuten spazieren gehen' },
  { id: 'nosugar',  emoji: '🍬', title: 'Heute keine Süßigkeiten' },
  { id: 'stairs',   emoji: '🪜', title: 'Treppe statt Aufzug / Rolltreppe' },
  { id: 'veggies',  emoji: '🥦', title: 'Zu jeder Hauptmahlzeit Gemüse' },
  { id: 'sleep',    emoji: '😴', title: 'Vor 23 Uhr im Bett' },
  { id: 'stretch',  emoji: '🧘', title: '10 Minuten dehnen' },
  { id: 'nosnack',  emoji: '🌙', title: 'Nach 20 Uhr nichts mehr essen' },
  { id: 'steps8k',  emoji: '👟', title: '8.000 Schritte' },
  { id: 'nosoda',   emoji: '🥤', title: 'Keine süßen Getränke' },
  { id: 'protein',  emoji: '🥚', title: 'Zu jeder Mahlzeit eine Eiweißquelle' },
  { id: 'cookhome', emoji: '🍳', title: 'Selbst kochen statt bestellen' },
  { id: 'fruit',    emoji: '🍎', title: 'Obst statt Süßkram als Snack' },
  { id: 'noscreen', emoji: '📵', title: '30 Min vor dem Schlafen kein Handy' },
];

// Wochenziele (Team). metric: {count:[kinds]} | {sum:[keys]} | 'activeDays'
export const WEEKLY_GOALS = [
  { id: 'workouts', title: 'Gemeinsam {t} Workouts', metric: { count: ['workout'] }, base: 4, unit: 'Workouts' },
  { id: 'squats',   title: 'Zusammen {t} Kniebeugen', metric: { sum: ['squats'] }, base: 200, unit: 'Kniebeugen' },
  { id: 'active',   title: 'Zusammen {t} aktive Tage', metric: 'activeDays', base: 8, unit: 'Tage' },
  { id: 'move',     title: '{t} Minuten draußen bewegen', metric: { sum: ['walk','run','bike','swim','dance'] }, base: 180, unit: 'Min.' },
  { id: 'dailies',  title: '{t} Tages-Challenges zusammen', metric: { count: ['daily','habit'] }, base: 14, unit: 'Challenges' },
  { id: 'plank',    title: 'Zusammen {t} Sekunden Plank', metric: { sum: ['plank'] }, base: 300, unit: 'Sek.' },
];

// Duelle der Woche
export const DUELS = [
  { id: 'pushups', title: 'Wer schafft mehr Liegestütze?', metric: { sum: ['pushups'] }, unit: 'Liegestütze' },
  { id: 'squats',  title: 'Wer macht mehr Kniebeugen?', metric: { sum: ['squats'] }, unit: 'Kniebeugen' },
  { id: 'plank',   title: 'Wer hält länger Plank (gesamt)?', metric: { sum: ['plank'] }, unit: 'Sek.' },
  { id: 'move',    title: 'Wer bewegt sich mehr draußen?', metric: { sum: ['walk','run','bike','swim','dance'] }, unit: 'Min.' },
  { id: 'active',  title: 'Wer hat mehr aktive Tage?', metric: 'activeDays', unit: 'Tage' },
  { id: 'workouts',title: 'Wer macht mehr Workouts?', metric: { count: ['workout'] }, unit: 'Workouts' },
  { id: 'dailies', title: 'Wer erledigt mehr Tages-Challenges?', metric: { count: ['daily','habit'] }, unit: 'Challenges' },
];

// Geführte Workouts. work/rest in Sekunden.
export const WORKOUTS = [
  { id: 'start', name: 'Sanfter Start', emoji: '🌱', level: 'Einsteiger', rounds: 2, work: 30, rest: 20,
    desc: 'Ganzkörper, ganz entspannt. Perfekt für die ersten Wochen.',
    exercises: ['jacks','squats','pushups','bridge','plank'] },
  { id: 'legs', name: 'Beine & Po', emoji: '🍑', level: 'Einsteiger', rounds: 2, work: 30, rest: 20,
    desc: 'Kräftigt Beine und Po ohne Springen.',
    exercises: ['squats','lunges','bridge','calfraise','wallsit'] },
  { id: 'core', name: 'Bauch & Rücken', emoji: '🧱', level: 'Einsteiger', rounds: 2, work: 25, rest: 20,
    desc: 'Starke Mitte, gut gegen Rückenschmerzen.',
    exercises: ['crunches','plank','superman','sideplank','bridge'] },
  { id: 'cardio', name: 'Cardio-Kick', emoji: '⚡', level: 'Leicht+', rounds: 3, work: 25, rest: 25,
    desc: 'Bringt den Puls hoch, verbrennt Kalorien.',
    exercises: ['jacks','climbers','squats','jacks'] },
  { id: 'upper', name: 'Oberkörper', emoji: '💪', level: 'Leicht+', rounds: 2, work: 30, rest: 20,
    desc: 'Arme, Schultern, Brust, Rücken.',
    exercises: ['pushups','superman','plank','pushups','sideplank'] },
  { id: 'full', name: 'Ganzkörper 15', emoji: '🔥', level: 'Mittel', rounds: 3, work: 35, rest: 20,
    desc: 'Wenn ihr nach ein paar Wochen mehr wollt.',
    exercises: ['squats','pushups','lunges','climbers','plank','bridge'] },
];

// Anstups-Nachrichten
export const NUDGES = [
  'Komm schon, ich hab schon! 😏',
  'Zeit für die Tages-Challenge! 💪',
  'Ich glaub an dich! ❤️',
  'Nur 10 Minuten – du schaffst das!',
  'Unser Streak zählt auf dich 🔥',
  'Wer zuerst fertig ist, darf den Film aussuchen 🎬',
  'Los, beweg dich, du Faultier 🦥',
];

// Ausschluss-Kategorien für Rezepte
export const DIET_TAGS = {
  fleisch: 'Fleisch', fisch: 'Fisch', milch: 'Milchprodukte', ei: 'Eier',
  gluten: 'Gluten', nuss: 'Nüsse', scharf: 'Scharf',
};

// Rezepte (je 2 Portionen). kcal/protein pro Portion, ungefähr.
export const RECIPES = [
  // Frühstück
  { id: 'overnight-oats', meal: 'breakfast', name: 'Overnight Oats mit Beeren', emoji: '🥣', time: 5, kcal: 380, protein: 22,
    tags: ['milch','gluten'],
    ing: [['Haferflocken','100 g'],['Magerquark','200 g'],['Milch','200 ml'],['Beeren (TK)','150 g'],['Zimt','1 Prise']],
    steps: ['Haferflocken, Quark, Milch und Zimt verrühren.','Auf 2 Gläser verteilen, Beeren darauf.','Über Nacht in den Kühlschrank. Morgens nur noch löffeln.'] },
  { id: 'omelette', meal: 'breakfast', name: 'Gemüse-Omelett', emoji: '🍳', time: 12, kcal: 290, protein: 21,
    tags: ['ei','milch'],
    ing: [['Eier','5'],['Paprika','1'],['Spinat','2 Handvoll'],['Feta','40 g'],['Olivenöl','1 TL']],
    steps: ['Paprika würfeln und in Öl 3 Min anbraten.','Spinat dazu, zusammenfallen lassen.','Verquirlte Eier drübergießen, Feta darüber bröseln.','Bei mittlerer Hitze stocken lassen, halbieren.'] },
  { id: 'skyr-bowl', meal: 'breakfast', name: 'Skyr-Bowl mit Apfel & Nüssen', emoji: '🍎', time: 5, kcal: 320, protein: 28,
    tags: ['milch','nuss'],
    ing: [['Skyr','400 g'],['Apfel','1'],['Walnüsse','20 g'],['Honig','2 TL'],['Zimt','1 Prise']],
    steps: ['Skyr auf 2 Schalen verteilen.','Apfel würfeln, Walnüsse hacken.','Alles darüber, mit Honig und Zimt toppen.'] },
  { id: 'avocado-brot', meal: 'breakfast', name: 'Vollkornbrot mit Avocado & Ei', emoji: '🥑', time: 10, kcal: 360, protein: 17,
    tags: ['ei','gluten'],
    ing: [['Vollkornbrot','4 Scheiben'],['Avocado','1'],['Eier','2'],['Tomate','1'],['Chiliflocken','optional']],
    steps: ['Eier 7 Min kochen.','Avocado zerdrücken, salzen, pfeffern.','Brot bestreichen, Tomaten- und Eischeiben drauf.'] },
  { id: 'protein-pancakes', meal: 'breakfast', name: 'Bananen-Haferflocken-Pancakes', emoji: '🥞', time: 15, kcal: 340, protein: 18,
    tags: ['ei','gluten','milch'],
    ing: [['Banane','1 reife'],['Eier','2'],['Haferflocken','60 g'],['Magerquark','100 g'],['Beeren (TK)','100 g']],
    steps: ['Banane, Eier, Haferflocken und Quark pürieren.','Kleine Pancakes in einer beschichteten Pfanne ausbacken.','Mit Beeren servieren.'] },
  { id: 'chia-pudding', meal: 'breakfast', name: 'Chia-Pudding mit Mango', emoji: '🥭', time: 5, kcal: 280, protein: 10,
    tags: [],
    ing: [['Chiasamen','50 g'],['Haferdrink','300 ml'],['Mango','1/2'],['Vanille','1 Prise']],
    steps: ['Chia mit Haferdrink und Vanille verrühren.','Nach 10 Min nochmal umrühren, über Nacht kühlen.','Mit Mango-Würfeln servieren.'] },

  // Hauptgerichte
  { id: 'haehnchen-gemuese', meal: 'main', name: 'Hähnchen-Gemüse-Pfanne', emoji: '🍗', time: 25, kcal: 420, protein: 42,
    tags: ['fleisch'],
    ing: [['Hähnchenbrust','300 g'],['Brokkoli','1 kleiner'],['Paprika','1'],['Zwiebel','1'],['Reis','100 g'],['Sojasoße','2 EL'],['Olivenöl','1 EL']],
    steps: ['Reis kochen.','Hähnchen in Streifen schneiden und in Öl scharf anbraten.','Zwiebel, Paprika und Brokkoli dazu, 6–8 Min braten.','Mit Sojasoße ablöschen, mit Reis servieren.'] },
  { id: 'linsen-curry', meal: 'main', name: 'Rote-Linsen-Curry', emoji: '🍛', time: 25, kcal: 450, protein: 22,
    tags: ['scharf'],
    ing: [['Rote Linsen','150 g'],['Kokosmilch light','200 ml'],['Gehackte Tomaten','1 Dose'],['Zwiebel','1'],['Spinat','2 Handvoll'],['Currypulver','2 TL'],['Knoblauch','1 Zehe']],
    steps: ['Zwiebel und Knoblauch anschwitzen, Curry kurz mitrösten.','Linsen, Tomaten, Kokosmilch und 200 ml Wasser dazu.','15 Min köcheln, Spinat unterrühren.','Mit Salz und etwas Zitrone abschmecken.'] },
  { id: 'lachs-ofengemuese', meal: 'main', name: 'Lachs mit Ofengemüse', emoji: '🐟', time: 30, kcal: 480, protein: 35,
    tags: ['fisch'],
    ing: [['Lachsfilet','2 Stück'],['Zucchini','1'],['Paprika','1'],['Kartoffeln','300 g'],['Zitrone','1/2'],['Olivenöl','1 EL']],
    steps: ['Ofen auf 200 °C. Kartoffeln würfeln, mit Öl aufs Blech, 10 Min vorbacken.','Zucchini und Paprika dazu, Lachs obendrauf.','Weitere 15 Min backen, mit Zitrone beträufeln.'] },
  { id: 'chili-sin', meal: 'main', name: 'Chili sin Carne', emoji: '🌶️', time: 30, kcal: 430, protein: 24,
    tags: ['scharf'],
    ing: [['Kidneybohnen','1 Dose'],['Mais','1 kleine Dose'],['Gehackte Tomaten','1 Dose'],['Paprika','1'],['Zwiebel','1'],['Rote Linsen','60 g'],['Chilipulver','1 TL']],
    steps: ['Zwiebel und Paprika anbraten.','Tomaten, Linsen, 150 ml Wasser und Gewürze dazu, 15 Min köcheln.','Bohnen und Mais dazu, 5 Min weiter köcheln.'] },
  { id: 'putenwrap', meal: 'main', name: 'Puten-Wraps mit Joghurtsoße', emoji: '🌯', time: 20, kcal: 450, protein: 38,
    tags: ['fleisch','milch','gluten'],
    ing: [['Putenbrust','250 g'],['Vollkorn-Wraps','4'],['Salat','1/2 Kopf'],['Tomate','2'],['Joghurt (1,5 %)','150 g'],['Knoblauch','1 Zehe']],
    steps: ['Pute in Streifen braten, würzen.','Joghurt mit Knoblauch, Salz und Pfeffer verrühren.','Wraps mit Salat, Tomate, Pute und Soße füllen und rollen.'] },
  { id: 'zoodles-bolo', meal: 'main', name: 'Zucchini-Nudeln Bolognese', emoji: '🍝', time: 25, kcal: 390, protein: 32,
    tags: ['fleisch','milch'],
    ing: [['Rinderhack (mager)','250 g'],['Zucchini','2'],['Passierte Tomaten','400 g'],['Zwiebel','1'],['Parmesan','20 g'],['Vollkornnudeln','80 g']],
    steps: ['Hack mit Zwiebel krümelig braten, Tomaten dazu, 10 Min köcheln.','Nudeln kochen, Zucchini in feine Streifen schneiden.','Zucchini 2 Min in der Pfanne erwärmen, mit Nudeln mischen.','Soße drüber, Parmesan drauf.'] },
  { id: 'shakshuka', meal: 'main', name: 'Shakshuka', emoji: '🍅', time: 25, kcal: 340, protein: 20,
    tags: ['ei','milch'],
    ing: [['Eier','4'],['Gehackte Tomaten','1 Dose'],['Paprika','1'],['Zwiebel','1'],['Feta','40 g'],['Kreuzkümmel','1 TL'],['Vollkornbrot','2 Scheiben']],
    steps: ['Zwiebel und Paprika anbraten, Gewürze dazu.','Tomaten dazu, 10 Min einkochen.','4 Mulden machen, Eier hinein, Deckel drauf, 6–8 Min stocken lassen.','Mit Feta und Brot servieren.'] },
  { id: 'thunfisch-salat', meal: 'main', name: 'Bunter Thunfisch-Bohnen-Salat', emoji: '🥗', time: 10, kcal: 380, protein: 35,
    tags: ['fisch','ei'],
    ing: [['Thunfisch (eigener Saft)','2 Dosen'],['Weiße Bohnen','1 Dose'],['Gurke','1'],['Tomate','2'],['Rote Zwiebel','1/2'],['Eier','2'],['Olivenöl','1 EL']],
    steps: ['Eier hart kochen.','Gemüse schneiden, Bohnen abspülen.','Alles mit Thunfisch mischen, mit Öl, Essig, Salz und Pfeffer anmachen.'] },
  { id: 'gnocchi-pfanne', meal: 'main', name: 'Gnocchi-Pfanne mit Spinat & Tomate', emoji: '🥔', time: 20, kcal: 470, protein: 18,
    tags: ['milch','gluten'],
    ing: [['Gnocchi','400 g'],['Kirschtomaten','250 g'],['Spinat','3 Handvoll'],['Mozzarella light','125 g'],['Knoblauch','1 Zehe']],
    steps: ['Gnocchi in wenig Öl goldbraun braten.','Tomaten und Knoblauch dazu, 3 Min mitbraten.','Spinat unterheben, Mozzarella zupfen und schmelzen lassen.'] },
  { id: 'tofu-bowl', meal: 'main', name: 'Knusper-Tofu-Bowl', emoji: '🥢', time: 25, kcal: 440, protein: 26,
    tags: ['gluten'],
    ing: [['Tofu natur','200 g'],['Reis','100 g'],['Edamame (TK)','100 g'],['Karotte','1'],['Gurke','1/2'],['Sojasoße','2 EL'],['Sesam','1 TL']],
    steps: ['Reis kochen. Tofu würfeln, gut ausdrücken.','Tofu in wenig Öl rundum knusprig braten, mit Sojasoße ablöschen.','Edamame kurz kochen, Gemüse in Streifen schneiden.','Alles in Schalen anrichten, Sesam drüber.'] },
  { id: 'haehnchen-suesskartoffel', meal: 'main', name: 'Hähnchen mit Süßkartoffel-Wedges', emoji: '🍠', time: 35, kcal: 470, protein: 40,
    tags: ['fleisch','milch'],
    ing: [['Hähnchenbrust','300 g'],['Süßkartoffel','2 mittlere'],['Paprikapulver','1 TL'],['Joghurt (1,5 %)','150 g'],['Salat','1/2 Kopf'],['Olivenöl','1 EL']],
    steps: ['Ofen 210 °C. Süßkartoffeln in Spalten, mit Öl und Paprika aufs Blech, 25 Min.','Hähnchen würzen und in der Pfanne 6 Min pro Seite braten.','Mit Joghurt-Dip und Salat servieren.'] },
  { id: 'gemuesesuppe', meal: 'main', name: 'Kichererbsen-Gemüsesuppe', emoji: '🍲', time: 30, kcal: 330, protein: 16,
    tags: [],
    ing: [['Kichererbsen','1 Dose'],['Karotte','2'],['Zucchini','1'],['Zwiebel','1'],['Gehackte Tomaten','1 Dose'],['Gemüsebrühe','800 ml']],
    steps: ['Zwiebel und Karotten anschwitzen.','Brühe und Tomaten dazu, 10 Min köcheln.','Zucchini und Kichererbsen dazu, weitere 10 Min.','Mit Salz, Pfeffer und Kräutern abschmecken.'] },
  { id: 'garnelen-nudeln', meal: 'main', name: 'Knoblauch-Garnelen mit Vollkornnudeln', emoji: '🍤', time: 20, kcal: 460, protein: 34,
    tags: ['fisch','gluten'],
    ing: [['Garnelen','250 g'],['Vollkornnudeln','140 g'],['Kirschtomaten','200 g'],['Knoblauch','2 Zehen'],['Rucola','1 Handvoll'],['Olivenöl','1 EL']],
    steps: ['Nudeln kochen.','Knoblauch in Öl anbraten, Garnelen 3 Min mitbraten.','Tomaten halbieren, kurz mitschwenken.','Nudeln untermischen, Rucola drauf.'] },
  { id: 'ofen-feta', meal: 'main', name: 'Ofen-Feta mit Gemüse & Bulgur', emoji: '🧀', time: 30, kcal: 450, protein: 22,
    tags: ['milch','gluten'],
    ing: [['Feta','150 g'],['Kirschtomaten','250 g'],['Zucchini','1'],['Paprika','1'],['Bulgur','100 g'],['Olivenöl','1 EL']],
    steps: ['Ofen 200 °C. Gemüse schneiden, mit Öl in eine Form.','Feta in die Mitte, 20 Min backen.','Bulgur garen, alles zusammen servieren.'] },
  { id: 'kartoffel-quark', meal: 'main', name: 'Pellkartoffeln mit Kräuterquark', emoji: '🥔', time: 25, kcal: 400, protein: 28,
    tags: ['milch'],
    ing: [['Kartoffeln','600 g'],['Magerquark','300 g'],['Schnittlauch','1 Bund'],['Gurke','1'],['Leinöl','1 EL']],
    steps: ['Kartoffeln 20 Min kochen.','Quark mit etwas Wasser cremig rühren, Kräuter, Salz, Pfeffer dazu.','Mit Leinöl beträufeln, Gurke dazu.'] },
  { id: 'burger-bowl', meal: 'main', name: 'Burger-Bowl (ohne Brötchen)', emoji: '🍔', time: 20, kcal: 420, protein: 36,
    tags: ['fleisch','milch'],
    ing: [['Rinderhack (mager)','250 g'],['Salat','1 Kopf'],['Tomate','2'],['Gewürzgurken','4'],['Rote Zwiebel','1/2'],['Joghurt (1,5 %)','100 g'],['Senf','1 TL']],
    steps: ['Hack krümelig braten, würzen.','Salat, Tomate, Gurken und Zwiebel schneiden.','Joghurt mit Senf und etwas Ketchup als Soße.','Alles in Schalen anrichten.'] },

  // Snacks
  { id: 'gemuese-hummus', meal: 'snack', name: 'Gemüsesticks mit Hummus', emoji: '🥕', time: 5, kcal: 180, protein: 7,
    tags: [],
    ing: [['Karotte','2'],['Gurke','1/2'],['Paprika','1'],['Hummus','100 g']],
    steps: ['Gemüse in Sticks schneiden, mit Hummus dippen.'] },
  { id: 'quark-beeren', meal: 'snack', name: 'Vanille-Quark mit Beeren', emoji: '🍓', time: 3, kcal: 160, protein: 20,
    tags: ['milch'],
    ing: [['Magerquark','250 g'],['Beeren (TK)','100 g'],['Vanille','1 Prise'],['Süßstoff / Honig','nach Geschmack']],
    steps: ['Quark mit Vanille und etwas Wasser cremig rühren, Beeren unterheben.'] },
  { id: 'apfel-erdnuss', meal: 'snack', name: 'Apfel mit Erdnussmus', emoji: '🥜', time: 2, kcal: 190, protein: 5,
    tags: ['nuss'],
    ing: [['Apfel','2'],['Erdnussmus','2 EL']],
    steps: ['Apfel in Spalten schneiden, mit Erdnussmus dippen.'] },
  { id: 'eier-snack', meal: 'snack', name: 'Gekochte Eier mit Kresse', emoji: '🥚', time: 10, kcal: 150, protein: 13,
    tags: ['ei'],
    ing: [['Eier','4'],['Kresse','1 Schale']],
    steps: ['Eier 8 Min kochen, halbieren, salzen, Kresse drüber.'] },
];

export const MEAL_LABEL = { breakfast: 'Frühstück', main: 'Hauptgericht', snack: 'Snack' };

export const AVATARS = ['😀','😎','🦊','🐻','🐼','🐯','🦁','🐨','🐸','🦄','🐙','🌸','⚡','🔥','🌈','🍑'];
