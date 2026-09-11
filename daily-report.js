// ============================================================
// DAILY REPORT
// Google Sheets → Supabase
//
// SOURCE
// 🚛 รถ
//    = Master Car + ตารางจัดรถ
//
// 👨‍✈️ พขร.
//    = Master Person + ตารางจัดรถ
//
// 📋 สถานะการทำงาน
//    = ตารางกะ / driver_shifts
//    = ใช้ description เป็นสถานะที่แสดง
//
// LOGIC พขร.
// 1. พขร.ทั้งหมด
//    = Master Person
//
// 2. พขร.ทำงาน
//    = คนที่จัดรถ Master Car
//
// 3. พขร.วิ่งงาน LOCO
//    = คนที่จัดรถ แต่ทะเบียนรถไม่อยู่ใน Master Car
//
// 4. พขร.ไม่มีงาน
//    = พขร.ทั้งหมด - ทำงาน - LOCO
//
// IMPORTANT
// - ไม่เอา driver_shifts มาปนกับ Card สถานะ พขร.
// - driver_shifts ใช้สำหรับ "สถานะการทำงานจากตารางกะ"
// ============================================================



// ============================================================
// SUPABASE
// ============================================================

const SUPABASE_URL =
  'https://hhsqijlcebaijtklskag.supabase.co';

// ใส่ Publishable Key เดิมของเธอ
const SUPABASE_KEY =
  'sb_publishable_z5-j4hCd7dJ50-sLaUKraw_ZgM9ZA4W';



// ============================================================
// CONFIG
// ============================================================

const PAGE_SIZE = 1000;



// ============================================================
// GLOBAL DATA
// ============================================================

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

  const dateInput =
    document.getElementById('reportDate');

  const branchSelect =
    document.getElementById('branchFilter');


  if (dateInput) {

    dateInput.addEventListener(
      'change',
      loadReport
    );

  }


  if (branchSelect) {

    branchSelect.addEventListener(
      'change',
      loadReport
    );

  }


  await initReport();

});



// ============================================================
// INIT REPORT
// ============================================================

async function initReport() {

  try {

    showLoading(true);

    clearError();


    // --------------------------------------------------------
    // โหลด Master
    // --------------------------------------------------------

    await Promise.all([
      loadMasterCars(),
      loadMasterDrivers()
    ]);


    // --------------------------------------------------------
    // เติม Dropdown สาขา
    // --------------------------------------------------------

    populateBranchFilter();


    // --------------------------------------------------------
    // โหลดข้อมูลรายวัน
    // --------------------------------------------------------

    await loadReport();


    showLoading(false);

  }

  catch (error) {

    console.error(
      'INIT ERROR:',
      error
    );

    showError(
      error.message ||
      'ไม่สามารถโหลดข้อมูลได้'
    );

    showLoading(false);

  }

}



// ============================================================
// DEFAULT DATE
// ============================================================

function setDefaultDate() {

  const input =
    document.getElementById(
      'reportDate'
    );

  if (!input) return;


  const now =
    new Date();


  const yyyy =
    now.getFullYear();

  const mm =
    String(
      now.getMonth() + 1
    ).padStart(2, '0');

  const dd =
    String(
      now.getDate()
    ).padStart(2, '0');


  input.value =
    `${yyyy}-${mm}-${dd}`;

}



// ============================================================
// LOAD MASTER CARS
// ============================================================

async function loadMasterCars() {

  const url =
    `${SUPABASE_URL}/rest/v1/master_cars` +
    `?select=id,branch,car_no,license_plate,vehicle_type,target_km` +
    `&order=branch.asc,car_no.asc`;


  masterCars =
    await supabaseFetchAll(url);


  console.log(
    'Master Cars:',
    masterCars.length
  );

}



// ============================================================
// LOAD MASTER DRIVERS
// ============================================================

async function loadMasterDrivers() {

  const url =
    `${SUPABASE_URL}/rest/v1/master_drivers` +
    `?select=id,branch,driver_name,driver_name_en,position,resigned_date,driver_key` +
    `&order=branch.asc,driver_name.asc`;


  masterDrivers =
    await supabaseFetchAll(url);


  console.log(
    'Master Drivers:',
    masterDrivers.length
  );

}



