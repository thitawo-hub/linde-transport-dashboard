// ============================================================
// LINDE TRANSPORT - DAILY REPORT
// ============================================================

const SUPABASE_URL =
  'https://hhsqijlcebaijtklskag.supabase.co';

const SUPABASE_KEY =
  'sb_publishable_z5-j4hCd7dJ50-sLaUKraw_ZgM9ZA4W';


// ============================================================
// CONFIG
// ============================================================

const ALLOWED_BRANCHES = [
  'ระยอง',
  'ท่าลาน',
  'บางปะอิน',
  'หาดใหญ่'
];

const DEFAULT_BRANCH = 'ทั้งหมด';


// ============================================================
// GLOBAL DATA
// ============================================================

let masterCars = [];
let masterDrivers = [];
let vehicleSchedules = [];
let dailyVehicleData = [];
let driverShifts = [];

let selectedBranch = DEFAULT_BRANCH;


// ============================================================
// INIT
// ============================================================

document.addEventListener(
  'DOMContentLoaded',
  async () => {

    setToday();

    await loadReport();

  }
);


// ============================================================
// DATE
// ============================================================

function setToday() {

  const el =
    document.getElementById(
      'dateFilter'
    );

  if (!el) return;


  if (!el.value) {

    const today =
      new Date();

    const yyyy =
      today.getFullYear();

    const mm =
      String(
        today.getMonth() + 1
      ).padStart(2, '0');

    const dd =
      String(
        today.getDate()
      ).padStart(2, '0');

    el.value =
      `${yyyy}-${mm}-${dd}`;

  }

}


// ============================================================
// BRANCH FILTER
// ============================================================

function getSelectedBranch() {

  const el =
    document.getElementById(
      'branchFilter'
    );

  return (
    el?.value ||
    DEFAULT_BRANCH
  );

}


// ============================================================
// VALID BRANCH
// ============================================================

function isAllowedBranch(
  branch
) {

  const value =
    String(
      branch || ''
    ).trim();

  return ALLOWED_BRANCHES.includes(
    value
  );

}


// ============================================================
// CHECK LINDE OIL
// ============================================================

function isLindeOil(
  branch
) {

  return (
    String(
      branch || ''
    )
      .trim()
      .toLowerCase() ===
    'linde oil'
  );

}


// ============================================================
// MAIN LOAD
// ============================================================

async function loadReport() {

  const date =
    document.getElementById(
      'dateFilter'
    )?.value;

  if (!date) return;


  selectedBranch =
    getSelectedBranch();


  showLoading(true);

  hideError();


  try {

    // ========================================================
    // LOAD MASTER
    // ========================================================

    await Promise.all([
      loadMasterCars(),
      loadMasterDrivers()
    ]);


    // ========================================================
    // LOAD DAILY DATA
    // ========================================================

    await Promise.all([
      loadDailyVehicleData(date),
      loadVehicleSchedules(date),
      loadDriverShifts(date)
    ]);


    // ========================================================
    // BRANCH FILTER
    // ========================================================

    updateBranchFilter();


    // ========================================================
    // RENDER
    // ========================================================

    renderVehicleSection();

    renderDriverSection();

    renderDriverShiftSection();

    updateReportInfo(date);


    showLoading(false);

  } catch (error) {

    console.error(
      'Daily Report Error:',
      error
    );

    showLoading(false);

    showError(
      error?.message ||
      'ไม่สามารถโหลดข้อมูลได้'
    );

  }

}


// ============================================================
// APPLY FILTERS
// ============================================================

function applyFilters() {

  selectedBranch =
    getSelectedBranch();

  renderVehicleSection();

  renderDriverSection();

  renderDriverShiftSection();

}


// ============================================================
// UPDATE BRANCH FILTER
// ============================================================

