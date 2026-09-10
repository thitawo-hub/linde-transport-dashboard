const SUPABASE_URL = 'https://hhsqijlcebaijtklskag.supabase.co';

// ใช้ Publishable Key ตัวเดียวกับ app.js
const SUPABASE_KEY = 'sb_publishable_z5-j4hCd7dJ50-sLaUKraw_ZgM9ZA4W';


/* =========================================================
   SUPABASE
========================================================= */

async function supabaseFetch(table, params = '') {

  const url =
    `${SUPABASE_URL}/rest/v1/${table}` +
    (params ? `?${params}` : '');

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });

  if (!response.ok) {

    const text = await response.text();

    throw new Error(
      `Supabase ${response.status}: ${text}`
    );
  }

  return response.json();
}


/* =========================================================
   NORMALIZE
========================================================= */

function normalizePlate(value) {

  return String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}


function normalizeDriver(value) {

  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}


/* =========================================================
   LOAD DAILY REPORT
========================================================= */

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

    /* =====================================================
       1. MASTER CAR
    ===================================================== */

    const masterCars = await supabaseFetch(
      'master_cars',
      'select=branch,car_no,license_plate,vehicle_type'
    );


    /* =====================================================
       2. DAILY VEHICLE SCHEDULE
    ===================================================== */

    const schedules = await supabaseFetch(
      'v_daily_report',
      `work_date=eq.${encodeURIComponent(reportDate)}` +
      `&select=license_plate,work_date,job_status,car_status,planning,lts_no,driver_name,time_period,weight_type,schedule_count`
    );


    /* =====================================================
       3. DRIVER SHIFTS
    ===================================================== */

    const driverShifts = await supabaseFetch(
      'driver_shifts',
      `work_date=eq.${encodeURIComponent(reportDate)}` +
      `&select=driver_name,driver_name_en,status,description`
    );


    /* =====================================================
       4. MAP VEHICLE SCHEDULE
    ===================================================== */

    const scheduleMap = new Map();

    schedules.forEach(row => {

      const plate =
        normalizePlate(row.license_plate);

      if (!plate) return;

      scheduleMap.set(plate, row);

    });


    /* =====================================================
       5. MAP DRIVER SHIFT
    ===================================================== */

    const driverMap = new Map();

    driverShifts.forEach(row => {

      const driverEn =
        normalizeDriver(row.driver_name_en);

      const driverTh =
        normalizeDriver(row.driver_name);

      const key =
        driverEn || driverTh;

      if (!key) return;


      const description =
        String(row.description || '').trim();


      let reportStatus = 'ไม่ระบุ';


      if (description === 'ทำงาน') {

        reportStatus = 'ทำงาน';

      } else if (description === 'วันหยุด') {

        reportStatus = 'วันหยุด';

      } else if (description === 'ลางาน') {

        reportStatus = 'ลางาน';

      } else if (description === 'สแตนบาย') {

        reportStatus = 'สแตนบาย';

      }


      /*
       * ถ้าคนเดียวมีมากกว่า 1 record
       * ให้เลือกสถานะที่มีความสำคัญกว่า
       */

      const priority = {
        'ทำงาน': 5,
        'สแตนบาย': 4,
        'ลางาน': 3,
        'วันหยุด': 2,
        'ไม่ระบุ': 1
      };


      const existing =
        driverMap.get(key);


      if (
        !existing ||
        priority[reportStatus] >
        priority[existing.reportStatus]
      ) {

        driverMap.set(key, {

          driver_name:
            row.driver_name || '',

          driver_name_en:
            row.driver_name_en || '',

          status_code:
            row.status || '',

          description:
            description,

          reportStatus:
            reportStatus

        });

      }

    });


    /* =====================================================
       6. BUILD CAR ROWS
    ===================================================== */

    let rows = masterCars.map(car => {

      const plate =
        normalizePlate(car.license_plate);


      const schedule =
        scheduleMap.get(plate);


      let driver =
        schedule?.driver_name || '';


      let driverInfo = null;


      /*
       * หา พขร. จาก driver_shifts
       * โดยพยายาม match ชื่อไทยก่อน
       */

      if (driver) {

        const driverKey =
          normalizeDriver(driver);

        driverInfo =
          driverMap.get(driverKey) || null;

      }


      /*
       * ถ้าจากชื่อไทยไม่เจอ
       * ลองหาแบบ partial match
       */

      if (!driverInfo && driver) {

        const driverKey =
          normalizeDriver(driver);

        for (const [key, value] of driverMap.entries()) {

          if (
            key.includes(driverKey) ||
            driverKey.includes(key)
          ) {

            driverInfo = value;
            break;

          }

        }

      }


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
          schedule ? 'มีงาน' : 'ไม่มีงาน',

        car_status:
          schedule?.car_status || '-',

        planning:
          schedule?.planning || '-',

        lts_no:
          schedule?.lts_no || '-',

        driver_name:
          driver || '-',

        driver_status:
          driverInfo?.reportStatus || 'ไม่ระบุ',

        time_period:
          schedule?.time_period || '-',

        weight_type:
          schedule?.weight_type || '-',

        schedule_count:
          schedule?.schedule_count || 0

      };

    });


    /* =====================================================
       7. FILTER BRANCH
    ===================================================== */

    if (branch) {

      rows =
        rows.filter(
          row => row.branch === branch
        );

    }


    /* =====================================================
       8. CAR SUMMARY
    ===================================================== */

    const totalCars =
      rows.length;


    const jobCars =
      rows.filter(
        row => row.job_status === 'มีงาน'
      ).length;


    const noJobCars =
      rows.filter(
        row => row.job_status === 'ไม่มีงาน'
      ).length;


    document.getElementById(
      'totalCars'
    ).textContent = totalCars;


    document.getElementById(
      'jobCars'
    ).textContent = jobCars;


    document.getElementById(
      'noJobCars'
    ).textContent = noJobCars;


    /* =====================================================
       9. DRIVER SUMMARY
    ===================================================== */

    /*
     * ถ้าเลือกสาขา
     * ต้องกรอง พขร.ตาม พขร.ที่ผูกกับรถในสาขานั้น
     *
     * ถ้าไม่ได้เลือกสาขา
     * ใช้ พขร.ทั้งหมดของวัน
     */

    let selectedDriverKeys;


    if (branch) {

      selectedDriverKeys =
        new Set();


      rows.forEach(row => {

        if (!row.driver_name ||
            row.driver_name === '-') {

          return;

        }


        const key =
          normalizeDriver(row.driver_name);


        if (driverMap.has(key)) {

          selectedDriverKeys.add(key);

        } else {

          for (const driverKey of driverMap.keys()) {

            if (
              driverKey.includes(key) ||
              key.includes(driverKey)
            ) {

              selectedDriverKeys.add(driverKey);
              break;

            }

          }

        }

      });

    } else {

      selectedDriverKeys =
        new Set(driverMap.keys());

    }


    let workingDrivers = 0;
    let offDrivers = 0;
    let leaveDrivers = 0;
    let standbyDrivers = 0;
    let unknownDrivers = 0;


    selectedDriverKeys.forEach(key => {

      const driver =
        driverMap.get(key);

      if (!driver) return;


      switch (driver.reportStatus) {

        case 'ทำงาน':
          workingDrivers++;
          break;

        case 'วันหยุด':
          offDrivers++;
          break;

        case 'ลางาน':
          leaveDrivers++;
          break;

        case 'สแตนบาย':
          standbyDrivers++;
          break;

        default:
          unknownDrivers++;
          break;

      }

    });


    document.getElementById(
      'workingDrivers'
    ).textContent = workingDrivers;


    document.getElementById(
      'offDrivers'
    ).textContent = offDrivers;


    document.getElementById(
      'leaveDrivers'
    ).textContent = leaveDrivers;


    document.getElementById(
      'standbyDrivers'
    ).textContent = standbyDrivers;


    document.getElementById(
      'unknownDrivers'
    ).textContent = unknownDrivers;


    /* =====================================================
       10. REPORT INFO
    ===================================================== */

    document.getElementById(
      'reportInfo'
    ).textContent =
      `วันที่ ${formatThaiDate(reportDate)}`;


    /* =====================================================
       11. RENDER TABLE
    ===================================================== */

    renderDailyTable(rows);


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


