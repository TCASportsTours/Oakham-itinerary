// GCS Stat Attack — v7 — shared card data for the server functions.
// Imported by functions/statattack.mjs (the game) and functions/stat-attack-refresh.mjs
// (the weekly Cricinfo update). Lives outside functions/ so Netlify doesn't treat it as a function.
//
// CARDS must stay in the SAME ORDER as DECK in stat-attack-v7.html (DECK_ID is checked by the page).
// Figures: men's Test career totals from ESPNcricinfo Statsguru, read 20 Nov 2026.
// s = [Tests, Runs, Batting average, Highest score, Wickets, Catches + stumpings, All-round rating]
// All-round rating = batting average / bowling average x 100 (100+ Test wickets only, else 0).

export const DECK_ID = "cricinfo-20nov2026-60-r7";
export const BASE_AS_AT = "2026-11-20";

export const CARDS = [
  [200,15921,53.78,248,46,115,0], // Sachin Tendulkar
  [52,6996,99.94,334,2,32,0], // Don Bradman
  [131,11953,52.88,400,0,164,0], // Brian Lara
  [168,13378,51.85,257,5,196,0], // Ricky Ponting
  [164,13288,52.31,270,1,210,0], // Rahul Dravid
  [161,12472,45.35,294,1,175,0], // Alastair Cook
  [149,11814,49.84,374,6,205,0], // Mahela Jayawardene
  [125,10122,51.12,236,1,108,0], // Sunil Gavaskar
  [121,8540,50.23,291,32,122,0], // Viv Richards
  [123,9230,46.85,254,0,121,0], // Virat Kohli
  [112,8786,44.59,335,4,91,0], // David Warner
  [118,8900,42.58,333,23,103,0], // Graham Gooch
  [166,13289,55.37,224,292,200,169.6], // Jacques Kallis
  [93,8032,57.78,365,235,109,169.8], // Garfield Sobers
  [102,5200,33.54,208,383,120,118.1], // Ian Botham
  [131,5248,31.05,163,434,64,104.8], // Kapil Dev
  [88,3807,37.69,136,362,28,165.2], // Imran Khan
  [86,3124,27.16,151,431,39,121.8], // Richard Hadlee
  [133,1261,11.67,67,800,72,51.4], // Muttiah Muralidaran
  [145,3154,17.32,99,708,125,68.2], // Shane Warne
  [188,1353,8.96,81,704,107,33.9], // James Anderson
  [132,2506,17.77,110,619,60,59.9], // Anil Kumble
  [167,3662,18.03,169,604,55,65.1], // Stuart Broad
  [124,641,7.36,61,563,38,34.0], // Glenn McGrath
  [106,3503,25.75,124,537,36,107.3], // Ravichandran Ashwin
  [132,936,7.54,30,519,29,30.9], // Courtney Walsh
  [93,1251,13.59,76,439,26,59.2], // Dale Steyn
  [104,2898,22.64,257,414,44,95.9], // Wasim Akram
  [98,1439,12.40,53,405,18,59.1], // Curtly Ambrose
  [81,1810,18.85,92,376,25,90.0], // Malcolm Marshall
  [147,5515,30.30,125,1,555,0], // Mark Boucher
  [96,5570,47.60,204,0,416,0], // Adam Gilchrist
  [119,4356,27.39,161,0,395,0], // Ian Healy
  [90,4876,38.09,224,0,294,0], // MS Dhoni
  [134,12400,57.40,319,0,202,0], // Kumar Sangakkara
  [95,4389,32.75,135,0,269,0], // Alan Knott
  [169,14278,50.45,262,74,220,0], // Joe Root
  [127,11003,55.29,239,19,224,0], // Steve Smith
  [110,9515,54.06,251,30,96,0], // Kane Williamson
  [41,3610,53.08,317,1,66,0], // Harry Brook
  [70,4863,42.65,175,16,38,0], // Travis Head
  [68,4861,42.64,215,15,52,0], // Marnus Labuschagne
  [68,4863,42.65,196,2,54,0], // Babar Azam
  [49,3364,38.22,182,0,37,0], // Ben Duckett
  [122,7273,34.46,258,252,115,111.2], // Ben Stokes
  [91,4160,37.81,175,356,50,149.4], // Ravindra Jadeja
  [25,830,25.15,93,104,29,116.3], // Marco Jansen
  [145,1766,13.08,47,577,69,43.1], // Nathan Lyon
  [110,2527,19.58,99,460,53,75.4], // Mitchell Starc
  [77,1681,16.48,64,328,37,73.2], // Pat Cummins
  [53,348,6.56,34,238,17,33.1], // Jasprit Bumrah
  [76,1176,12.78,72,358,34,58.2], // Kagiso Rabada
  [81,586,11.26,39,313,32,46.7], // Josh Hazlewood
  [48,192,5.05,22,144,23,17.0], // Mohammed Siraj
  [34,269,7.27,29,126,3,25.8], // Shaheen Shah Afridi
  [63,1369,15.55,84,220,24,52.6], // Keshav Maharaj
  [53,3725,43.82,159,0,187,0], // Rishabh Pant
  [60,3723,36.86,141,0,164,0], // Litton Das
  [108,7062,38.80,219,0,130,0], // Mushfiqur Rahim
  [77,5040,37.05,245,1,137,0]  // Kusal Mendis
];