function updateBranchFilter() {

  const select =
    document.getElementById(
      'branchFilter'
    );

  if (!select) return;


  const currentValue =
    selectedBranch;


  select.innerHTML = '';


  const allOption =
    document.createElement(
      'option'
    );

  allOption.value =
    DEFAULT_BRANCH;

  allOption.textContent =
    DEFAULT_BRANCH;

  select.appendChild(
    allOption
  );


  ALLOWED_BRANCHES.forEach(
    branch => {

      const option =
        document.createElement(
          'option'
        );

      option.value =
        branch;

      option.textContent =
        branch;

      select.appendChild(
        option
      );

    }
  );


  if (
    [
      DEFAULT_BRANCH,
      ...ALLOWED_BRANCHES
    ].includes(
      currentValue
    )
  ) {

    select.value =
      currentValue;

  } else {

    select.value =
      DEFAULT_BRANCH;

    selectedBranch =
      DEFAULT_BRANCH;

  }

}


// ============================================================
// FILTER MASTER CARS
// ============================================================

function getFilteredMasterCars() {

  const branch =
    selectedBranch ||
    getSelectedBranch();


  return masterCars.filter(
    car => {

      const carBranch =
        String(
          car.branch || ''
        ).trim();


      // ไม่เอา LINDE Oil
      if (
        isLindeOil(
          carBranch
        )
      ) {

        return false;

      }


      // ทั้งหมด = เฉพาะ 4 สาขา
      if (
        branch === DEFAULT_BRANCH
      ) {

        return isAllowedBranch(
          carBranch
        );

      }


      return (
        carBranch === branch
      );

    }
  );

}


// ============================================================
// FILTER MASTER DRIVERS
// ============================================================

function getFilteredMasterDrivers() {

  const branch =
    selectedBranch ||
    getSelectedBranch();


  return masterDrivers.filter(
    driver => {

      const driverBranch =
        String(
          driver.branch || ''
        ).trim();


      // ไม่เอา LINDE Oil
      if (
        isLindeOil(
          driverBranch
        )
      ) {

        return false;

      }


      if (
        branch === DEFAULT_BRANCH
      ) {

        return isAllowedBranch(
          driverBranch
        );

      }


      return (
        driverBranch === branch
      );

    }
  );

}


// ============================================================
// FILTER DAILY VEHICLE DATA
// ============================================================

function getFilteredDailyVehicleData() {

  const branch =
    selectedBranch ||
    getSelectedBranch();


  return dailyVehicleData.filter(
    row => {

      const rowBranch =
        String(
          row.branch || ''
        ).trim();


      // ไม่เอา LINDE Oil
      if (
        isLindeOil(
          rowBranch
        )
      ) {

        return false;

      }


      if (
        branch === DEFAULT_BRANCH
      ) {

        return isAllowedBranch(
          rowBranch
        );

      }


      return (
        rowBranch === branch
      );

    }
  );

}


// ============================================================
// FILTER VEHICLE SCHEDULES
// IMPORTANT:
// ใช้ branch เป็นตัวกรอง
// ไม่ใช้ Master Car เป็นตัวกรอง
//
// เพราะ LOCO อาจไม่มีทะเบียนอยู่ใน Master Car
// ============================================================

function getFilteredVehicleSchedules() {

  const branch =
    selectedBranch ||
    getSelectedBranch();


  return vehicleSchedules.filter(
    row => {

      const rowBranch =
        String(
          row.branch || ''
        ).trim();


      // ไม่เอา LINDE Oil
      if (
        isLindeOil(
          rowBranch
        )
      ) {

        return false;

      }


      if (
        branch === DEFAULT_BRANCH
      ) {

        return isAllowedBranch(
          rowBranch
        );

      }


      return (
        rowBranch === branch
      );

    }
  );

}


// ============================================================
// FILTER DRIVER SHIFTS
// ============================================================

function getFilteredDriverShifts() {

  const drivers =
    getFilteredMasterDrivers();


  const allowedKeys =
    new Set();


  drivers.forEach(
    driver => {

      const aliases = [

        driver.driver_key,

        driver.driver_name,

        driver.driver_name_en

      ];


      aliases
        .map(
          normalizeDriverName
        )
        .filter(Boolean)
        .forEach(
          key =>
            allowedKeys.add(key)
        );

    }
  );


  return driverShifts.filter(
    row => {

      const aliases = [

        row.driver_key,

        row.driver_name,

        row.driver_name_en,

        row.driver_name_master

      ];


      return aliases
        .map(
          normalizeDriverName
        )
        .filter(Boolean)
        .some(
          key =>
            allowedKeys.has(key)
        );

    }
  );

}


