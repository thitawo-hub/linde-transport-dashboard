// ============================================================
// DAILY REPORT
// Google Sheets → Supabase
//
// Source
// 🚛 รถ       = Master Car + ตารางจัดรถ
// 👨‍✈️ พขร.     = Master Person + ตารางจัดรถ
// 📋 ตารางกะ  = ใช้ภายหลังสำหรับ Status พขร.
//
// Logic พขร.
// 1. พขร.ทั้งหมด       = Master Person
// 2. พขร.ทำงาน         = คนที่จัดรถ Master Car
// 3. พขร.วิ่งงาน LOCO  = คนที่จัดรถ แต่รถไม่มีใน Master Car
// 4. พขร.ไม่มีงาน      = ทั้งหมด - ทำงาน - LOCO
// ============================================================


// ==================== SUPABASE ====================

const SUPABASE_URL = 'https://hhsqijlcebaijtklskag.supabase.co';

// Publishable key
const SUPABASE_KEY = 'sb_publishable_z5-j4hCd7dJ50-sLaUKraw_ZgM9ZA4W';


// ==================== CONFIG ====================

const PAGE_SIZE = 1000;


// ==================== GLOBAL DATA ====================

let masterCars = [];
let masterDrivers = [];
let dailyReport = [];
let driverShifts = [];

let currentDate = '';
let currentBranch = '';


// ============================================================
// INIT
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {

  setDefaultDate();

  const dateInput = document.getElementById('reportDate');
  const branchSelect = document.getElementById('branchFilter');

  if (dateInput) {
    dateInput.addEventListener('change', loadReport);
  }

  if (branchSelect) {
    branchSelect.addEventListener('change', loadReport);
  }

  await initReport();

});


// ============================================================
// INIT REPORT
// ============================================================

async function initReport() {

  try {

    showLoading(true);

    // โหลด Master ก่อน
    await Promise.all([
      loadMasterCars(),
      loadMasterDrivers()
    ]);

    // โหลดรายงาน
    await loadReport();

    showLoading(false);

  } catch (error) {

    console.error('INIT ERROR:', error);

    showError(error.message || 'ไม่สามารถโหลดข้อมูลได้');

    showLoading(false);
  }

}


// ============================================================
// DEFAULT DATE
// ============================================================

function setDefaultDate() {

  const input = document.getElementById('reportDate');

  if (!input) return;

  const now = new Date();

  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');

  input.value = `${yyyy}-${mm}-${dd}`;

}


// ============================================================
// LOAD MASTER CARS
// ============================================================

async function loadMasterCars() {

  const url =
    `${SUPABASE_URL}/rest/v1/master_cars` +
    `?select=id,branch,car_no,license_plate,vehicle_type,target_km` +
    `&order=branch.asc,car_no.asc`;

  masterCars = await supabaseFetchAll(url);

  console.log('Master Cars:', masterCars.length);

}


// ============================================================
// LOAD MASTER DRIVERS
// ============================================================

async function loadMasterDrivers() {

  const url =
    `${SUPABASE_URL}/rest/v1/master_drivers` +
    `?select=id,branch,driver_name,driver_name_en,position,resigned_date,driver_key` +
    `&order=branch.asc,driver_name.asc`;

  masterDrivers = await supabaseFetchAll(url);

  console.log('Master Drivers:', masterDrivers.length);

}


// ============================================================
// LOAD DAILY REPORT
// ============================================================

async function loadReport() {

  try {

    const dateInput = document.getElementById('reportDate');
    const branchInput = document.getElementById('branchFilter');

    currentDate = dateInput ? dateInput.value : '';
    currentBranch = branchInput ? branchInput.value : '';

    if (!currentDate) return;

    showLoading(true);

    // โหลดข้อมูลวันนั้น
    const [vehicleData, shiftData] = await Promise.all([

      loadDailyVehicleData(currentDate),

      loadDriverShifts(currentDate)

    ]);

    dailyReport = vehicleData;
    driverShifts = shiftData;

    // สร้าง Dashboard
    renderVehicleSection();
    renderDriverSection();

    showLoading(false);

  } catch (error) {

    console.error('LOAD REPORT ERROR:', error);

    showError(error.message || 'โหลดข้อมูลไม่สำเร็จ');

    showLoading(false);

  }

}


// ============================================================
// LOAD VEHICLE DAILY DATA
// ============================================================

async function loadDailyVehicleData(date) {

  const url =
    `${SUPABASE_URL}/rest/v1/v_daily_report` +
    `?work_date=eq.${encodeURIComponent(date)}` +
    `&select=*`;

  return await supabaseFetchAll(url);

}


// ============================================================
// LOAD DRIVER SHIFTS
// ============================================================

