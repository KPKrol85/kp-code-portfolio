// Seeded records feed the date-based dashboard KPIs, which compare each
// timestamp against the current runtime date. Fixed calendar dates drift out of
// every supported range (7/30/90 days) as time passes and leave a fresh demo
// showing zeroes, so each timestamp below is derived from one reference taken
// when this module is evaluated. Every seeded record shares that reference, so
// the dataset stays internally coherent - both on first initialization and on
// the demo reset, which rebuilds the domain from this same object.
const SEED_REFERENCE_TIME = Date.now();
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const isoAgo = (offsetMs) => new Date(SEED_REFERENCE_TIME - offsetMs).toISOString();
const minutesAgo = (minutes) => isoAgo(minutes * MINUTE_MS);
const hoursAgo = (hours) => isoAgo(hours * HOUR_MS);
const daysAgo = (days) => isoAgo(days * DAY_MS);
// Vehicle inspections stay calendar-day values: the fleet form validates the
// YYYY-MM-DD shape and `format.dateShort` renders it.
const checkDateDaysAgo = (days) => daysAgo(days).slice(0, 10);

const FleetSeed = {
  // Offsets are spread on purpose: active work sits inside the 7-day range, the
  // pending order only appears from 30 days up, so each range shows a different
  // picture instead of one identical count.
  orders: [
    { id: 'FO-1021', client: 'Nordic Retail', route: 'Gdańsk → Poznań', status: 'in-progress', eta: '2h 15m', priority: 'high', updated: minutesAgo(12), createdBy: 'u_disp_1' },
    { id: 'FO-0988', client: 'Baltic Fresh', route: 'Warszawa → Berlin', status: 'delayed', eta: '4h 40m', priority: 'high', updated: hoursAgo(9), createdBy: 'u_disp_1' },
    { id: 'FO-0975', client: 'AeroParts', route: 'Wrocław → Hamburg', status: 'delivered', eta: 'Dostarczono', priority: 'medium', updated: daysAgo(3), createdBy: 'u_admin_1' },
    { id: 'FO-0991', client: 'PharmaOne', route: 'Łódź → Kraków', status: 'pending', eta: '6h 00m', priority: 'low', updated: daysAgo(22), createdBy: 'u_admin_1' },
    { id: 'FO-1004', client: 'Green Market', route: 'Katowice → Lublin', status: 'in-progress', eta: '3h 35m', priority: 'medium', updated: hoursAgo(5), createdBy: 'u_disp_1' },
    { id: 'FO-1009', client: 'MedLog', route: 'Poznań → Brno', status: 'delayed', eta: '5h 15m', priority: 'high', updated: hoursAgo(26), createdBy: 'u_admin_1' },
    { id: 'FO-1015', client: 'FreshBox', route: 'Gdynia → Szczecin', status: 'in-progress', eta: '1h 50m', priority: 'low', updated: hoursAgo(2), createdBy: 'u_disp_1' }
  ],
  // The idle mega trailer keeps the oldest inspection it always had, far enough
  // back that it only counts as an active vehicle in the 90-day range.
  vehicles: [
    { id: 'GD-5402N', type: 'Chłodnia', status: 'on-route', lastCheck: checkDateDaysAgo(1), driver: 'K. Mazur', createdBy: 'u_admin_1' },
    { id: 'WA-9932K', type: 'Naczepa mega', status: 'available', lastCheck: checkDateDaysAgo(40), driver: 'L. Kowal', createdBy: 'u_disp_1' },
    { id: 'PO-2201X', type: 'Plandeka', status: 'maintenance', lastCheck: checkDateDaysAgo(3), driver: 'A. Lewandowska', createdBy: 'u_admin_1' },
    { id: 'KR-4412J', type: 'Furgon', status: 'available', lastCheck: checkDateDaysAgo(0), driver: 'S. Wójcik', createdBy: 'u_disp_1' },
    { id: 'LU-7811L', type: 'Plandeka', status: 'on-route', lastCheck: checkDateDaysAgo(2), driver: 'E. Piątek', createdBy: 'u_disp_1' }
  ],
  drivers: [
    { name: 'Kinga Mazur', status: 'on-route', lastTrip: 'Gdańsk → Poznań', phone: '+48 600 200 111', createdBy: 'u_disp_1' },
    { name: 'Łukasz Kowal', status: 'available', lastTrip: 'Warszawa → Rzeszów', phone: '+48 600 200 112', createdBy: 'u_admin_1' },
    { name: 'Anna Lewandowska', status: 'maintenance', lastTrip: 'Poznań → Brno', phone: '+48 600 200 113', createdBy: 'u_disp_1' },
    { name: 'Szymon Wójcik', status: 'available', lastTrip: 'Kraków → Ostrava', phone: '+48 600 200 114', createdBy: 'u_admin_1' },
    { name: 'Ewelina Piątek', status: 'on-route', lastTrip: 'Katowice → Lublin', phone: '+48 600 200 115', createdBy: 'u_disp_1' }
  ],
  // `time` carries the machine-readable instant only, exactly like the entries
  // the store appends at runtime. The dashboard feed turns it into the relative
  // wording ("12 min temu") it already renders for those entries.
  activities: [
    { title: 'Zlecenie FO-1021 zaktualizowane', detail: 'ETA przeliczone po opóźnieniu na granicy', time: minutesAgo(12) },
    { title: 'Pojazd LU-7811L po przeglądzie', detail: 'Serwis zakończony, gotowy do wysyłki', time: minutesAgo(34) },
    { title: 'Kierowca Szymon Wójcik rozpoczął zmianę', detail: 'Gotowy do przydziału', time: hoursAgo(1) },
    { title: 'Raport wyeksportowany', detail: 'Zapisano szkic terminowości za Q4', time: hoursAgo(3) }
  ],
  alerts: [
    { type: 'Opóźnienie', message: 'Kolejka na A2 dodaje +45 min do FO-0988', severity: 'wysoki' },
    { type: 'Serwis', message: 'Pojazd PO-2201X wymaga kontroli hamulców', severity: 'średni' },
    { type: 'SLA', message: 'Terminowość spadła do 94.2%', severity: 'niski' }
  ],
  reports: {
    performance: [
      { label: 'Terminowość', value: 94 },
      { label: 'Opóźnione', value: 4 },
      { label: 'Zdarzenia', value: 2 }
    ],
    summary: [
      { metric: 'Śr. dokładność ETA', value: '96.4%' },
      { metric: 'Przebieg (tydzień)', value: '41,200 km' },
      { metric: 'Szac. CO2', value: '12.4 t' },
      { metric: 'Wykorzystanie', value: '82%' }
    ]
  }
};

export { FleetSeed };