// ============================================================
// SUPABASE FETCH
// ============================================================

async function supabaseFetchAll(
  table,
  query = ''
) {

  const url =
    `${SUPABASE_URL}/rest/v1/${table}` +
    (
      query
        ? `?${query}`
        : ''
    );


  const response =
    await fetch(
      url,
      {
        method: 'GET',

        headers: {
          'apikey':
            SUPABASE_KEY
        }
      }
    );


  if (!response.ok) {

    const text =
      await response.text();


    throw new Error(
      `${table}: HTTP ${response.status} ${text}`
    );

  }


  return await response.json();

}


// ============================================================
// MASTER CAR
// ============================================================

async function loadMasterCars() {

  const params =
    new URLSearchParams();


  params.set(
    'select',
    'id,branch,car_no,license_plate,vehicle_type,target_km'
  );


  params.set(
    'order',
    'car_no.asc'
  );


  masterCars =
    await supabaseFetchAll(
      'master_cars',
      params.toString()
    );

}


// ============================================================
// MASTER PERSON
// ============================================================

async function loadMasterDrivers() {

  const params =
    new URLSearchParams();


  params.set(
    'select',
    'id,branch,driver_name,driver_name_en,position,resigned_date,driver_key'
  );


  params.set(
    'order',
    'driver_name.asc'
  );


  masterDrivers =
    await supabaseFetchAll(
      'master_drivers',
      params.toString()
    );

}


// ============================================================
// DAILY VEHICLE VIEW
// ============================================================

async function loadDailyVehicleData(
  date
) {

  const params =
    new URLSearchParams();


  params.set(
    'select',
    '*'
  );


  params.set(
    'work_date',
    `eq.${date}`
  );


  params.set(
    'order',
    'car_no.asc'
  );


  dailyVehicleData =
    await supabaseFetchAll(
      'v_daily_report',
      params.toString()
    );

}


// ============================================================
// VEHICLE SCHEDULE
// ============================================================

async function loadVehicleSchedules(
  date
) {

  const params =
    new URLSearchParams();


  params.set(
    'select',
    '*'
  );


  params.set(
    'work_date',
    `eq.${date}`
  );


  params.set(
    'order',
    'id.asc'
  );


  vehicleSchedules =
    await supabaseFetchAll(
      'vehicle_schedules',
      params.toString()
    );


  console.log(
    'Vehicle Schedules:',
    vehicleSchedules.length
  );

}


// ============================================================
// DRIVER SHIFTS
// ============================================================

async function loadDriverShifts(
  date
) {

  const params =
    new URLSearchParams();


  params.set(
    'select',
    'id,work_date,driver_name,driver_name_en,status,description,driver_name_master,driver_key,source_sheet'
  );


  params.set(
    'work_date',
    `eq.${date}`
  );


  params.set(
    'order',
    'id.asc'
  );


  driverShifts =
    await supabaseFetchAll(
      'driver_shifts',
      params.toString()
    );

}


// ============================================================
// VEHICLE SECTION
// ============================================================