async function loadDriverShifts(date) {

  const url =
    `${SUPABASE_URL}/rest/v1/driver_shifts` +
    `?work_date=eq.${encodeURIComponent(date)}` +
    `&select=id,work_date,driver_name,driver_name_en,status,description,driver_name_master,driver_key,shift_id` +
    `&order=id.asc`;

  return await supabaseFetchAll(url);

}


// ============================================================
// BUILD MASTER CAR MAP
// ============================================================

function buildMasterCarMap() {

  const map = new Map();

  masterCars.forEach(car => {

    const plate = normalizePlate(car.license_plate);

    if (!plate) return;

    map.set(plate, car);

  });

  return map;

}


// ============================================================
// BUILD MASTER DRIVER MAP
// ============================================================

function buildMasterDriverMap() {

  const map = new Map();

  masterDrivers.forEach(driver => {

    const keys = [
      driver.driver_key,
      normalizeName(driver.driver_name),
      normalizeName(driver.driver_name_en)
    ];

    keys.forEach(key => {

      if (!key) return;

      if (!map.has(key)) {
        map.set(key, driver);
      }

    });

  });

  return map;

}


// ============================================================
// NORMALIZE PLATE
// ============================================================

function normalizePlate(value) {

  if (value === null || value === undefined) {
    return '';
  }

  return String(value)
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();

}


// ============================================================
// NORMALIZE NAME
// ============================================================

function normalizeName(value) {

  if (value === null || value === undefined) {
    return '';
  }

  return String(value)
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

}


// ============================================================
// GET DRIVER KEY
// ============================================================

function getDriverKey(driver) {

  if (!driver) return '';

  if (driver.driver_key) {
    return String(driver.driver_key).trim();
  }

  if (driver.driver_name_master) {
    return normalizeName(driver.driver_name_master);
  }

  if (driver.driver_name) {
    return normalizeName(driver.driver_name);
  }

  if (driver.driver_name_en) {
    return normalizeName(driver.driver_name_en);
  }

  return '';

}


// ============================================================
// GET DRIVER DISPLAY NAME
// ============================================================

function getDriverDisplayName(driver) {

  if (!driver) return '-';

  return (
    driver.driver_name_master ||
    driver.driver_name ||
    driver.driver_name_en ||
    '-'
  );

}


// ============================================================
// FILTER BRANCH
// ============================================================

function isBranchMatch(branch) {

  if (!currentBranch || currentBranch === 'ALL') {
    return true;
  }

  return normalizeBranch(branch) === normalizeBranch(currentBranch);

}


// ============================================================
// NORMALIZE BRANCH
// ============================================================

function normalizeBranch(value) {

  if (!value) return '';

  return String(value)
    .trim()
    .replace(/\s+/g, '');

}


// ============================================================
// GET UNIQUE BRANCHES
// ============================================================

function getBranches() {

  const branches = new Set();

  masterCars.forEach(car => {

    if (car.branch) {
      branches.add(car.branch.trim());
    }

  });

  masterDrivers.forEach(driver => {

    if (driver.branch) {
      branches.add(driver.branch.trim());
    }

  });

  return [...branches].sort();

}


// ============================================================
// RENDER VEHICLE SECTION
// ============================================================

