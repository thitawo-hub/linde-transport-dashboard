// ============================================================
// LINDE TRANSPORT - DAILY REPORT
// ============================================================

const SUPABASE_URL =
  'https://hhsqijlcebaijtklskag.supabase.co';

// ============================================================
// IMPORTANT
// คง Publishable Key เดิมของเธอไว้ตรงนี้
// ============================================================

const SUPABASE_KEY =
  'sb_publishable_z5-j4hCd7dJ50-sLaUKraw_ZgM9ZA4W';


// ============================================================
// GLOBAL DATA
// ============================================================

let masterCars = [];
let masterDrivers = [];
let vehicleSchedules = [];
let dailyVehicleData = [];
let driverShifts = [];


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
// MAIN LOAD
// ============================================================

async function loadReport() {

  const date =
    document.getElementById(
      'dateFilter'
    )?.value;

  if (!date) return;

  showLoading(true);

  hideError();

  try {

    // ========================================================
    // MASTER
    // ========================================================

    await Promise.all([
      loadMasterCars(),
      loadMasterDrivers()
    ]);


    // ========================================================
    // DAILY DATA
    // ========================================================

    await Promise.all([
      loadDailyVehicleData(date),
      loadVehicleSchedules(date),
      loadDriverShifts(date)
    ]);


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
// SUPABASE FETCH
// ============================================================

async function supabaseFetchAll(
  table,
  query = ''
) {

  const url =
    `${SUPABASE_URL}/rest/v1/${table}` +
    (query
      ? `?${query}`
      : '');

  const response =
    await fetch(
      url,
      {
        method: 'GET',

        headers: {
          'apikey': SUPABASE_KEY
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

  const totalCars =
    masterCars.length;


  const jobCars =
    dailyVehicleData.filter(
      row =>
        String(
          row.job_status || ''
        ).trim() === 'มีงาน'
    ).length;


  const noJobCars =
    Math.max(
      0,
      totalCars - jobCars
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


  const tbody =
    document.getElementById(
      'vehicleTableBody'
    );

  if (!tbody) return;


  tbody.innerHTML = '';


  masterCars.forEach(
    car => {

      const carPlate =
        normalizePlate(
          car.license_plate
        );


      const daily =
        dailyVehicleData.find(
          row =>
            normalizePlate(
              row.license_plate
            ) === carPlate
        );


      const schedules =
        vehicleSchedules.filter(
          row =>
            normalizePlate(
              row.license_plate
            ) === carPlate
        );


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


      const jobStatus =
        daily?.job_status ||
        'ไม่มีงาน';


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
          <strong>
            ${escapeHtml(
              car.car_no || '-'
            )}
          </strong>
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

          <span class="status-badge ${
            jobStatus === 'มีงาน'
              ? 'status-green'
              : 'status-gray'
          }">

            ${escapeHtml(
              jobStatus
            )}

          </span>

        </td>

        <td>
          ${escapeHtml(
            daily?.car_status || '-'
          )}
        </td>

        <td>
          ${escapeHtml(
            daily?.planning || '-'
          )}
        </td>

        <td>
          ${escapeHtml(
            daily?.lts_no || '-'
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
            daily?.time_period || '-'
          )}
        </td>

        <td>
          ${escapeHtml(
            daily?.weight_type || '-'
          )}
        </td>

        <td>
          ${daily?.schedule_count || 0}
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

  const masterCarPlates =
    new Set(
      masterCars
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
  // สำคัญ:
  // ใช้ vehicle_schedules.driver_name
  // และ vehicle_schedules.license_plate
  // โดยตรง
  // ========================================================

  vehicleSchedules.forEach(
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


      // ----------------------------------------------------
      // ต้องเป็น พขร.ใน Master Person
      // ----------------------------------------------------

      if (!driverKey) {

        console.log(
          'ไม่พบ พขร.ใน Master Person:',
          rawDriverName
        );

        return;

      }


      const plate =
        normalizePlate(
          row.license_plate
        );


      if (!plate) return;


      // ----------------------------------------------------
      // COCO
      // ----------------------------------------------------

      if (
        masterCarPlates.has(
          plate
        )
      ) {

        cocoDrivers.add(
          driverKey
        );

      }


      // ----------------------------------------------------
      // LOCO
      // ----------------------------------------------------

      else {

        locoDrivers.add(
          driverKey
        );

      }

    }
  );


  // ========================================================
  // ถ้าคนเดียวกันมี COCO + LOCO
  // ให้แสดงเป็น "ทำงาน" ก่อน
  // ========================================================

  locoDrivers.forEach(
    driver => {

      if (
        cocoDrivers.has(
          driver
        )
      ) {

        locoDrivers.delete(
          driver
        );

      }

    }
  );


  const totalDrivers =
    masterDrivers.length;


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


  // ========================================================
  // KPI
  // ========================================================

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


  masterDrivers
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


        // --------------------------------------------------
        // หาเลขรถ
        // --------------------------------------------------

        const assignedCars = [

          ...new Set(

            vehicleSchedules

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
            ${escapeHtml(
              driver.branch || '-'
            )}
          </td>

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
    driverShifts.filter(
      row =>
        String(
          row.driver_name || ''
        ).trim()
    );


  // ========================================================
  // ล่าสุดต่อ พขร.
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


  rows.forEach(
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


  if (
    value === 'สแตนบาย'
  ) {

    return 'standby';

  }


  if (
    [
      'เบรค',
      'เบรก'
    ].includes(value)
  ) {

    return 'break';

  }


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


  // ========================================================
  // ถ้ามีหลายชื่อ เช่น
  // นาย A + นาย B
  // เอาคนแรก
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
  // ลบคำนำหน้า
  // ========================================================

  name =
    name.replace(
      /^(นาย|นาง|นางสาว|mr\.|mrs\.|ms\.|miss)\s*/i,
      ''
    );


  // ========================================================
  // ลบจุด / comma ที่ติดชื่อ
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


function hideError() {

  const el =
    document.getElementById(
      'errorMessage'
    );


  if (!el) return;


  el.textContent = '';

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

window.goToPage =
  goToPage;

window.toggleTable =
  toggleTable;