function renderVehicleSection() {

  const filteredCars =
    getFilteredMasterCars();


  const filteredDaily =
    getFilteredDailyVehicleData();


  const filteredSchedules =
    getFilteredVehicleSchedules();


  // ========================================================
  // BUILD VEHICLE MASTER
  //
  // COCO = จาก Master Car
  // LOCO = จาก Vehicle Schedule ที่ไม่มีใน Master Car
  // ========================================================

  const vehicleMap =
    new Map();


  // ========================================================
  // 1. ADD MASTER CAR
  // ========================================================

  filteredCars.forEach(
    car => {

      const plate =
        normalizePlate(
          car.license_plate
        );


      if (!plate) return;


      vehicleMap.set(
        plate,
        {
          source: 'COCO',
          car: car,
          plate: plate
        }
      );

    }
  );


  // ========================================================
  // 2. ADD LOCO FROM VEHICLE SCHEDULE
  //
  // ถ้าทะเบียนไม่มีใน Master Car
  // ให้ถือเป็น LOCO
  // ========================================================

  filteredSchedules.forEach(
    schedule => {

      const plate =
        normalizePlate(
          schedule.license_plate
        );


      if (!plate) return;


      if (
        vehicleMap.has(
          plate
        )
      ) {

        return;

      }


      vehicleMap.set(
        plate,
        {
          source: 'LOCO',
          car: null,
          plate: plate
        }
      );

    }
  );


  const vehicles =
    Array.from(
      vehicleMap.values()
    );


  // ========================================================
  // KPI
  // ========================================================

  const totalCars =
    vehicles.length;


  let jobCars = 0;


  vehicles.forEach(
    vehicle => {

      const plate =
        vehicle.plate;


      const daily =
        filteredDaily.find(
          row =>
            normalizePlate(
              row.license_plate
            ) === plate
        );


      const schedules =
        filteredSchedules.filter(
          row =>
            normalizePlate(
              row.license_plate
            ) === plate
        );


      const hasSchedule =
        schedules.length > 0;


      const hasDailyJob =
        String(
          daily?.job_status || ''
        ).trim() ===
        'มีงาน';


      // ====================================================
      // มีงาน ถ้า:
      //
      // 1. v_daily_report ระบุว่ามีงาน
      // หรือ
      // 2. มีรายการใน vehicle_schedules
      //
      // รองรับ LOCO ที่ยังไม่มี trips
      // ====================================================

      if (
        hasDailyJob ||
        hasSchedule
      ) {

        jobCars++;

      }

    }
  );


  const noJobCars =
    Math.max(
      0,
      totalCars -
      jobCars
    );


  setText(
    'vehicleTotal',
    totalCars
  );


  setText(
    'vehicleWorking',
    jobCars
  );


  setText(
    'vehicleNoJob',
    noJobCars
  );


  // ========================================================
  // TABLE
  // ========================================================

  const tbody =
    document.getElementById(
      'vehicleTableBody'
    );


  if (!tbody) return;


  tbody.innerHTML = '';


  vehicles
    .sort(
      (a, b) => {

        const aCar =
          a.car?.car_no ||
          a.plate ||
          '';

        const bCar =
          b.car?.car_no ||
          b.plate ||
          '';

        return String(
          aCar
        ).localeCompare(
          String(
            bCar
          ),
          'th'
        );

      }
    )
    .forEach(
      vehicle => {

        const plate =
          vehicle.plate;


        const car =
          vehicle.car;


        const daily =
          filteredDaily.find(
            row =>
              normalizePlate(
                row.license_plate
              ) === plate
          );


        const schedules =
          filteredSchedules.filter(
            row =>
              normalizePlate(
                row.license_plate
              ) === plate
          );


        // ==================================================
        // DRIVERS
        // ==================================================

        const drivers = [

          ...new Set(

            schedules
              .map(
                row =>
                  String(
                    row.driver_name || ''
                  ).trim()
              )
              .filter(Boolean)

          )

        ];


        // ==================================================
        // JOB STATUS
        // ==================================================

        const hasSchedule =
          schedules.length > 0;


        const hasDailyJob =
          String(
            daily?.job_status || ''
          ).trim() ===
          'มีงาน';


        const hasJob =
          hasDailyJob ||
          hasSchedule;


        const jobStatus =
          hasJob
            ? 'มีงาน'
            : 'ไม่มีงาน';


        const jobStatusClass =
          hasJob
            ? 'status-green'
            : 'status-gray';


        // ==================================================
        // VEHICLE TYPE
        // ==================================================

        const vehicleType =
          car?.vehicle_type ||
          (
            vehicle.source === 'LOCO'
              ? 'LOCO'
              : '-'
          );


        // ==================================================
        // CAR NO
        // ==================================================

        const carNo =
          car?.car_no ||
          '-';


        // ==================================================
        // STATUS / PLANNING / LTS
        //
        // ถ้า v_daily_report ไม่มี
        // ใช้ vehicle_schedules แทน
        // ==================================================

        const schedule =
          schedules[0];


        const carStatus =
          daily?.car_status ||
          schedule?.car_status ||
          '-';


        const planning =
          daily?.planning ||
          schedule?.planning ||
          '-';


        const ltsNo =
          daily?.lts_no ||
          schedule?.lts_no ||
          '-';


        const timePeriod =
          daily?.time_period ||
          schedule?.time_period ||
          '-';


        const weightType =
          daily?.weight_type ||
          schedule?.weight_type ||
          '-';


        const scheduleCount =
          daily?.schedule_count ||
          schedules.length ||
          0;


        // ==================================================
        // ROW
        // ==================================================

        const tr =
          document.createElement(
            'tr'
          );


        tr.innerHTML = `

          <td>
            <strong>
              ${escapeHtml(
                carNo
              )}
            </strong>
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

          <td>

            <span class="status-badge ${jobStatusClass}">
              ${escapeHtml(
                jobStatus
              )}
            </span>

          </td>

          <td>
            ${escapeHtml(
              carStatus
            )}
          </td>

          <td>
            ${escapeHtml(
              planning
            )}
          </td>

          <td>
            ${escapeHtml(
              ltsNo
            )}
          </td>

          <td>

            ${
              drivers.length

                ? drivers
                    .map(
                      driver =>
                        `<span class="driver-chip">
                          ${escapeHtml(
                            driver
                          )}
                        </span>`
                    )
                    .join('<br>')

                : '-'
            }

          </td>

          <td>
            ${escapeHtml(
              timePeriod
            )}
          </td>

          <td>
            ${escapeHtml(
              weightType
            )}
          </td>

          <td>
            ${scheduleCount}
          </td>

        `;


        tbody.appendChild(
          tr
        );

      }
    );

}