function renderVehicleSection() {

  const masterCarMap = buildMasterCarMap();

  // ========================================================
  // รถที่อยู่ใน Master เท่านั้น
  // ========================================================

  let cars = masterCars.filter(car =>
    isBranchMatch(car.branch)
  );

  // ========================================================
  // ตารางจัดรถของวันนั้น
  // ========================================================

  const schedules = dailyReport || [];

  const scheduleByPlate = new Map();

  schedules.forEach(row => {

    const plate = normalizePlate(row.license_plate);

    if (!plate) return;

    // ไม่รับรถนอก Master
    if (!masterCarMap.has(plate)) return;

    if (!scheduleByPlate.has(plate)) {
      scheduleByPlate.set(plate, []);
    }

    scheduleByPlate.get(plate).push(row);

  });


  // ========================================================
  // สรุป
  // ========================================================

  let totalCars = cars.length;
  let jobCars = 0;
  let noJobCars = 0;

  cars.forEach(car => {

    const plate = normalizePlate(car.license_plate);

    const jobs = scheduleByPlate.get(plate) || [];

    if (jobs.length > 0) {
      jobCars++;
    } else {
      noJobCars++;
    }

  });


  // ========================================================
  // Update Cards
  // ========================================================

  setText('totalCars', totalCars);
  setText('jobCars', jobCars);
  setText('noJobCars', noJobCars);


  // ========================================================
  // Render Table
  // ========================================================

  const tbody = document.getElementById('reportTableBody');

  if (!tbody) return;

  tbody.innerHTML = '';


  cars.forEach(car => {

    const plate = normalizePlate(car.license_plate);

    const jobs = scheduleByPlate.get(plate) || [];

    // ------------------------------------------------------
    // ไม่มีงาน
    // ------------------------------------------------------

    if (jobs.length === 0) {

      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td>${escapeHtml(car.branch || '-')}</td>
        <td>${escapeHtml(car.car_no || '-')}</td>
        <td>${escapeHtml(car.license_plate || '-')}</td>
        <td>${escapeHtml(car.vehicle_type || '-')}</td>
        <td>
          <span class="status-badge no-job">
            ไม่มีงาน
          </span>
        </td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>-</td>
        <td>0</td>
      `;

      tbody.appendChild(tr);

      return;

    }


    // ------------------------------------------------------
    // มีงาน
    // ------------------------------------------------------

    jobs.forEach(job => {

      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td>${escapeHtml(car.branch || '-')}</td>

        <td>${escapeHtml(car.car_no || '-')}</td>

        <td>${escapeHtml(car.license_plate || '-')}</td>

        <td>${escapeHtml(car.vehicle_type || '-')}</td>

        <td>
          <span class="status-badge job">
            มีงาน
          </span>
        </td>

        <td>${escapeHtml(job.car_status || '-')}</td>

        <td>${escapeHtml(job.planning || '-')}</td>

        <td>${escapeHtml(job.lts_no || '-')}</td>

        <td>${escapeHtml(job.driver_name || '-')}</td>

        <td>${escapeHtml(job.time_period || '-')}</td>

        <td>${escapeHtml(job.weight_type || '-')}</td>

        <td>${escapeHtml(job.schedule_count || 1)}</td>
      `;

      tbody.appendChild(tr);

    });

  });

}


// ============================================================
// RENDER DRIVER SECTION
// ============================================================

function renderDriverSection() {

  const masterCarMap = buildMasterCarMap();
  const masterDriverMap = buildMasterDriverMap();


  // ========================================================
  // 1. MASTER PERSON
  // ========================================================

  let drivers = masterDrivers.filter(driver =>
    isBranchMatch(driver.branch)
  );


  // ========================================================
  // 2. ตารางจัดรถของวันนั้น
  // ========================================================

  const schedules = dailyReport || [];


  // คนที่ทำงานกับรถ Master
  const masterWorkingDrivers = new Map();

  // คนที่ไปวิ่งรถนอก Master = LOCO
  const locoDrivers = new Map();


  schedules.forEach(row => {

    const driverName = row.driver_name;

    if (!driverName) return;

    const driverKey =
      normalizeName(driverName);

    if (!driverKey) return;


    const plate =
      normalizePlate(row.license_plate);

    // ------------------------------------------------------
    // ถ้าเป็นรถใน Master
    // ------------------------------------------------------

    if (plate && masterCarMap.has(plate)) {

      const masterCar = masterCarMap.get(plate);

      // ถ้าเลือกสาขา ต้องนับตามสาขาของ Master Car
      if (!isBranchMatch(masterCar.branch)) {
        return;
      }

      masterWorkingDrivers.set(driverKey, {
        driverName: driverName,
        branch: masterCar.branch,
        carNo: masterCar.car_no,
        licensePlate: masterCar.license_plate,
        vehicleType: masterCar.vehicle_type
      });

      return;
    }


    // ------------------------------------------------------
    // ถ้าไม่พบรถใน Master = LOCO
    // ------------------------------------------------------

    if (!plate) return;


    // หาคนใน Master Person
    const masterDriver =
      masterDriverMap.get(driverKey);


    // ถ้าไม่ใช่คนใน Master Person ก็ไม่เอามานับ
    if (!masterDriver) return;


    if (!isBranchMatch(masterDriver.branch)) {
      return;
    }


    locoDrivers.set(driverKey, {
      driverName: driverName,
      branch: masterDriver.branch,
      licensePlate: row.license_plate || '-',
      carNo: row.car_no || '-',
      vehicleType: row.vehicle_type || '-'
    });

  });


  // ========================================================
  // 3. สร้างชุด Driver ทั้งหมด
  // ========================================================

  const allMasterDriverKeys = new Set();

  drivers.forEach(driver => {

    const key = getDriverKey(driver);

    if (key) {
      allMasterDriverKeys.add(key);
    }

  });


  // ========================================================
  // 4. พขร.ทำงาน
  // ========================================================

  const workingDrivers = new Map();


  masterWorkingDrivers.forEach((value, key) => {

    if (allMasterDriverKeys.has(key)) {

      workingDrivers.set(key, value);

    }

  });


  // ========================================================
  // 5. LOCO
  // ========================================================

  const locoDriverCount =
    [...locoDrivers.keys()]
      .filter(key => allMasterDriverKeys.has(key))
      .length;


  // ========================================================
  // 6. ไม่มีงาน
  //
  // Master - ทำงาน - LOCO
  // ========================================================

  const totalDrivers =
    allMasterDriverKeys.size;

  const workingCount =
    workingDrivers.size;

  const noJobCount =
    Math.max(
      0,
      totalDrivers -
      workingCount -
      locoDriverCount
    );


  // ========================================================
  // 7. Update Cards
  // ========================================================

  setText('totalDrivers', totalDrivers);
  setText('workingDrivers', workingCount);
  setText('locoDrivers', locoDriverCount);
  setText('noJobDrivers', noJobCount);


  // ========================================================
  // 8. ตาราง พขร.
  // ========================================================

  renderDriverTable(
    drivers,
    workingDrivers,
    locoDrivers,
    masterDriverMap
  );

}