// ============================================================
// POPULATE BRANCH FILTER
// ============================================================

function populateBranchFilter() {

  const select =
    document.getElementById(
      'branchFilter'
    );

  if (!select) return;


  const currentValue =
    select.value;


  const branches =
    getBranches();


  select.innerHTML = '';


  const allOption =
    document.createElement('option');

  allOption.value = '';

  allOption.textContent =
    'ทั้งหมด';

  select.appendChild(
    allOption
  );


  branches.forEach(branch => {

    const option =
      document.createElement('option');

    option.value =
      branch;

    option.textContent =
      branch;

    select.appendChild(
      option
    );

  });


  if (
    currentValue &&
    branches.includes(currentValue)
  ) {

    select.value =
      currentValue;

  }

}



// ============================================================
// GET UNIQUE BRANCHES
// ============================================================

function getBranches() {

  const branches =
    new Set();


  masterCars.forEach(car => {

    if (!car.branch) return;

    const branch =
      String(car.branch).trim();

    if (branch) {
      branches.add(branch);
    }

  });


  masterDrivers.forEach(driver => {

    if (!driver.branch) return;

    const branch =
      String(driver.branch).trim();

    if (branch) {
      branches.add(branch);
    }

  });


  return [...branches]
    .sort(
      (a, b) =>
        a.localeCompare(
          b,
          'th'
        )
    );

}



// ============================================================
// LOAD REPORT
// ============================================================

async function loadReport() {

  try {

    const dateInput =
      document.getElementById(
        'reportDate'
      );

    const branchInput =
      document.getElementById(
        'branchFilter'
      );


    currentDate =
      dateInput
        ? dateInput.value
        : '';


    currentBranch =
      branchInput
        ? branchInput.value
        : '';


    if (!currentDate) {
      return;
    }


    showLoading(true);

    clearError();


    // --------------------------------------------------------
    // โหลดข้อมูลวันนั้น
    // --------------------------------------------------------

    const [
      vehicleData,
      shiftData
    ] =
      await Promise.all([

        loadDailyVehicleData(
          currentDate
        ),

        loadDriverShifts(
          currentDate
        )

      ]);


    dailyReport =
      vehicleData || [];


    driverShifts =
      shiftData || [];


    console.log(
      'Daily Vehicle:',
      dailyReport.length
    );


    console.log(
      'Driver Shifts:',
      driverShifts.length
    );


    // --------------------------------------------------------
    // Render
    // --------------------------------------------------------

    renderVehicleSection();

    renderDriverSection();

    renderShiftSection();


    updateReportInfo();


    showLoading(false);

  }

  catch (error) {

    console.error(
      'LOAD REPORT ERROR:',
      error
    );

    showError(
      error.message ||
      'โหลดข้อมูลไม่สำเร็จ'
    );

    showLoading(false);

  }

}



// ============================================================
// UPDATE REPORT INFO
// ============================================================

function updateReportInfo() {

  const el =
    document.getElementById(
      'reportInfo'
    );

  if (!el) return;


  let text =
    `ข้อมูลวันที่ ${formatDateThai(currentDate)}`;


  if (
    currentBranch &&
    currentBranch !== 'ALL'
  ) {

    text +=
      ` · ${currentBranch}`;

  }


  el.textContent =
    text;

}



// ============================================================
// FORMAT DATE THAI
// ============================================================

function formatDateThai(dateString) {

  if (!dateString) {
    return '-';
  }


  const parts =
    String(dateString).split('-');


  if (parts.length !== 3) {
    return dateString;
  }


  return `${parts[2]}/${parts[1]}/${parts[0]}`;

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

  const map =
    new Map();


  masterCars.forEach(car => {

    const plate =
      normalizePlate(
        car.license_plate
      );


    if (!plate) {
      return;
    }


    map.set(
      plate,
      car
    );

  });


  return map;

}



// ============================================================
// BUILD MASTER DRIVER MAP
//
// Map หลาย key เพื่อรองรับ:
// - driver_key
// - ชื่อไทย
// - ชื่ออังกฤษ
// ============================================================