// ============================================================
// DRIVER ALIAS MAP
// ============================================================

function buildDriverAliasMap() {

  const map =
    new Map();


  masterDrivers.forEach(
    driver => {

      const canonicalKey =
        getCanonicalDriverKey(
          driver
        );


      if (!canonicalKey) return;


      const aliases = [

        driver.driver_key,

        driver.driver_name,

        driver.driver_name_en,

        driver.driver_name_master

      ];


      aliases.forEach(
        alias => {

          const key =
            normalizeDriverName(
              alias
            );


          if (key) {

            map.set(
              key,
              canonicalKey
            );

          }

        }
      );

    }
  );


  return map;

}


// ============================================================
// CANONICAL DRIVER KEY
// ============================================================

function getCanonicalDriverKey(
  driver
) {

  return (

    normalizeDriverName(
      driver?.driver_key
    ) ||

    normalizeDriverName(
      driver?.driver_name
    ) ||

    normalizeDriverName(
      driver?.driver_name_en
    )

  );

}


// ============================================================
// DRIVER SECTION
// ============================================================

function renderDriverSection() {

  const filteredDrivers =
    getFilteredMasterDrivers();


  // IMPORTANT:
  // ใช้ vehicle_schedules ที่กรองด้วยสาขาโดยตรง
  // ไม่กรองด้วย Master Car
  const filteredSchedules =
    getFilteredVehicleSchedules();


  const filteredCars =
    getFilteredMasterCars();


  const masterCarPlates =
    new Set(

      filteredCars
        .map(
          car =>
            normalizePlate(
              car.license_plate
            )
        )
        .filter(Boolean)

    );


  const driverAliasMap =
    buildDriverAliasMap();


  const cocoDrivers =
    new Set();


  const locoDrivers =
    new Set();


  // ========================================================
  // CLASSIFY DRIVER FROM VEHICLE SCHEDULE
  // ========================================================

  filteredSchedules.forEach(
    row => {

      const rawDriverName =
        row.driver_name;


      if (
        !String(
          rawDriverName || ''
        ).trim()
      ) {

        return;

      }


      const driverKey =
        driverAliasMap.get(
          normalizeDriverName(
            rawDriverName
          )
        );


      if (!driverKey) {

        return;

      }


      const plate =
        normalizePlate(
          row.license_plate
        );


      if (!plate) return;


      if (
        masterCarPlates.has(
          plate
        )
      ) {

        cocoDrivers.add(
          driverKey
        );

      } else {

        locoDrivers.add(
          driverKey
        );

      }

    }
  );


  // ========================================================
  // COCO HAS PRIORITY OVER LOCO
  // ========================================================

  locoDrivers.forEach(
    driverKey => {

      if (
        cocoDrivers.has(
          driverKey
        )
      ) {

        locoDrivers.delete(
          driverKey
        );

      }

    }
  );


  const totalDrivers =
    filteredDrivers.length;


  const workingDrivers =
    cocoDrivers.size;


  const locoDriverCount =
    locoDrivers.size;


  const noJobDrivers =
    Math.max(
      0,
      totalDrivers -
      workingDrivers -
      locoDriverCount
    );


  setText(
    'driverTotal',
    totalDrivers
  );


  setText(
    'driverWorking',
    workingDrivers
  );


  setText(
    'driverLoco',
    locoDriverCount
  );


  setText(
    'driverNoJob',
    noJobDrivers
  );


  console.log(
    'Branch:',
    selectedBranch
  );


  console.log(
    'COCO Drivers:',
    workingDrivers
  );


  console.log(
    'LOCO Drivers:',
    locoDriverCount
  );


  // ========================================================
  // DRIVER TABLE
  // ========================================================

  const tbody =
    document.getElementById(
      'driverTableBody'
    );


  if (!tbody) return;


  tbody.innerHTML = '';


  filteredDrivers
    .slice()
    .sort(
      (a, b) =>
        String(
          a.driver_name || ''
        ).localeCompare(
          String(
            b.driver_name || ''
          ),
          'th'
        )
    )
    .forEach(
      driver => {

        const canonicalKey =
          getCanonicalDriverKey(
            driver
          );


        let workType =
          'ไม่มีงาน';


        let statusClass =
          'status-gray';


        if (
          cocoDrivers.has(
            canonicalKey
          )
        ) {

          workType =
            'ทำงาน';

          statusClass =
            'status-green';

        }

        else if (
          locoDrivers.has(
            canonicalKey
          )
        ) {

          workType =
            'วิ่งงาน LOCO';

          statusClass =
            'status-orange';

        }


        // ==================================================
        // ASSIGNED CARS
        // ==================================================

        const assignedCars = [

          ...new Set(

            filteredSchedules

              .filter(
                row => {

                  const rowDriverKey =
                    driverAliasMap.get(
                      normalizeDriverName(
                        row.driver_name
                      )
                    );


                  return (
                    rowDriverKey ===
                    canonicalKey
                  );

                }
              )

              .map(
                row =>
                  String(
                    row.license_plate || ''
                  ).trim()
              )

              .filter(Boolean)

          )

        ];


        const tr =
          document.createElement(
            'tr'
          );


        tr.innerHTML = `

          <td>

            <strong>
              ${escapeHtml(
                driver.driver_name || '-'
              )}
            </strong>

          </td>

          <td>
            ${escapeHtml(
              driver.driver_name_en || '-'
            )}
          </td>

          <td>

            <span class="status-badge ${statusClass}">
              ${escapeHtml(
                workType
              )}
            </span>

          </td>

          <td>

            ${
              assignedCars.length

                ? assignedCars
                    .map(
                      car =>
                        `<span class="car-chip">
                          ${escapeHtml(
                            car
                          )}
                        </span>`
                    )
                    .join(' ')

                : '-'
            }

          </td>

          <td>
            ${escapeHtml(
              driver.position || '-'
            )}
          </td>

        `;


        tbody.appendChild(
          tr
        );

      }
    );

}