// ============================================================
// RENDER DRIVER TABLE
// ============================================================

function renderDriverTable(
  drivers,
  workingDrivers,
  locoDrivers,
  masterDriverMap
) {

  const tbody =
    document.getElementById('driverTableBody');

  if (!tbody) return;

  tbody.innerHTML = '';


  drivers.forEach(driver => {

    const key = getDriverKey(driver);

    const working =
      workingDrivers.get(key);

    const loco =
      locoDrivers.get(key);


    let status = 'ไม่มีงาน';
    let statusClass = 'no-job';

    let carNo = '-';
    let plate = '-';
    let vehicleType = '-';


    // ------------------------------------------------------
    // ทำงานกับรถ Master
    // ------------------------------------------------------

    if (working) {

      status = 'ทำงาน';
      statusClass = 'working';

      carNo = working.carNo || '-';
      plate = working.licensePlate || '-';
      vehicleType = working.vehicleType || '-';

    }


    // ------------------------------------------------------
    // วิ่งงาน LOCO
    // ------------------------------------------------------

    else if (loco) {

      status = 'วิ่งงาน LOCO';
      statusClass = 'loco';

      carNo = loco.carNo || '-';
      plate = loco.licensePlate || '-';
      vehicleType = loco.vehicleType || '-';

    }


    // ------------------------------------------------------
    // Render
    // ------------------------------------------------------

    const tr =
      document.createElement('tr');

    tr.innerHTML = `

      <td>
        ${escapeHtml(driver.branch || '-')}
      </td>

      <td>
        ${escapeHtml(
          driver.driver_name ||
          driver.driver_name_en ||
          '-'
        )}
      </td>

      <td>
        <span class="status-badge ${statusClass}">
          ${escapeHtml(status)}
        </span>
      </td>

      <td>
        ${escapeHtml(carNo)}
      </td>

      <td>
        ${escapeHtml(plate)}
      </td>

      <td>
        ${escapeHtml(vehicleType)}
      </td>

    `;

    tbody.appendChild(tr);

  });

}


// ============================================================
// SUPABASE FETCH
// ============================================================

async function supabaseFetchAll(url) {

  let results = [];
  let offset = 0;

  while (true) {

    const separator =
      url.includes('?') ? '&' : '?';

    const requestUrl =
      `${url}${separator}limit=${PAGE_SIZE}&offset=${offset}`;

    const response =
      await fetch(requestUrl, {

        method: 'GET',

        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }

      });


    if (!response.ok) {

      const text =
        await response.text();

      throw new Error(
        `Supabase ${response.status}: ${text}`
      );

    }


    const data =
      await response.json();


    if (!Array.isArray(data)) {
      break;
    }


    results.push(...data);


    if (data.length < PAGE_SIZE) {
      break;
    }


    offset += PAGE_SIZE;

  }

  return results;

}


// ============================================================
// UI HELPERS
// ============================================================

function setText(id, value) {

  const el =
    document.getElementById(id);

  if (!el) return;

  el.textContent =
    value ?? 0;

}


// ============================================================
// LOADING
// ============================================================

function showLoading(show) {

  const el =
    document.getElementById('loading');

  if (!el) return;

  el.style.display =
    show ? 'flex' : 'none';

}


// ============================================================
// ERROR
// ============================================================

function showError(message) {

  console.error(message);

  const el =
    document.getElementById('errorMessage');

  if (!el) return;

  el.textContent =
    message;

  el.style.display =
    'block';

}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHtml(value) {

  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

}


// ============================================================
// DEBUG
// ============================================================

window.dailyReportDebug = {

  getMasterCars: () =>
    masterCars,

  getMasterDrivers: () =>
    masterDrivers,

  getDailyReport: () =>
    dailyReport,

  getDriverShifts: () =>
    driverShifts,

  reload: () =>
    loadReport()

};