const range = (a, b) => Array.from({ length: b - a }, (_, i) => a + i);
export const DECKS = { legends: range(0, 36), current: range(36, 60), all: range(0, 60) };

// Current players: the weekly refresh looks these up on Cricinfo by the exact name Cricinfo uses.
export const CURRENT = [
  { i: 36, cric: 'JE Root (ENG)', name: 'Joe Root' },
  { i: 37, cric: 'SPD Smith (AUS)', name: 'Steve Smith' },
  { i: 38, cric: 'KS Williamson (NZ)', name: 'Kane Williamson' },
  { i: 39, cric: 'HC Brook (ENG)', name: 'Harry Brook' },
  { i: 40, cric: 'TM Head (AUS)', name: 'Travis Head' },
  { i: 41, cric: 'M Labuschagne (AUS)', name: 'Marnus Labuschagne' },
  { i: 42, cric: 'Babar Azam (PAK)', name: 'Babar Azam' },
  { i: 43, cric: 'BM Duckett (ENG)', name: 'Ben Duckett' },
  { i: 44, cric: 'BA Stokes (ENG)', name: 'Ben Stokes' },
  { i: 45, cric: 'RA Jadeja (IND)', name: 'Ravindra Jadeja' },
  { i: 46, cric: 'M Jansen (SA)', name: 'Marco Jansen' },
  { i: 47, cric: 'NM Lyon (AUS)', name: 'Nathan Lyon' },
  { i: 48, cric: 'MA Starc (AUS)', name: 'Mitchell Starc' },
  { i: 49, cric: 'PJ Cummins (AUS)', name: 'Pat Cummins' },
  { i: 50, cric: 'JJ Bumrah (IND)', name: 'Jasprit Bumrah' },
  { i: 51, cric: 'K Rabada (SA)', name: 'Kagiso Rabada' },
  { i: 52, cric: 'JR Hazlewood (AUS)', name: 'Josh Hazlewood' },
  { i: 53, cric: 'Mohammed Siraj (IND)', name: 'Mohammed Siraj' },
  { i: 54, cric: 'Shaheen Shah Afridi (PAK)', name: 'Shaheen Shah Afridi' },
  { i: 55, cric: 'KA Maharaj (SA)', name: 'Keshav Maharaj' },
  { i: 56, cric: 'RR Pant (IND)', name: 'Rishabh Pant' },
  { i: 57, cric: 'Litton Das (BAN)', name: 'Litton Das' },
  { i: 58, cric: 'Mushfiqur Rahim (BAN)', name: 'Mushfiqur Rahim' },
  { i: 59, cric: 'BKG Mendis (SL)', name: 'Kusal Mendis' },
];
