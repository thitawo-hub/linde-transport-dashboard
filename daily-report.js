// ============================================================
// LINDE TRANSPORT
// DAILY REPORT
//
// โครงสร้างข้อมูล
//
// 🚛 รถ
// master_cars
// vehicle_schedules
//
// 👨‍✈️ พขร.
// driver_shifts
//   driver_name = ชื่อ พขร.
//   description = สถานะ พขร.
//
// ============================================================


const SUPABASE_URL =
  'https://hhsqijlcebaijtklskag.supabase.co';

const SUPABASE_KEY =
  'sb_publishable_z5-j4hCd7dJ50-sLaUKraw_ZgM9ZA4W';


// ============================================================
// SUPABASE FETCH
// ============================================================

async function supabaseFetch(table, params = '') {

  const pageSize = 1000;

  let offset = 0;

  let allData = [];


  while (true) {

    const separator =
      params ? '&' : '';

    const url =
      `${SUPABASE_URL}/rest/v1/${table}?` +
      `${params}${separator}` +
      `limit=${pageSize}&offset=${offset}`;


    const response =
      await fetch(url, {

        method: 'GET',

        headers: {

          'apikey':
            SUPABASE_KEY,

          'Authorization':
            `Bearer ${SUPABASE_KEY}`,

          'Content-Type':
            'application/json'

        }

      });


    if (!response.ok) {

      const errorText =
        await response.text();

      throw new Error(
        `Supabase ${table} ${response.status}: ${errorText}`
      );
    }


    const data =
      await response.json();


    if (!Array.isArray(data)) {

      throw new Error(
        `${table} ไม่ใช่ Array`
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

function normalizeText(value) {

  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}


function normalizePlate(value) {

  return String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}


// ============================================================
// STATUS
//
// ใช้ description จาก driver_shifts โดยตรง
// ============================================================

function normalizeDriverStatus(value) {

  return normalizeText(value);
}


// ============================================================
// STATUS GROUP
// ============================================================

function getStatusGroup(status) {

  const s =
    normalizeDriverStatus(status);


  // ทำงาน
  if (
    s === 'ทำงาน' ||
    s === 'วิ่งงาน' ||
    s === 'วิ่งงาน LOCO' ||
    s === 'งานมหาชัย' ||
    s === 'OT' ||
    s === 'ช่วยงาน' ||
    s === 'พขร.ใหม่'
  ) {

    return 'working';
  }


  // สแตนบาย
  if (s === 'สแตนบาย') {

    return 'standby';
  }


  // เบรค
  if (
    s === 'เบรค' ||
    s === 'เบรก'
  ) {

    return 'break';
  }


  // วันหยุด
  if (
    s === 'วันหยุดประจำสัปดาห์' ||
    s === 'วันหยุดนักขัตฤกษ์'
  ) {

    return 'off';
  }


  // ลา
  if (
    s === 'ลาพักร้อน' ||
    s === 'ลาป่วย' ||
    s === 'ลากิจ' ||
    s === 'ลาหยุดโดยไม่ขอรับเงินเดือน' ||
    s === 'ลาหยุดโดยไม่รับเงินเดือน' ||
    s === 'ลาออก'
  ) {

    return 'leave';
  }


  // อื่น ๆ
  return 'other';
}


// ============================================================
// STATUS ICON
// ============================================================

function getStatusIcon(status) {

  switch (
    getStatusGroup(status)
  ) {

    case 'working':
      return '🟢';

    case 'standby':
      return '🟠';

    case 'break':
      return '🔴';

    case 'off':
      return '🟡';

    case 'leave':
      return '🔵';

    default:
      return '⚪';

  }
}


// ============================================================
// LOAD DAILY REPORT
// ============================================================

async function loadDailyReport() {

  const reportDate =
    document.getElementById(
      'reportDate'
    ).value;


  const branch =
    document.getElementById(
      'branchFilter'
    ).value;


  if (!reportDate) {
    return;
  }


  const tbody =
    document.getElementById(
      'reportTableBody'
    );


  tbody.innerHTML = `
    <tr>
      <td colspan="12" class="loading">
        กำลังโหลดข้อมูล...
      </td>
    </tr>
  `;


  try {

    // ========================================================
    // โหลดข้อมูล 3 ชุดพร้อมกัน
    // ========================================================

    const [
      masterCars,
      schedules,
      driverShifts
    ] = await Promise.all([

      supabaseFetch(
        'master_cars',
        'select=branch,car_no,license_plate,vehicle_type'
      ),

      supabaseFetch(
        'v_daily_report',
        `work_date=eq.${encodeURIComponent(reportDate)}` +
        `&select=license_plate,work_date,job_status,car_status,planning,lts_no,time_period,weight_type,schedule_count`
      ),

      supabaseFetch(
        'driver_shifts',
        `work_date=eq.${encodeURIComponent(reportDate)}` +
        `&select=driver_name,driver_name_en,description,driver_key`
      )

    ]);


    console.log(
      'Master Cars:',
      masterCars.length
    );

    console.log(
      'Schedules:',
      schedules.length
    );

    console.log(
      'Driver Shifts:',
      driverShifts.length
    );


    // ========================================================
    // 1. สร้าง MAP รถ
    // ========================================================

    const scheduleMap =
      new Map();


    schedules.forEach(row => {

      const plate =
        normalizePlate(
          row.license_plate
        );


      if (!plate || plate === '-') {
        return;
      }


      scheduleMap.set(
        plate,
        row
      );

    });


    // ========================================================
    // 2. สร้าง MAP พขร.
    //
    // สำคัญ:
    //
    // driver_name = ชื่อ
    // description = สถานะ
    //
    // ไม่ใช้ status
    // ========================================================

    const driverMap =
      new Map();


    driverShifts.forEach(row => {

      const name =
        normalizeText(
          row.driver_name
        );


      if (!name) {
        return;
      }


      const status =
        normalizeDriverStatus(
          row.description
        );


      const key =
        row.driver_key
          ? normalizeText(
              row.driver_key
            )
          : name;


      const existing =
        driverMap.get(key);


      /*
       * ถ้ามีชื่อเดียวกันหลายแถว
       * ให้เก็บข้อมูลล่าสุดตามลำดับข้อมูล
       *
       * เพราะ description คือสถานะจริง
       */

      driverMap.set(
        key,
        {

          driver_key:
            key,

          driver_name:
            name,

          driver_name_en:
            normalizeText(
              row.driver_name_en
            ),

          status:
            status || 'ไม่ระบุ',

          group:
            getStatusGroup(status)

        }
      );

    });


    // ========================================================
    // 3. DRIVER NAME INDEX
    // ========================================================

    const driverNameMap =
      new Map();


    driverMap.forEach(
      driver => {

        const name =
          normalizeText(
            driver.driver_name
          );


        if (name) {

          driverNameMap.set(
            name,
            driver
          );

        }

      }
    );


    // ========================================================
    // 4. สร้างตารางรถ
    //
    // พขร. ตรงนี้ใช้จาก vehicle_schedules
    // เพราะเป็นคนที่ถูกจัดกับรถ
    // ========================================================

    let carRows =
      masterCars.map(car => {

        const plate =
          normalizePlate(
            car.license_plate
          );


        const schedule =
          scheduleMap.get(
            plate
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
           * ชื่อจากตารางจัดรถ
           */
          driver_name:
            normalizeText(
              schedule?.driver_name
            ) || '-',

          time_period:
            schedule?.time_period || '-',

          weight_type:
            schedule?.weight_type || '-',

          schedule_count:
            schedule?.schedule_count || 0

        };

      });


    // ========================================================
    // 5. FILTER สาขา
    // ========================================================

    if (branch) {

      carRows =
        carRows.filter(
          row =>
            row.branch === branch
        );

    }


    // ========================================================
    // 6. CARD รถ
    // ========================================================

    const totalCars =
      carRows.length;


    const jobCars =
      carRows.filter(
        row =>
          row.job_status === 'มีงาน'
      ).length;


    const noJobCars =
      carRows.filter(
        row =>
          row.job_status === 'ไม่มีงาน'
      ).length;


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


    // ========================================================
    // 7. พขร.
    //
    // ส่วนนี้ "ไม่อิงรถ"
    //
    // ใช้ driver_shifts โดยตรง
    // ========================================================

    let drivers =
      Array.from(
        driverMap.values()
      );


    /*
     * ถ้าเลือกสาขา
     *
     * ใช้ พขร.ที่ถูกจัดรถในสาขานั้น
     * แต่ข้อมูลสถานะยังมาจาก driver_shifts
     */

    if (branch) {

      const driverNamesInBranch =
        new Set();


      carRows.forEach(row => {

        const name =
          normalizeText(
            row.driver_name
          );


        if (
          name &&
          name !== '-'
        ) {

          driverNamesInBranch.add(
            name
          );

        }

      });


      drivers =
        drivers.filter(
          driver =>
            driverNamesInBranch.has(
              driver.driver_name
            )
        );

    }


    // ========================================================
    // 8. นับสถานะ พขร.
    // ========================================================

    const statusCounts = {

      working: 0,

      standby: 0,

      break: 0,

      off: 0,

      leave: 0,

      other: 0

    };


    drivers.forEach(
      driver => {

        statusCounts[
          driver.group
        ]++;

      }
    );


    // ========================================================
    // 9. CARD พขร.
    // ========================================================

    /*
     * พขร.ทั้งหมด
     */

    setText(
      'totalDrivers',
      drivers.length
    );


    /*
     * ทำงาน
     */

    setText(
      'workingDrivers',
      statusCounts.working
    );


    /*
     * วันหยุด
     */

    setText(
      'offDrivers',
      statusCounts.off
    );


    /*
     * ลางาน
     */

    setText(
      'leaveDrivers',
      statusCounts.leave
    );


    /*
     * สแตนบาย
     */

    setText(
      'standbyDrivers',
      statusCounts.standby
    );


    /*
     * เบรค
     *
     * ถ้า HTML มี id นี้
     * จะแสดงให้ทันที
     */

    setText(
      'breakDrivers',
      statusCounts.break
    );


    /*
     * อื่น ๆ
     */

    setText(
      'otherDrivers',
      statusCounts.other
    );


    // ========================================================
    // 10. ตาราง พขร.
    // ========================================================

    renderDriverTable(
      drivers,
      carRows
    );


    // ========================================================
    // 11. ตารางรถ
    // ========================================================

    renderCarTable(
      carRows,
      tbody
    );


    // ========================================================
    // 12. REPORT INFO
    // ========================================================

    setText(
      'reportInfo',
      `วันที่ ${formatThaiDate(reportDate)}`
    );


    console.log(
      'DAILY REPORT',
      {
        cars:
          totalCars,

        jobCars:
          jobCars,

        noJobCars:
          noJobCars,

        drivers:
          drivers.length,

        working:
          statusCounts.working,

        standby:
          statusCounts.standby,

        break:
          statusCounts.break,

        off:
          statusCounts.off,

        leave:
          statusCounts.leave,

        other:
          statusCounts.other
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
          ${escapeHtml(
            error.message
          )}
        </td>
      </tr>
    `;

  }

}


// ============================================================
// RENDER DRIVER TABLE
//
// ถ้า HTML มี #driverTableBody
// จะสร้างตาราง พขร. แยกให้
// ============================================================

function renderDriverTable(
  drivers,
  carRows
) {

  const tbody =
    document.getElementById(
      'driverTableBody'
    );


  if (!tbody) {
    return;
  }


  /*
   * map รถ -> พขร.
   */

  const carByDriver =
    new Map();


  carRows.forEach(row => {

    const name =
      normalizeText(
        row.driver_name
      );


    if (
      !name ||
      name === '-'
    ) {
      return;
    }


    if (
      !carByDriver.has(name)
    ) {

      carByDriver.set(
        name,
        row
      );

    }

  });


  if (!drivers.length) {

    tbody.innerHTML = `
      <tr>
        <td colspan="4">
          ไม่พบข้อมูล พขร.
        </td>
      </tr>
    `;

    return;
  }


  tbody.innerHTML =
    drivers
      .sort(
        (a, b) =>
          a.driver_name.localeCompare(
            b.driver_name,
            'th'
          )
      )
      .map(driver => {

        const car =
          carByDriver.get(
            driver.driver_name
          );


        const icon =
          getStatusIcon(
            driver.status
          );


        return `
          <tr>

            <td>
              <strong>
                ${escapeHtml(
                  driver.driver_name
                )}
              </strong>
            </td>

            <td>
              <span class="driver-status">
                ${icon}
                ${escapeHtml(
                  driver.status
                )}
              </span>
            </td>

            <td>
              ${
                car
                  ? escapeHtml(
                      car.car_no
                    )
                  : '-'
              }
            </td>

            <td>
              ${
                car
                  ? escapeHtml(
                      car.license_plate
                    )
                  : '-'
              }
            </td>

          </tr>
        `;

      })
      .join('');

}


// ============================================================
// RENDER CAR TABLE
// ============================================================

function renderCarTable(
  rows,
  tbody
) {

  if (!rows.length) {

    tbody.innerHTML = `
      <tr>
        <td colspan="12">
          ไม่พบข้อมูลรถ
        </td>
      </tr>
    `;

    return;
  }


  tbody.innerHTML =
    rows
      .map(row => {

        const jobClass =
          row.job_status === 'มีงาน'
            ? 'status-job'
            : 'status-no-job';


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
              <span class="status ${jobClass}">
                ${
                  row.job_status === 'มีงาน'
                    ? '🟢 มีงาน'
                    : '⚪ ไม่มีงาน'
                }
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
              ${escapeHtml(
                row.driver_name
              )}
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

            <td>
              ${escapeHtml(
                row.schedule_count
              )}
            </td>

          </tr>
        `;

      })
      .join('');

}


// ============================================================
// BRANCH
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
            .map(
              row =>
                normalizeText(
                  row.branch
                )
            )
            .filter(Boolean)
        )
      ]
      .sort(
        (a, b) =>
          a.localeCompare(
            b,
            'th'
          )
      );


    const select =
      document.getElementById(
        'branchFilter'
      );


    if (!select) {
      return;
    }


    select.innerHTML =
      '<option value="">ทั้งหมด</option>';


    branches.forEach(
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


  if (!input) {
    return;
  }


  const today =
    new Date();


  const year =
    today.getFullYear();


  const month =
    String(
      today.getMonth() + 1
    )
    .padStart(
      2,
      '0'
    );


  const day =
    String(
      today.getDate()
    )
    .padStart(
      2,
      '0'
    );


  input.value =
    `${year}-${month}-${day}`;

}


// ============================================================
// HELPERS
// ============================================================

function setText(
  id,
  value
) {

  const el =
    document.getElementById(id);


  if (el) {

    el.textContent =
      value;

  }

}


function formatThaiDate(
  value
) {

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


  return `
    ${day}
    ${months[month]}
    ${year}
  `;
}


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
// INIT
// ============================================================

document.addEventListener(
  'DOMContentLoaded',
  async () => {

    setDefaultDate();

    await loadBranches();

    await loadDailyReport();


    const dateInput =
      document.getElementById(
        'reportDate'
      );


    if (dateInput) {

      dateInput.addEventListener(
        'change',
        loadDailyReport
      );

    }


    const branchInput =
      document.getElementById(
        'branchFilter'
      );


    if (branchInput) {

      branchInput.addEventListener(
        'change',
        loadDailyReport
      );

    }

  }
);