function buildMasterDriverMap() {

  const map =
    new Map();


  masterDrivers.forEach(driver => {

    const keys = [

      normalizeKey(
        driver.driver_key
      ),

      normalizeName(
        driver.driver_name
      ),

      normalizeName(
        driver.driver_name_en
      )

    ];


    keys.forEach(key => {

      if (!key) return;


      if (!map.has(key)) {

        map.set(
          key,
          driver
        );

      }

    });

  });


  return map;

}



// ============================================================
// BUILD CANONICAL DRIVER MAP
//
// ใช้สำหรับแก้ปัญหา:
// ตารางจัดรถใช้ชื่อ
// Master Person ใช้ driver_key
//
// ทุกชื่อจะถูกแปลงกลับไปเป็น key ของ Master Person
// ============================================================

function buildCanonicalDriverMap() {

  const map =
    new Map();


  masterDrivers.forEach(driver => {

    const canonicalKey =
      getMasterDriverCanonicalKey(
        driver
      );


    if (!canonicalKey) {
      return;
    }


    const keys = [

      normalizeKey(
        driver.driver_key
      ),

      normalizeName(
        driver.driver_name
      ),

      normalizeName(
        driver.driver_name_en
      )

    ];


    keys.forEach(key => {

      if (!key) return;


      map.set(
        key,
        canonicalKey
      );

    });

  });


  return map;

}



// ============================================================
// GET MASTER DRIVER CANONICAL KEY
// ============================================================

function getMasterDriverCanonicalKey(
  driver
) {

  if (!driver) {
    return '';
  }


  if (driver.driver_key) {

    return normalizeKey(
      driver.driver_key
    );

  }


  if (driver.driver_name) {

    return normalizeName(
      driver.driver_name
    );

  }


  if (driver.driver_name_en) {

    return normalizeName(
      driver.driver_name_en
    );

  }


  return '';

}



// ============================================================
// FIND MASTER DRIVER
// ============================================================

function findMasterDriver(
  value,
  masterDriverMap
) {

  const key =
    normalizeKey(value);


  if (!key) {
    return null;
  }


  return (
    masterDriverMap.get(key) ||
    null
  );

}



// ============================================================
// NORMALIZE PLATE
// ============================================================