// ============================================================
// DRIVER SHIFT STATUS
// ============================================================

function renderDriverShiftSection() {

  const rows =
    getFilteredDriverShifts();


  // ========================================================
  // LATEST STATUS PER DRIVER
  // ========================================================

  const latestStatus =
    new Map();


  rows.forEach(
    row => {

      const key =

        normalizeDriverName(
          row.driver_key
        ) ||

        normalizeDriverName(
          row.driver_name
        ) ||

        normalizeDriverName(
          row.driver_name_en
        );


      if (!key) return;


      latestStatus.set(
        key,
        row
      );

    }
  );


  let working = 0;

  let standby = 0;

  let breakCount = 0;

  let leave = 0;

  let off = 0;

  let other = 0;


  latestStatus.forEach(
    row => {

      const category =
        getShiftCategory(
          row.description
        );


      if (
        category === 'working'
      ) {

        working++;

      }

      else if (
        category === 'standby'
      ) {

        standby++;

      }

      else if (
        category === 'break'
      ) {

        breakCount++;

      }

      else if (
        category === 'leave'
      ) {

        leave++;

      }

      else if (
        category === 'off'
      ) {

        off++;

      }

      else {

        other++;

      }

    }
  );


  setText(
    'shiftTotal',
    latestStatus.size
  );


  setText(
    'shiftWorking',
    working
  );


  setText(
    'shiftStandby',
    standby
  );


  setText(
    'shiftBreak',
    breakCount
  );


  setText(
    'shiftLeave',
    leave
  );


  setText(
    'shiftOff',
    off
  );


  setText(
    'shiftOther',
    other
  );


  // ========================================================
  // SHIFT TABLE
  // ========================================================

  const tbody =
    document.getElementById(
      'shiftTableBody'
    );


  if (!tbody) return;


  tbody.innerHTML = '';


  Array.from(
    latestStatus.values()
  )
    .sort(
      (a, b) =>
        String(
          a.driver_name || ''
        ).localeCompare(
          String(
            b.driver_name || ''
          ),
          'th'
        )
    )
    .forEach(
      row => {

        const category =
          getShiftCategory(
            row.description
          );


        let statusClass =
          'status-gray';


        if (
          category === 'working'
        ) {

          statusClass =
            'status-green';

        }

        else if (
          category === 'standby'
        ) {

          statusClass =
            'status-orange';

        }

        else if (
          category === 'leave'
        ) {

          statusClass =
            'status-red';

        }


        const tr =
          document.createElement(
            'tr'
          );


        tr.innerHTML = `

          <td>
            ${escapeHtml(
              row.driver_name || '-'
            )}
          </td>

          <td>
            ${escapeHtml(
              row.driver_name_en || '-'
            )}
          </td>

          <td>

            <span class="status-badge ${statusClass}">
              ${escapeHtml(
                row.description || '-'
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
              row.source_sheet || '-'
            )}
          </td>

        `;


        tbody.appendChild(
          tr
        );

      }
    );

}