/* =========================================================
   RENDER TABLE
========================================================= */

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


      /* ================================================
         CAR STATUS
      ================================================ */

      const statusClass =
        row.job_status === 'มีงาน'
          ? 'status-job'
          : 'status-no-job';


      const jobStatus =
        row.job_status === 'มีงาน'
          ? '🟢 มีงาน'
          : '⚪ ไม่มีงาน';


      /* ================================================
         DRIVER STATUS
      ================================================ */

      let driverStatusClass =
        'driver-unknown';

      let driverStatusText =
        '⚪ ไม่ระบุ';


      switch (row.driver_status) {

        case 'ทำงาน':

          driverStatusClass =
            'driver-work';

          driverStatusText =
            '🟢 ทำงาน';

          break;


        case 'วันหยุด':

          driverStatusClass =
            'driver-off';

          driverStatusText =
            '🟡 วันหยุด';

          break;


        case 'ลางาน':

          driverStatusClass =
            'driver-leave';

          driverStatusText =
            '🔵 ลางาน';

          break;


        case 'สแตนบาย':

          driverStatusClass =
            'driver-standby';

          driverStatusText =
            '🟠 สแตนบาย';

          break;


        default:

          driverStatusClass =
            'driver-unknown';

          driverStatusText =
            '⚪ ไม่ระบุ';

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
              ${driverStatusText}
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


/* =========================================================
   LOAD BRANCHES
========================================================= */

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


    branches.forEach(branch => {

      const option =
        document.createElement(
          'option'
        );


      option.value =
        branch;

      option.textContent =
        branch;


      select.appendChild(option);

    });


  } catch (error) {

    console.error(
      'Load Branch Error:',
      error
    );

  }

}


/* =========================================================
   DEFAULT DATE
========================================================= */

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


/* =========================================================
   THAI DATE
========================================================= */

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


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(value) {

  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

}


/* =========================================================
   INIT
========================================================= */

document.addEventListener(
  'DOMContentLoaded',
  async () => {

    setDefaultDate();

    await loadBranches();

    await loadDailyReport();


    document
      .getElementById('reportDate')
      .addEventListener(
        'change',
        loadDailyReport
      );


    document
      .getElementById('branchFilter')
      .addEventListener(
        'change',
        loadDailyReport
      );

  }
