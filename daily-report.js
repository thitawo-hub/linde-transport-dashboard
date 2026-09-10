```javascript
const SUPABASE_URL =
  'https://hhsqijlcebaijtklskag.supabase.co';

// ใช้ Publishable Key เท่านั้น
const SUPABASE_KEY =
  'sb_publishable_z5-j4hCd7dJ50-sLaUKraw_ZgM9ZA4W';


/* =========================================================
   SUPABASE
========================================================= */

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

      const text = await response.text();

      throw new Error(
        `Supabase ${table} ${response.status}: ${text}`
      );
    }

    const data = await response.json();

    if (!Array.isArray(data)) {

      throw new Error(
        `ข้อมูล ${table} ไม่ใช่ Array`
      );
    }

    allData = allData.concat(data);

    if (data.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return allData;
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


/*
 * Normalize key สำหรับจับคู่ พขร.
 *
 * ตัด "นาย" / "นาง" / "นางสาว"
 * เพื่อให้ชื่อจากแต่ละชีทจับคู่กันง่ายขึ้น
 */
function normalizeDriverKey(value) {

  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^(นาย|นางสาว|นาง)\s*/i, '')
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

    const masterCars =
      await supabaseFetch(
        'master_cars',
        'select=branch,car_no,license_plate,vehicle_type'
      );


    /* =====================================================
       2. MASTER PERSON
       
       ใช้เป็น "แหล่งชื่อ พขร. ตัวจริง"
    ===================================================== */

    const masterDrivers =
      await supabaseFetch(
        'master_drivers',
        'select=branch,driver_name,driver_name_en,position,resigned_date,driver_key'
      );


    /* =====================================================
       3. DAILY VEHICLE SCHEDULE
    ===================================================== */

    const schedules =
      await supabaseFetch(
        'v_daily_report',
        `work_date=eq.${encodeURIComponent(reportDate)}` +
        `&select=branch,license_plate,work_date,job_status,car_status,planning,lts_no,driver_name,time_period,weight_type,schedule_count`
      );


    /* =====================================================
       4. DRIVER SHIFTS
       
       ใช้สถานะประจำวันของ พขร.
    ===================================================== */

    const driverShifts =
      await supabaseFetch(
        'driver_shifts',
        `work_date=eq.${encodeURIComponent(reportDate)}` +
        `&select=driver_name,driver_name_en,driver_key,status,description`
      );


    /* =====================================================
       5. BUILD MASTER DRIVER MAP
       
       ทุกชื่อที่แสดงบนหน้าเว็บ
       จะต้องอ้างอิงจาก Master Person
    ===================================================== */

    const masterDriverMap =
      new Map();


    masterDrivers.forEach(driver => {

      const thaiName =
        String(driver.driver_name || '').trim();

      const englishName =
        String(driver.driver_name_en || '').trim();

      const driverKey =
        String(driver.driver_key || '').trim();

      if (!thaiName && !englishName && !driverKey) {
        return;
      }


      const info = {

        driver_name:
          thaiName,

        driver_name_en:
          englishName,

        driver_key:
          driverKey,

        branch:
          String(driver.branch || '').trim(),

        position:
          String(driver.position || '').trim(),

        resigned_date:
          driver.resigned_date || null

      };


      /*
       * ใช้ driver_key เป็นหลัก
       */
      if (driverKey) {

        masterDriverMap.set(
          normalizeDriverKey(driverKey),
          info
        );

      }


      /*
       * ชื่อไทย
       */
      if (thaiName) {

        masterDriverMap.set(
          normalizeDriverKey(thaiName),
          info
        );

      }


      /*
       * ชื่อ EN
       */
      if (englishName) {

        masterDriverMap.set(
          normalizeDriverKey(englishName),
          info
        );

      }

    });


    /* =====================================================
       6. FUNCTION MATCH MASTER DRIVER
    ===================================================== */

    function findMasterDriver(row) {

      const candidates = [

        row.driver_key,

        row.driver_name,

        row.driver_name_en

      ];


      /*
       * Exact match ก่อน
       */

      for (const candidate of candidates) {

        const key =
          normalizeDriverKey(candidate);

        if (!key) continue;

        const found =
          masterDriverMap.get(key);

        if (found) {
          return found;
        }

      }


      /*
       * Partial match เป็น fallback
       *
       * ใช้เฉพาะกรณีชื่อมี prefix / spacing ต่างกัน
       */

      const normalizedCandidates =
        candidates
          .map(normalizeDriverKey)
          .filter(Boolean);


      for (const candidate of normalizedCandidates) {

        for (const [masterKey, master] of masterDriverMap.entries()) {

          if (
            masterKey.includes(candidate) ||
            candidate.includes(masterKey)
          ) {

            return master;

          }

        }

      }


      return null;

    }


    /* =====================================================
       7. MAP VEHICLE SCHEDULE
       
       ถ้ารถมีหลาย schedule
       v_daily_report จะ aggregate แล้ว 1 รถ = 1 row
    ===================================================== */

    const scheduleMap =
      new Map();


    schedules.forEach(row => {

      const plate =
        normalizePlate(row.license_plate);

      if (!plate) return;

      scheduleMap.set(
        plate,
        row
      );

    });


    /* =====================================================
       8. MAP DRIVER SHIFT
       
       1 คน = 1 สถานะ
       
       ถ้ามีหลาย record ในวันเดียวกัน
       ใช้ Priority:
       
       ทำงาน
       ↓
       สแตนบาย
       ↓
       ลางาน
       ↓
       วันหยุด
       ↓
       ไม่ระบุ
    ===================================================== */

    const driverMap =
      new Map();


    const priority = {

      'ทำงาน': 5,

      'สแตนบาย': 4,

      'ลางาน': 3,

      'วันหยุด': 2,

      'ไม่ระบุ': 1

    };


    driverShifts.forEach(row => {

      const master =
        findMasterDriver(row);


      /*
       * ถ้า match Master Person ไม่ได้
       * ไม่เอาไปนับเป็น พขร.
       */
      if (!master) {
        return;
      }


      /*
       * ถ้ามีวันลาออกแล้ว
       * ไม่เอามานับใน พขร.ปัจจุบัน
       */
      if (master.resigned_date) {
        return;
      }


      const masterKey =
        normalizeDriverKey(
          master.driver_key ||
          master.driver_name ||
          master.driver_name_en
        );


      if (!masterKey) {
        return;
      }


      const description =
        String(row.description || '').trim();


      let reportStatus =
        'ไม่ระบุ';


      if (description === 'ทำงาน') {

        reportStatus = 'ทำงาน';

      }

      else if (description === 'วันหยุด') {

        reportStatus = 'วันหยุด';

      }

      else if (description === 'ลางาน') {

        reportStatus = 'ลางาน';

      }

      else if (description === 'สแตนบาย') {

        reportStatus = 'สแตนบาย';

      }


      const existing =
        driverMap.get(masterKey);


      /*
       * คนเดียวกันมีหลาย record
       * เก็บสถานะที่ Priority สูงกว่า
       */

      if (
        !existing ||
        priority[reportStatus] >
        priority[existing.reportStatus]
      ) {

        driverMap.set(
          masterKey,
          {

            driver_name:
              master.driver_name || '',

            driver_name_en:
              master.driver_name_en || '',

            driver_key:
              master.driver_key || '',

            branch:
              master.branch || '',

            position:
              master.position || '',

            status_code:
              row.status || '',

            description:
              description,

            reportStatus:
              reportStatus

          }
        );

      }

    });


    /* =====================================================
       9. BUILD CAR ROWS
       
       สำคัญ:
       driver_name ที่แสดง
       = ชื่อจาก Master Person เท่านั้น
    ===================================================== */

    let rows =
      masterCars.map(car => {

        const plate =
          normalizePlate(car.license_plate);


        const schedule =
          scheduleMap.get(plate);


        let masterDriver =
          null;


        /*
         * หา พขร.จากตารางจัดรถ
         * แล้ว MATCH กลับ Master Person
         */

        if (schedule?.driver_name) {

          masterDriver =
            findMasterDriver({
              driver_name:
                schedule.driver_name
            });

        }


        /*
         * ถ้าหาไม่ได้จากชื่อไทย
         * ไม่แสดงค่าดิบ
         *
         * ป้องกันไม่ให้รหัส / ชื่อผิดรูปแบบ
         * หลุดขึ้นหน้า Dashboard
         */

        const driverName =
          masterDriver?.driver_name || '';


        const driverKey =
          normalizeDriverKey(
            masterDriver?.driver_key ||
            masterDriver?.driver_name ||
            masterDriver?.driver_name_en
          );


        const driverInfo =
          driverKey
            ? driverMap.get(driverKey)
            : null;


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
           * ใช้ชื่อจาก Master Person
           */
          driver_name:
            driverName || '-',

          driver_key:
            driverKey,

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
       10. FILTER BRANCH
    ===================================================== */

    if (branch) {

      rows =
        rows.filter(
          row =>
            row.branch === branch
        );

    }


    /* =====================================================
       11. CAR SUMMARY
    ===================================================== */

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


    /* =====================================================
       12. DRIVER SUMMARY
       
       นับจาก Master Person
       + driver_shifts
       + ไม่ซ้ำคน
       
       ถ้าเลือกสาขา:
       ใช้ พขร.ที่ผูกกับรถของสาขานั้น
       
       ถ้าไม่เลือกสาขา:
       ใช้ พขร.ทั้งหมดใน Master ที่มี Shift วันนี้
    ===================================================== */


    const selectedDriverKeys =
      new Set();


    if (branch) {

      /*
       * เฉพาะ พขร.ที่อยู่กับรถในสาขาที่เลือก
       */

      rows.forEach(row => {

        if (
          !row.driver_key
        ) {
          return;
        }

        selectedDriverKeys.add(
          row.driver_key
        );

      });

    }

    else {

      /*
       * ทุก พขร.ที่มีสถานะวันนี้
       */

      driverMap.forEach(
        (driver, key) => {

          selectedDriverKeys.add(
            key
          );

        }
      );

    }


    let workingDrivers = 0;

    let offDrivers = 0;

    let leaveDrivers = 0;

    let standbyDrivers = 0;

    let unknownDrivers = 0;


    selectedDriverKeys.forEach(key => {

      const driver =
        driverMap.get(key);


      if (!driver) {
        return;
      }


      switch (
        driver.reportStatus
      ) {

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


    /* =====================================================
       13. REPORT INFO
    ===================================================== */

    document.getElementById(
      'reportInfo'
    ).textContent =
      `วันที่ ${formatThaiDate(reportDate)}`;


    /* =====================================================
       14. RENDER TABLE
    ===================================================== */

    renderDailyTable(rows);


  }

  catch (error) {

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


      switch (
        row.driver_status
      ) {

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
            ${escapeHtml(
              row.branch
            )}
          </td>


          <td>
            <strong>
              ${escapeHtml(
                row.car_no
              )}
            </strong>
          </td>


          <td>
            ${escapeHtml(
              row.license_plate
            )}
          </td>


          <td>
            ${escapeHtml(
              row.vehicle_type
            )}
          </td>


          <td>
            <span
              class="status ${statusClass}"
            >
              ${jobStatus}
            </span>
          </td>


          <td>
            ${escapeHtml(
              row.car_status
            )}
          </td>


          <td>
            ${escapeHtml(
              row.planning
            )}
          </td>


          <td>
            ${escapeHtml(
              row.lts_no
            )}
          </td>


          <td>
            ${
              row.driver_name &&
              row.driver_name !== '-'
                ? `<strong>${escapeHtml(
                    row.driver_name
                  )}</strong>`
                : '-'
            }
          </td>


          <td>
            <span
              class="driver-status ${driverStatusClass}"
            >
              ${driverStatusText}
            </span>
          </td>


          <td>
            ${escapeHtml(
              row.time_period
            )}
          </td>


          <td>
            ${escapeHtml(
              row.weight_type
            )}
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
            .map(
              row =>
                String(
                  row.branch || ''
                ).trim()
            )
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
      '<option value="">ทุกสาขา</option>';


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


  }

  catch (error) {

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
    ).padStart(
      2,
      '0'
    );


  const day =
    String(
      today.getDate()
    ).padStart(
      2,
      '0'
    );


  input.value =
    `${year}-${month}-${day}`;

}


/* =========================================================
   THAI DATE
========================================================= */

function formatThaiDate(value) {

  if (!value) {
    return '-';
  }


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
```