// ============================================================
// SHIFT CATEGORY
// ============================================================

function getShiftCategory(
  description
) {

  const value =
    String(
      description || ''
    )
      .trim()
      .toLowerCase();


  if (!value) {

    return 'other';

  }


  // ========================================================
  // WORKING
  // ========================================================

  if (
    [
      'ทำงาน',
      'วิ่งงาน',
      'วิ่งงาน loco',
      'งานมหาชัย',
      'ot',
      'ช่วยงาน',
      'พขร.ใหม่'
    ].includes(value)
  ) {

    return 'working';

  }


  // ========================================================
  // STANDBY
  // ========================================================

  if (
    value === 'สแตนบาย'
  ) {

    return 'standby';

  }


  // ========================================================
  // BREAK
  // ========================================================

  if (
    [
      'เบรค',
      'เบรก'
    ].includes(value)
  ) {

    return 'break';

  }


  // ========================================================
  // LEAVE
  // ========================================================

  if (
    [
      'ลาพักร้อน',
      'ลาป่วย',
      'ลากิจ',
      'ลาหยุดโดยไม่ขอรับเงินเดือน',
      'ลาหยุดโดยไม่รับเงินเดือน',
      'ลาออก'
    ].includes(value)
  ) {

    return 'leave';

  }


  // ========================================================
  // OFF
  // ========================================================

  if (
    [
      'วันหยุดประจำสัปดาห์',
      'วันหยุดนักขัตฤกษ์'
    ].includes(value)
  ) {

    return 'off';

  }


  return 'other';

}