function normalizePlate(value) {

  if (
    value === null ||
    value === undefined
  ) {

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

  if (
    value === null ||
    value === undefined
  ) {

    return '';

  }


  return String(value)
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

}



// ============================================================
// NORMALIZE KEY
// ============================================================

function normalizeKey(value) {

  if (
    value === null ||
    value === undefined
  ) {

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

  if (!driver) {
    return '';
  }


  if (driver.driver_key) {

    return normalizeKey(
      driver.driver_key
    );

  }


  if (driver.driver_name_master) {

    return normalizeName(
      driver.driver_name_master
    );

  }


  if (driver.driver_name) {

    return normalizeName(
      driver.driver_name
    );

  }


  if (driver.driver_name_en) {

    return normalizeName(
      driver.driver_name_en
    );

  }


  return '';

}



// ============================================================
// GET DRIVER DISPLAY NAME
// ============================================================

function getDriverDisplayName(
  driver
) {

  if (!driver) {
    return '-';
  }


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

  if (
    !currentBranch ||
    currentBranch === 'ALL'
  ) {

    return true;

  }


  return (
    normalizeBranch(branch) ===
    normalizeBranch(currentBranch)
  );

}



// ============================================================
// NORMALIZE BRANCH
// ============================================================

function normalizeBranch(value) {

  if (!value) {
    return '';
  }


  return String(value)
    .trim()
    .replace(/\s+/g, '');

}



// ============================================================
// RENDER VEHICLE SECTION
// ============================================================

function renderVehicleSection() {

  const masterCarMap =
    buildMasterCarMap();


  // --------------------------------------------------------
  // รถจาก Master Car
  // --------------------------------------------------------

  const cars =
    masterCars.filter(car =>
      isBranchMatch(
        car.branch
      )
    );


  // --------------------------------------------------------
  // ตารางจัดรถของวันนั้น
  // --------------------------------------------------------

  const schedules =
    dailyReport || [];


  const scheduleByPlate =
    new Map();


  schedules.forEach(row => {

    const plate =
      normalizePlate(
        row.license_plate
      );


    if (!plate) {
      return;
    }


    // รถที่อยู่ใน Master เท่านั้น
    if (!masterCarMap.has(plate)) {
      return;
    }


    if (
      !scheduleByPlate.has(
        plate
      )
    ) {

      scheduleByPlate.set(
        plate,
        []
      );

    }


    scheduleByPlate
      .get(plate)
      .push(row);

  });


  // --------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------

  let totalCars =
    cars.length;

  let jobCars = 0;

  let noJobCars = 0;


  cars.forEach(car => {

    const plate =
      normalizePlate(
        car.license_plate
      );


    const jobs =
      scheduleByPlate.get(
        plate
      ) || [];


    if (jobs.length > 0) {

      jobCars++;

    }

    else {

      noJobCars++;

    }

  });


  // --------------------------------------------------------
  // CAR CARDS
  // --------------------------------------------------------

  setText(
    'totalCars',
    totalCars
  );

  setText(
    'jobCars',
    jobCars
  );

  setText(
    'noJobCars',
    noJobCars
  );


  // --------------------------------------------------------
  // CAR TABLE
  // --------------------------------------------------------

  const tbody =
    document.getElementById(
      'reportTableBody'
    );


  if (!tbody) {
    return;
  }


  tbody.innerHTML = '';


  cars.forEach(car => {

    const plate =
      normalizePlate(
        car.license_plate
      );


    const jobs =
      scheduleByPlate.get(
        plate
      ) || [];


    // ------------------------------------------------------
    // ไม่มีงาน
    // ------------------------------------------------------

    if (jobs.length === 0) {

      const tr =
        document.createElement(
          'tr'
        );


      tr.innerHTML = `

        <td>
          ${escapeHtml(
            car.branch || '-'
          )}
        </td>

        <td>
          ${escapeHtml(
            car.car_no || '-'
          )}
        </td>

        <td>
          ${escapeHtml(
            car.license_plate || '-'
          )}
        </td>

        <td>
          ${escapeHtml(
            car.vehicle_type || '-'
          )}
        </td>

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


      tbody.appendChild(
        tr
      );


      return;

    }


    // ------------------------------------------------------
    // มีงาน
    // ------------------------------------------------------

    jobs.forEach(job => {

      const tr =
        document.createElement(
          'tr'
        );


      tr.innerHTML = `

        <td>
          ${escapeHtml(
            car.branch || '-'
          )}
        </td>

        <td>
          ${escapeHtml(
            car.car_no || '-'
          )}
        </td>

        <td>
          ${escapeHtml(
            car.license_plate || '-'
          )}
        </td>

        <td>
          ${escapeHtml(
            car.vehicle_type || '-'
          )}
        </td>

        <td>
          <span class="status-badge job">
            มีงาน
          </span>
        </td>

        <td>
          ${escapeHtml(
            job.car_status || '-'
          )}
        </td>

        <td>
          ${escapeHtml(
            job.planning || '-'
          )}
        </td>

        <td>
          ${escapeHtml(
            job.lts_no || '-'
          )}
        </td>

        <td>
          ${escapeHtml(
            job.driver_name || '-'
          )}
        </td>

        <td>
          ${escapeHtml(
            job.time_period || '-'
          )}
        </td>

        <td>
          ${escapeHtml(
            job.weight_type || '-'
          )}
        </td>

        <td>
          ${escapeHtml(
            job.schedule_count || 1
          )}
        </td>

      `;


      tbody.appendChild(
        tr
      );

    });

  });

}



// ============================================================
// RENDER DRIVER SECTION
//
// พขร.ส่วนนี้ "ไม่ใช้ driver_shifts"
// ใช้ Master Person + ตารางจัดรถ
// ============================================================

function renderDriverSection() {

  const masterCarMap =
    buildMasterCarMap();


  const masterDriverMap =
    buildMasterDriverMap();


  const canonicalDriverMap =
    buildCanonicalDriverMap();


  // --------------------------------------------------------
  // MASTER PERSON
  // --------------------------------------------------------

  const drivers =
    masterDrivers.filter(driver =>
      isBranchMatch(
        driver.branch
      )
    );


  // --------------------------------------------------------
  // ตารางจัดรถ
  // --------------------------------------------------------

  const schedules =
    dailyReport || [];


  const masterWorkingDrivers =
    new Map();


  const locoDrivers =
    new Map();


  schedules.forEach(row => {

    const driverName =
      row.driver_name;


    if (!driverName) {
      return;
    }


    const sourceNameKey =
      normalizeName(
        driverName
      );


    if (!sourceNameKey) {
      return;
    }


    // ------------------------------------------------------
    // หา Canonical Master Driver Key
    // ------------------------------------------------------

    const canonicalKey =
      canonicalDriverMap.get(
        sourceNameKey
      );


    // ------------------------------------------------------
    // ถ้าไม่เจอใน Master Person
    // ไม่เอามานับ
    // ------------------------------------------------------

    if (!canonicalKey) {
      return;
    }


    const plate =
      normalizePlate(
        row.license_plate
      );


    // ------------------------------------------------------
    // รถใน Master Car = ทำงาน
    // ------------------------------------------------------

    if (
      plate &&
      masterCarMap.has(plate)
    ) {

      const masterCar =
        masterCarMap.get(
          plate
        );


      if (
        !isBranchMatch(
          masterCar.branch
        )
      ) {

        return;

      }


      masterWorkingDrivers.set(
        canonicalKey,
        {
          driverName:
            driverName,

          branch:
            masterCar.branch,

          carNo:
            masterCar.car_no,

          licensePlate:
            masterCar.license_plate,

          vehicleType:
            masterCar.vehicle_type
        }
      );


      return;

    }


    // ------------------------------------------------------
    // รถนอก Master Car = LOCO
    // ------------------------------------------------------

    if (!plate) {
      return;
    }


    const masterDriver =
      masterDriverMap.get(
        sourceNameKey
      );


    if (!masterDriver) {
      return;
    }


    if (
      !isBranchMatch(
        masterDriver.branch
      )
    ) {

      return;

    }


    locoDrivers.set(
      canonicalKey,
      {
        driverName:
          driverName,

        branch:
          masterDriver.branch,

        licensePlate:
          row.license_plate || '-',

        carNo:
          row.car_no || '-',

        vehicleType:
          row.vehicle_type || '-'
      }
    );

  });


  // --------------------------------------------------------
  // ALL MASTER DRIVERS
  // --------------------------------------------------------

  const allMasterDriverKeys =
    new Set();


  drivers.forEach(driver => {

    const key =
      getMasterDriverCanonicalKey(
        driver
      );


    if (key) {

      allMasterDriverKeys.add(
        key
      );

    }

  });


  // --------------------------------------------------------
  // WORKING
  // --------------------------------------------------------

  const workingDrivers =
    new Map();


  masterWorkingDrivers.forEach(
    (value, key) => {

      if (
        allMasterDriverKeys.has(
          key
        )
      ) {

        workingDrivers.set(
          key,
          value
        );

      }

    }
  );


  // --------------------------------------------------------
  // LOCO
  // --------------------------------------------------------

  const locoDriverCount =
    [...locoDrivers.keys()]
      .filter(key =>
        allMasterDriverKeys.has(
          key
        )
      )
      .length;


  // --------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------

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


  // --------------------------------------------------------
  // CARDS
  // --------------------------------------------------------

  setText(
    'totalDrivers',
    totalDrivers
  );

  setText(
    'workingDrivers',
    workingCount
  );

  setText(
    'locoDrivers',
    locoDriverCount
  );

  setText(
    'noJobDrivers',
    noJobCount
  );


  // --------------------------------------------------------
  // DRIVER TABLE
  // --------------------------------------------------------

  renderDriverTable(
    drivers,
    workingDrivers,
    locoDrivers
  );

}



// ============================================================
// RENDER DRIVER TABLE
// ============================================================

function renderDriverTable(
  drivers,
  workingDrivers,
  locoDrivers
) {

  const tbody =
    document.getElementById(
      'driverTableBody'
    );


  if (!tbody) {
    return;
  }


  tbody.innerHTML = '';


  drivers.forEach(driver => {

    const key =
      getMasterDriverCanonicalKey(
        driver
      );


    const working =
      workingDrivers.get(
        key
      );


    const loco =
      locoDrivers.get(
        key
      );


    let status =
      'ไม่มีงาน';


    let statusClass =
      'no-job';


    let carNo =
      '-';


    let plate =
      '-';


    let vehicleType =
      '-';


    // ------------------------------------------------------
    // ทำงาน
    // ------------------------------------------------------

    if (working) {

      status =
        'ทำงาน';

      statusClass =
        'working';


      carNo =
        working.carNo || '-';

      plate =
        working.licensePlate || '-';

      vehicleType =
        working.vehicleType || '-';

    }


    // ------------------------------------------------------
    // LOCO
    // ------------------------------------------------------

    else if (loco) {

      status =
        'วิ่งงาน LOCO';

      statusClass =
        'loco';


      carNo =
        loco.carNo || '-';

      plate =
        loco.licensePlate || '-';

      vehicleType =
        loco.vehicleType || '-';

    }


    // ------------------------------------------------------
    // TABLE ROW
    // ------------------------------------------------------

    const tr =
      document.createElement(
        'tr'
      );


    tr.innerHTML = `

      <td>
        ${escapeHtml(
          driver.branch || '-'
        )}
      </td>

      <td>
        ${escapeHtml(
          driver.driver_name ||
          driver.driver_name_en ||
          '-'
        )}
      </td>

      <td>
        <span
          class="status-badge ${statusClass}"
        >
          ${escapeHtml(
            status
          )}
        </span>
      </td>

      <td>
        ${escapeHtml(
          carNo
        )}
      </td>

      <td>
        ${escapeHtml(
          plate
        )}
      </td>

      <td>
        ${escapeHtml(
          vehicleType
        )}
      </td>

    `;


    tbody.appendChild(
      tr
    );

  });

}



// ============================================================
// RENDER SHIFT SECTION
//
// ส่วนนี้แยกจากสถานะ พขร.
//
// SOURCE:
// driver_shifts
//
// STATUS ที่แสดง:
// description
//
// ตัวอย่าง:
// ทำงาน
// วิ่งงาน
// ลาพักร้อน
// ลาป่วย
// วันหยุดประจำสัปดาห์
// สแตนบาย
// เบรค
// OT
// ฯลฯ
// ============================================================

function renderShiftSection() {

  const tbody =
    document.getElementById(
      'shiftTableBody'
    );


  if (!tbody) {
    return;
  }


  tbody.innerHTML = '';


  // --------------------------------------------------------
  // กรองตามสาขา
  //
  // ตอนนี้ driver_shifts ยังไม่มี branch
  // จึง match ผ่าน Master Person
  // --------------------------------------------------------

  const masterDriverMap =
    buildMasterDriverMap();


  const rows =
    (driverShifts || [])
      .filter(row => {

        if (
          !currentBranch ||
          currentBranch === 'ALL'
        ) {

          return true;

        }


        const keys = [

          normalizeKey(
            row.driver_key
          ),

          normalizeName(
            row.driver_name_master
          ),

          normalizeName(
            row.driver_name
          ),

          normalizeName(
            row.driver_name_en
          )

        ];


        let masterDriver =
          null;


        for (
          const key of keys
        ) {

          if (!key) continue;


          masterDriver =
            masterDriverMap.get(
              key
            );


          if (masterDriver) {
            break;
          }

        }


        if (!masterDriver) {
          return false;
        }


        return isBranchMatch(
          masterDriver.branch
        );

      });


  // --------------------------------------------------------
  // ไม่มีข้อมูล
  // --------------------------------------------------------

  if (rows.length === 0) {

    const tr =
      document.createElement(
        'tr'
      );


    tr.innerHTML = `

      <td
        colspan="5"
        class="loading"
      >
        ไม่พบข้อมูลตารางกะของวันนี้
      </td>

    `;


    tbody.appendChild(
      tr
    );


    return;

  }


  // --------------------------------------------------------
  // Render
  // --------------------------------------------------------

  rows.forEach(row => {

    const tr =
      document.createElement(
        'tr'
      );


    const driverName =
      row.driver_name_master ||
      row.driver_name ||
      row.driver_name_en ||
      '-';


    const status =
      row.description ||
      '-';


    const englishName =
      row.driver_name_en ||
      '-';


    const workDate =
      row.work_date ||
      currentDate ||
      '-';


    tr.innerHTML = `

      <td>
        ${escapeHtml(
          driverName
        )}
      </td>

      <td>
        <span
          class="status-badge shift-status"
        >
          ${escapeHtml(
            status
          )}
        </span>
      </td>

      <td>
        ${escapeHtml(
          row.status || '-'
        )}
      </td>

      <td>
        ${escapeHtml(
          englishName
        )}
      </td>

      <td>
        ${escapeHtml(
          formatDateThai(
            workDate
          )
        )}
      </td>

    `;


    tbody.appendChild(
      tr
    );

  });

}



// ============================================================
// SUPABASE FETCH
// ============================================================

async function supabaseFetchAll(url) {

  let results = [];

  let offset = 0;


  // ----------------------------------------------------------
  // สำคัญ
  //
  // ป้องกัน key มี space / line break / unicode
  // ที่ทำให้ browser ส่ง header ไม่ได้
  // ----------------------------------------------------------

  const cleanKey =
    String(
      SUPABASE_KEY || ''
    )
      .trim();


  if (!cleanKey) {

    throw new Error(
      'ไม่พบ Supabase Publishable Key'
    );

  }


  // ----------------------------------------------------------
  // ตรวจสอบ key เบื้องต้น
  // Header HTTP ต้องเป็น ASCII
  // ----------------------------------------------------------

  for (
    let i = 0;
    i < cleanKey.length;
    i++
  ) {

    if (
      cleanKey.charCodeAt(i) >
      255
    ) {

      throw new Error(
        'Supabase Publishable Key มีอักขระที่ไม่ถูกต้อง กรุณาใส่ Publishable Key ใหม่'
      );

    }

  }


  while (true) {

    const separator =
      url.includes('?')
        ? '&'
        : '?';


    const requestUrl =
      `${url}` +
      `${separator}` +
      `limit=${PAGE_SIZE}` +
      `&offset=${offset}`;


    const response =
      await fetch(
        requestUrl,
        {
          method: 'GET',

          headers: {
            'apikey':
              cleanKey
          }
        }
      );


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


    results.push(
      ...data
    );


    if (
      data.length <
      PAGE_SIZE
    ) {

      break;

    }


    offset +=
      PAGE_SIZE;

  }


  return results;

}



// ============================================================
// SET TEXT
// ============================================================

function setText(
  id,
  value
) {

  const el =
    document.getElementById(
      id
    );


  if (!el) {
    return;
  }


  el.textContent =
    value ?? 0;

}



// ============================================================
// LOADING
// ============================================================

function showLoading(show) {

  const el =
    document.getElementById(
      'loading'
    );


  if (!el) {
    return;
  }


  el.style.display =
    show
      ? 'flex'
      : 'none';

}



// ============================================================
// ERROR
// ============================================================

function showError(message) {

  console.error(
    message
  );


  const el =
    document.getElementById(
      'errorMessage'
    );


  if (!el) {
    return;
  }


  el.textContent =
    message;


  el.style.display =
    'block';

}



// ============================================================
// CLEAR ERROR
// ============================================================

function clearError() {

  const el =
    document.getElementById(
      'errorMessage'
    );


  if (!el) {
    return;
  }


  el.textContent =
    '';


  el.style.display =
    'none';

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
    .replace(
      /&/g,
      '&amp;'
    )
    .replace(
      /</g,
      '&lt;'
    )
    .replace(
      />/g,
      '&gt;'
    )
    .replace(
      /"/g,
      '&quot;'
    )
    .replace(
      /'/g,
      '&#039;'
    );

}



// ============================================================
// DEBUG
// ============================================================

window.dailyReportDebug = {

  getMasterCars:
    () => masterCars,

  getMasterDrivers:
    () => masterDrivers,

  getDailyReport:
    () => dailyReport,

  getDriverShifts:
    () => driverShifts,

  getCurrentDate:
    () => currentDate,

  getCurrentBranch:
    () => currentBranch,

  reload:
    () => loadReport()

};
