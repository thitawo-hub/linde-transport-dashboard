// ============================================================
// LINDE TRANSPORT
// DAILY REPORT
// ============================================================

const SUPABASE_URL =
  'https://hhsqijlcebaijtklskag.supabase.co';

// ใช้ Publishable Key เท่านั้น
const SUPABASE_KEY =
  'sb_publishable_z5-j4hCd7dJ50-sLaUKraw_ZgM9ZA4W';


// ============================================================
// SUPABASE FETCH
// รองรับข้อมูล > 1,000 rows
// ============================================================

async function supabaseFetch(table, params = '') {

  const pageSize = 1000;
  let offset = 0;
  let allData = [];

  while (true) {

    const separator = params ? '&' : '';

    const url =
      `${SUPABASE_URL}/rest/v1/${table}?` +
      `${params}${separator}` +
      `limit=${pageSize}&offset=${offset}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {

      const text =
        await response.text();

      throw new Error(
        `Supabase ${table} ${response.status}: ${text}`
      );
    }

    const data =
      await response.json();

    if (!Array.isArray(data)) {

      throw new Error(
        `ข้อมูล ${table} ไม่ใช่ Array`
      );
    }

    allData =
      allData.concat(data);

    if (data.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return allData;
}


// ============================================================
// NORMALIZE
// ============================================================

function normalizePlate(value) {

  return String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}


function normalizeDriver(value) {

  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}


// ============================================================
// NORMALIZE STATUS
// ใช้ description จาก driver_shifts โดยตรง
// ============================================================

function normalizeDriverStatus(value) {

  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}


// ============================================================
// STATUS PRIORITY
//
// กรณีคนเดียวมีหลาย record ในวันเดียว
// ให้เลือกสถานะที่สำคัญที่สุด
// ============================================================

const DRIVER_STATUS_PRIORITY = {

  'ทำงาน': 100,

  'วิ่งงาน': 100,

  'วิ่งงาน LOCO': 100,

  'งานมหาชัย': 100,

  'OT': 100,

  'ช่วยงาน': 100,

  'พขร.ใหม่': 100,

  'สแตนบาย': 80,

  'เบรค': 70,

  'อบรม': 60,

  'ลาพักร้อน': 40,

  'ลาป่วย': 40,

  'ลากิจ': 40,

  'ลาหยุดโดยไม่ขอรับเงินเดือน': 40,

  'วันหยุดประจำสัปดาห์': 30,

  'วันหยุดนักขัตฤกษ์': 30,

  'ลาออก': 10

};


// ============================================================
// STATUS GROUP
// ============================================================

function getDriverStatusGroup(status) {

  const value =
    normalizeDriverStatus(status);

  if (!value) {
    return 'unknown';
  }

  // -------------------------
  // WORKING
  // -------------------------

  if (
    value === 'ทำงาน' ||
    value === 'วิ่งงาน' ||
    value === 'วิ่งงาน LOCO' ||
    value === 'งานมหาชัย' ||
    value === 'OT' ||
    value === 'ช่วยงาน' ||
    value === 'พขร.ใหม่'
  ) {
    return 'working';
  }


  // -------------------------
  // STANDBY
  // -------------------------

  if (value === 'สแตนบาย') {
    return 'standby';
  }


  // -------------------------
  // OFF
  // -------------------------

  if (
    value === 'วันหยุดประจำสัปดาห์' ||
    value === 'วันหยุดนักขัตฤกษ์'
  ) {
    return 'off';
  }


  // -------------------------
  // LEAVE
  // -------------------------

  if (
    value === 'ลาพักร้อน' ||
    value === 'ลาป่วย' ||
    value === 'ลากิจ' ||
    value === 'ลาหยุดโดยไม่รับเงินเดือน' ||
    value === 'ลาหยุดโดยไม่ขอรับเงินเดือน' ||
    value === 'ลาออก'
  ) {
    return 'leave';
  }


  // -------------------------
  // OTHER
  // เช่น เบรค / อบรม
  // -------------------------

  return 'other';
}


// ============================================================
// LOAD DAILY REPORT
// ============================================================

async function loadDailyReport() {

  const reportDate =
    document.getElementById('reportDate').value;

  const branch =
    document.getElementById('branchFilter').value;

  if (!reportDate) return;


  const tbody =
    document.getElementById('reportTableBody');


  tbody.innerHTML = `
    <tr>
      <td colspan="12" class="loading">
        กำลังโหลดข้อมูล...
      </td>
    </tr>
  `;


  try {

    // ========================================================
    // 1. MASTER CAR
    // ========================================================

    const masterCars =
      await supabaseFetch(
        'master_cars',
        'select=branch,car_no,license_plate,vehicle_type'
      );


    // ========================================================
    // 2. DAILY VEHICLE SCHEDULE
    // ชื่อ พขร. ของรถมาจาก vehicle_schedules / v_daily_report
    // ========================================================

    const schedules =
      await supabaseFetch(
        'v_daily_report',
        `work_date=eq.${encodeURIComponent(reportDate)}` +
        `&select=license_plate,work_date,job_status,car_status,planning,lts_no,driver_name,time_period,weight_type,schedule_count`
      );


    // ========================================================
    // 3. DRIVER SHIFTS
    //
    // driver_name  = ชื่อ พขร.
    // description   = สถานะ พขร.
    //
    // ไม่ใช้ status ในการแสดงสถานะ
    // ========================================================

    const driverShifts =
      await supabaseFetch(
        'driver_shifts',
        `work_date=eq.${encodeURIComponent(reportDate)}` +
        `&select=driver_name,driver_name_en,description,driver_key`
      );


    console.log(
      'Daily Report - driver shifts:',
      driverShifts.length
    );


    // ========================================================
    // 4. MAP VEHICLE SCHEDULE
    // ========================================================

    const scheduleMap =
      new Map();


    schedules.forEach(row => {

      const plate =
        normalizePlate(
          row.license_plate
        );

      if (!plate) return;

      scheduleMap.set(
        plate,
        row
      );
    });


    // ========================================================
    // 5. MAP DRIVER SHIFT
    //
    // ใช้ driver_name เป็นชื่อหลัก
    // ใช้ driver_key ถ้ามี
    //
    // ถ้าคนเดียวมีหลาย record
    // เลือก description ที่ priority สูงสุด
    // ========================================================

    const driverMap =
      new Map();


    driverShifts.forEach(row => {

      const driverName =
        normalizeDriver(
          row.driver_name
        );

      const driverNameEn =
        normalizeDriver(
          row.driver_name_en
        );

      const driverKey =
        normalizeDriver(
          row.driver_key
        );


      if (
        !driverName &&
        !driverNameEn &&
        !driverKey
      ) {
        return;
      }


      const status =
        normalizeDriverStatus(
          row.description
        );


      const priority =
        DRIVER_STATUS_PRIORITY[status] || 1;


      /*
       * ใช้ driver_key เป็น key ถ้ามี
       * ถ้าไม่มี ใช้ชื่อไทย
       * ถ้าไม่มีชื่อไทย ใช้ชื่อ EN
       */

      const mapKey =
        driverKey ||
        driverName ||
        driverNameEn;


      const existing =
        driverMap.get(mapKey);


      if (
        !existing ||
        priority > existing.priority
      ) {

        driverMap.set(
          mapKey,
          {
            driver_name:
              driverName,

            driver_name_en:
              driverNameEn,

            driver_key:
              driverKey,

            description:
              status,

            group:
              getDriverStatusGroup(status),

            priority
          }
        );
      }

    });


    console.log(
      'Daily Report - unique drivers:',
      driverMap.size
    );


    // ========================================================
    // 6. สร้าง INDEX สำหรับค้นหาชื่อ
    //
    // exact match เท่านั้น
    // ไม่ใช้ partial match
    // ========================================================

    const driverNameIndex =
      new Map();

    const driverNameEnIndex =
      new Map();


    driverMap.forEach(driver => {

      if (driver.driver_name) {

        driverNameIndex.set(
          normalizeDriver(
            driver.driver_name
          ),
          driver
        );
      }


      if (driver.driver_name_en) {

        driverNameEnIndex.set(
          normalizeDriver(
            driver.driver_name_en
          ),
          driver
        );
      }

    });


    // ========================================================
    // 7. FIND DRIVER
    // ========================================================

    function findDriver(driverName) {

      const name =
        normalizeDriver(
          driverName
        );

      if (!name) {
        return null;
      }


      // Exact Thai name
      const thaiMatch =
        driverNameIndex.get(name);

      if (thaiMatch) {
        return thaiMatch;
      }


      // Exact EN name
      const enMatch =
        driverNameEnIndex.get(name);

      if (enMatch) {
        return enMatch;
      }


      return null;
    }


    // ========================================================
    // 8. BUILD CAR ROWS
    // ========================================================

    let rows =
      masterCars.map(car => {

        const plate =
          normalizePlate(
            car.license_plate
          );


        const schedule =
          scheduleMap.get(plate);


        /*
         * ชื่อ พขร. ของรถ
         * ใช้จาก vehicle_schedules / v_daily_report
         */

        const driverName =
          normalizeDriver(
            schedule?.driver_name
          );


        /*
         * หา status จาก driver_shifts
         */

        const driverInfo =
          findDriver(
            driverName
          );


        return {

          branch:
            car.branch || '-',

          car_no:
            car.car_no || '-',

          license_plate:
            car.license_plate || '-',

          vehicle_type:
            car.vehicle_type || '-',

          job_status:
            schedule
              ? 'มีงาน'
              : 'ไม่มีงาน',

          car_status:
            schedule?.car_status || '-',

          planning:
            schedule?.planning || '-',

          lts_no:
            schedule?.lts_no || '-',


          /*
           * ชื่อ พขร.
           */

          driver_name:
            driverName || '-',


          /*
           * สถานะ พขร.
           */

          driver_status:
            driverInfo?.description || 'ไม่ระบุ',


          driver_group:
            driverInfo?.group || 'unknown',


          time_period:
            schedule?.time_period || '-',

          weight_type:
            schedule?.weight_type || '-',

          schedule_count:
            schedule?.schedule_count || 0

        };

      });


    // ========================================================
    // 9. FILTER BRANCH
    // ========================================================

    if (branch) {

      rows =
        rows.filter(
          row =>
            row.branch === branch
        );
    }


    // ========================================================
    // 10. CAR SUMMARY
    // ========================================================

    const totalCars =
      rows.length;


    const jobCars =
      rows.filter(
        row =>
          row.job_status === 'มีงาน'
      ).length;


    const noJobCars =
      rows.filter(
        row =>
          row.job_status === 'ไม่มีงาน'
      ).length;


    document.getElementById(
      'totalCars'
    ).textContent =
      totalCars;


    document.getElementById(
      'jobCars'
    ).textContent =
      jobCars;


    document.getElementById(
      'noJobCars'
    ).textContent =
      noJobCars;


    // ========================================================
    // 11. DRIVER SUMMARY
    //
    // สำคัญ:
    // นับจาก driver_shifts
    // ไม่ได้นับจำนวนรถ
    // และไม่ได้นับจำนวน schedule
    // ========================================================

    const selectedDrivers =
      new Map();


    if (branch) {

      /*
       * ถ้าเลือกสาขา
       * เอาเฉพาะ พขร.ที่ผูกกับรถในสาขานั้น
       */

      rows.forEach(row => {

        if (
          !row.driver_name ||
          row.driver_name === '-'
        ) {
          return;
        }


        const driver =
          findDriver(
            row.driver_name
          );


        if (!driver) {
          return;
        }


        const key =
          driver.driver_key ||
          driver.driver_name ||
          driver.driver_name_en;


        if (key) {

          selectedDrivers.set(
            key,
            driver
          );
        }

      });

    } else {

      /*
       * ไม่เลือกสาขา
       * ใช้ พขร.ทั้งหมดจาก driver_shifts
       */

      driverMap.forEach(
        (driver, key) => {

          selectedDrivers.set(
            key,
            driver
          );

        }
      );

    }


    // ========================================================
    // 12. COUNT DRIVER STATUS
    // ========================================================

    let workingDrivers = 0;
    let offDrivers = 0;
    let leaveDrivers = 0;
    let standbyDrivers = 0;
    let unknownDrivers = 0;


    selectedDrivers.forEach(
      driver => {

        switch (driver.group) {

          case 'working':

            workingDrivers++;
            break;


          case 'off':

            offDrivers++;
            break;


          case 'leave':

            leaveDrivers++;
            break;


          case 'standby':

            standbyDrivers++;
            break;


          default:

            unknownDrivers++;
            break;

        }

      }
    );


    // ========================================================
    // 13. UPDATE DRIVER CARDS
    // ========================================================

    document.getElementById(
      'workingDrivers'
    ).textContent =
      workingDrivers;


    document.getElementById(
      'offDrivers'
    ).textContent =
      offDrivers;


    document.getElementById(
      'leaveDrivers'
    ).textContent =
      leaveDrivers;


    document.getElementById(
      'standbyDrivers'
    ).textContent =
      standbyDrivers;


    document.getElementById(
      'unknownDrivers'
    ).textContent =
      unknownDrivers;


    // ========================================================
    // 14. REPORT INFO
    // ========================================================

    document.getElementById(
      'reportInfo'
    ).textContent =
      `วันที่ ${formatThaiDate(reportDate)}`;


    // ========================================================
    // 15. RENDER
    // ========================================================

    renderDailyTable(rows);


    console.log(
      'Daily Report Summary:',
      {
        totalCars,
        jobCars,
        noJobCars,
        workingDrivers,
        offDrivers,
        leaveDrivers,
        standbyDrivers,
        unknownDrivers
      }
    );

  } catch (error) {

    console.error(
      'Daily Report Error:',
      error
    );


    tbody.innerHTML = `
      <tr>
        <td colspan="12" class="loading">
          โหลดข้อมูลไม่สำเร็จ<br>
          ${escapeHtml(error.message)}
        </td>
      </tr>
    `;
  }
}


// ============================================================
// RENDER TABLE
// ============================================================

function renderDailyTable(rows) {

  const tbody =
    document.getElementById(
      'reportTableBody'
    );


  if (!rows.length) {

    tbody.innerHTML = `
      <tr>
        <td colspan="12" class="loading">
          ไม่พบข้อมูล
        </td>
      </tr>
    `;

    return;
  }


  tbody.innerHTML =
    rows.map(row => {

      // ======================================================
      // CAR STATUS
      // ======================================================

      const statusClass =
        row.job_status === 'มีงาน'
          ? 'status-job'
          : 'status-no-job';


      const jobStatus =
        row.job_status === 'มีงาน'
          ? '🟢 มีงาน'
          : '⚪ ไม่มีงาน';


      // ======================================================
      // DRIVER STATUS
      // ใช้ driver_status ซึ่งมาจาก description
      // ======================================================

      let driverStatusClass =
        'driver-unknown';


      let driverStatusText =
        '⚪ ไม่ระบุ';


      switch (
        row.driver_group
      ) {

        case 'working':

          driverStatusClass =
            'driver-work';

          driverStatusText =
            `🟢 ${row.driver_status}`;

          break;


        case 'off':

          driverStatusClass =
            'driver-off';

          driverStatusText =
            `🟡 ${row.driver_status}`;

          break;


        case 'leave':

          driverStatusClass =
            'driver-leave';

          driverStatusText =
            `🔵 ${row.driver_status}`;

          break;


        case 'standby':

          driverStatusClass =
            'driver-standby';

          driverStatusText =
            `🟠 ${row.driver_status}`;

          break;


        default:

          driverStatusClass =
            'driver-unknown';

          driverStatusText =
            `⚪ ${row.driver_status}`;

          break;

      }


      return `
        <tr>

          <td>
            ${escapeHtml(row.branch)}
          </td>

          <td>
            <strong>
              ${escapeHtml(row.car_no)}
            </strong>
          </td>

          <td>
            ${escapeHtml(row.license_plate)}
          </td>

          <td>
            ${escapeHtml(row.vehicle_type)}
          </td>

          <td>
            <span class="status ${statusClass}">
              ${jobStatus}
            </span>
          </td>

          <td>
            ${escapeHtml(row.car_status)}
          </td>

          <td>
            ${escapeHtml(row.planning)}
          </td>

          <td>
            ${escapeHtml(row.lts_no)}
          </td>

          <td>
            ${escapeHtml(row.driver_name)}
          </td>

          <td>
            <span class="driver-status ${driverStatusClass}">
              ${escapeHtml(driverStatusText)}
            </span>
          </td>

          <td>
            ${escapeHtml(row.time_period)}
          </td>

          <td>
            ${escapeHtml(row.weight_type)}
          </td>

        </tr>
      `;

    }).join('');
}


// ============================================================
// LOAD BRANCHES
// ============================================================

async function loadBranches() {

  try {

    const cars =
      await supabaseFetch(
        'master_cars',
        'select=branch'
      );


    const branches =
      [
        ...new Set(
          cars
            .map(row => row.branch)
            .filter(Boolean)
        )
      ].sort();


    const select =
      document.getElementById(
        'branchFilter'
      );


    /*
     * ป้องกัน option ซ้ำ
     */

    select.innerHTML =
      '<option value="">ทั้งหมด</option>';


    branches.forEach(branch => {

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

    });


  } catch (error) {

    console.error(
      'Load Branch Error:',
      error
    );

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


  const today =
    new Date();


  const year =
    today.getFullYear();


  const month =
    String(
      today.getMonth() + 1
    ).padStart(2, '0');


  const day =
    String(
      today.getDate()
    ).padStart(2, '0');


  input.value =
    `${year}-${month}-${day}`;
}


// ============================================================
// THAI DATE
// ============================================================

function formatThaiDate(value) {

  if (!value) return '-';


  const parts =
    value.split('-');


  if (parts.length !== 3) {
    return value;
  }


  const year =
    Number(parts[0]) + 543;


  const month =
    Number(parts[1]);


  const day =
    Number(parts[2]);


  const months = [

    '',

    'ม.ค.',

    'ก.พ.',

    'มี.ค.',

    'เม.ย.',

    'พ.ค.',

    'มิ.ย.',

    'ก.ค.',

    'ส.ค.',

    'ก.ย.',

    'ต.ค.',

    'พ.ย.',

    'ธ.ค.'

  ];


  return `${day} ${months[month]} ${year}`;
}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHtml(value) {

  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


// ============================================================
// INIT
// ============================================================

document.addEventListener(
  'DOMContentLoaded',
  async () => {

    setDefaultDate();

    await loadBranches();

    await loadDailyReport();


    document
      .getElementById(
        'reportDate'
      )
      .addEventListener(
        'change',
        loadDailyReport
      );


    document
      .getElementById(
        'branchFilter'
      )
      .addEventListener(
        'change',
        loadDailyReport
      );

  }
);