// ============================================================
// NORMALIZE DRIVER NAME
// ============================================================

function normalizeDriverName(
  value
) {

  let name =
    String(
      value || ''
    )
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();


  if (!name) {

    return '';

  }


  // ========================================================
  // MULTIPLE DRIVER
  // นาย A + นาย B
  // ใช้ชื่อคนแรก
  // ========================================================

  if (
    name.includes('+')
  ) {

    name =
      name
        .split('+')[0]
        .trim();

  }


  // ========================================================
  // REMOVE TITLE
  // ========================================================

  name =
    name.replace(
      /^(นาย|นาง|นางสาว|mr\.|mrs\.|ms\.|miss)\s*/i,
      ''
    );


  // ========================================================
  // REMOVE PUNCTUATION
  // ========================================================

  name =
    name
      .replace(/[.,]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();


  return name;

}


// ============================================================
// NORMALIZE PLATE
// ============================================================

function normalizePlate(
  value
) {

  return String(
    value || ''
  )
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();

}


// ============================================================
// NAVIGATION
// ============================================================

function goToPage(
  page
) {

  try {

    const currentUrl =
      new URL(
        window.top.location.href
      );


    currentUrl.searchParams.set(
      'page',
      page
    );


    window.top.location.href =
      currentUrl.toString();

  }

  catch (error) {

    const currentUrl =
      new URL(
        window.location.href
      );


    currentUrl.searchParams.set(
      'page',
      page
    );


    window.location.href =
      currentUrl.toString();

  }


  return false;

}


// ============================================================
// TOGGLE TABLE
// ============================================================

function toggleTable(
  tableWrapperId,
  buttonId
) {

  const wrapper =
    document.getElementById(
      tableWrapperId
    );


  const button =
    document.getElementById(
      buttonId
    );


  if (
    !wrapper ||
    !button
  ) {

    console.warn(
      'ไม่พบ table หรือ button:',
      tableWrapperId,
      buttonId
    );

    return;

  }


  const hidden =
    wrapper.classList.toggle(
      'table-hidden'
    );


  button.textContent =
    hidden
      ? 'แสดงตาราง'
      : 'ซ่อนตาราง';

}


// ============================================================
// REFRESH
// ============================================================

function refreshReport() {

  loadReport();

}


// ============================================================
// REPORT INFO
// ============================================================

function updateReportInfo(
  date
) {

  const el =
    document.getElementById(
      'reportInfo'
    );


  if (!el) return;


  const d =
    new Date(
      `${date}T00:00:00`
    );


  el.textContent =
    `ข้อมูลประจำวันที่ ${
      d.toLocaleDateString(
        'th-TH',
        {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        }
      )
    }`;

}


// ============================================================
// LOADING
// ============================================================

function showLoading(
  show
) {

  const el =
    document.getElementById(
      'loading'
    );


  if (!el) return;


  el.style.display =
    show
      ? 'flex'
      : 'none';

}


// ============================================================
// ERROR
// ============================================================

function showError(
  message
) {

  const el =
    document.getElementById(
      'errorMessage'
    );


  if (!el) {

    alert(message);

    return;

  }


  el.textContent =
    message;


  el.style.display =
    'block';

}


// ============================================================
// HIDE ERROR
// ============================================================

function hideError() {

  const el =
    document.getElementById(
      'errorMessage'
    );


  if (!el) return;


  el.textContent =
    '';


  el.style.display =
    'none';

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


  if (!el) return;


  el.textContent =
    value ?? '-';

}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHtml(
  value
) {

  return String(
    value ?? ''
  )
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
// GLOBAL
// ============================================================

window.loadReport =
  loadReport;

window.refreshReport =
  refreshReport;

window.applyFilters =
  applyFilters;

window.goToPage =
  goToPage;

window.toggleTable =
  toggleTable;
