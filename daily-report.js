// ============================================================
// DAILY REPORT
// รายงานประจำวัน - รถทั้งหมดจาก Master Car
// ============================================================

const SUPABASE_URL = 'https://hhsqijlcebaijtklskag.supabase.co';

// ใช้ Publishable Key เท่านั้น
// ใส่ค่าเดียวกับที่ใช้ใน app.js ปัจจุบัน
const SUPABASE_KEY = 'ใส่_PUBLISHABLE_KEY_ตัวเดิมของคุณตรงนี้';


// ============================================================
// SUPABASE FETCH
// ============================================================

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


// ============================================================
// NORMALIZE
// ============================================================

function normalizePlate(value) {

  return String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();

}


// ============================================================
// FORMAT DATE
// ============================================================

function formatThaiDate(dateString) {

  if (!dateString) return '-';

  const [year, month, day] = dateString.split('-');

  return `${day}/${month}/${year}`;

}


// ============================================================
// LOAD DATA
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
      <td colspan="11" class="loading">
        กำลังโหลดข้อมูล...
      </td>
    </tr>
  `;

  try {

    // --------------------------------------------------------
    // 1. ดึง Master Car ทั้งหมด
    // --------------------------------------------------------

    const masterCars = await supabaseFetch(
      'master_cars',
      'select=branch,car_no,license_plate,vehicle_type'
    );


    // --------------------------------------------------------
    // 2. ดึง Schedule เฉพาะวันที่เลือก
    // --------------------------------------------------------

    const schedules = await supabaseFetch(
      'v_daily_report',
      `work_date=eq.${encodeURIComponent(reportDate)}&select=license_plate,work_date,job_status,car_status,planning,lts_no,driver_name,time_period,weight_type,schedule_count`
    );


    // --------------------------------------------------------
    // 3. Map Schedule ตามทะเบียน
    // --------------------------------------------------------

    const scheduleMap = new Map();

    schedules.forEach(row => {

      const plate =
        normalizePlate(row.license_plate);

      if (!plate) return;

      scheduleMap.set(plate, row);

    });


    // --------------------------------------------------------
    // 4. รวม Master Car + Schedule
    // --------------------------------------------------------

    let rows = masterCars.map(car => {

      const plate =
        normalizePlate(car.license_plate);

      const schedule =
        scheduleMap.get(plate);

      return {

        branch: car.branch || '-',

        car_no: car.car_no || '-',

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

        driver_name:
          schedule?.driver_name || '-',

        time_period:
          schedule?.time_period || '-',

        weight_type:
          schedule?.weight_type || '-',

        schedule_count:
          schedule?.schedule_count || 0

      };

    });


    // --------------------------------------------------------
    // 5. Filter สาขา
    // --------------------------------------------------------

    if (branch) {

      rows = rows.filter(
        row => row.branch === branch
      );

    }


    // --------------------------------------------------------
    // 6. Summary
    // --------------------------------------------------------

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


    document.getElementById('totalCars')
      .textContent = totalCars;

    document.getElementById('jobCars')
      .textContent = jobCars;

    document.getElementById('noJobCars')
      .textContent = noJobCars;


    // --------------------------------------------------------
    // 7. Render Table
    // --------------------------------------------------------

    renderDailyTable(rows);


  } catch (error) {

    console.error(
      'Daily Report Error:',
      error
    );

    tbody.innerHTML = `
      <tr>
        <td colspan="11" class="loading">
          โหลดข้อมูลไม่สำเร็จ
          <br>
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
    document.getElementById('reportTableBody');

  if (!rows.length) {

    tbody.innerHTML = `
      <tr>
        <td colspan="11" class="loading">
          ไม่พบข้อมูล
        </td>
      </tr>
    `;

    return;
  }


  tbody.innerHTML =
    rows.map(row => {

      const statusClass =
        row.job_status === 'มีงาน'
          ? 'status-job'
          : 'status-no-job';


      return `
        <tr>

          <td>${escapeHtml(row.branch)}</td>

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
              ${row.job_status === 'มีงาน'
                ? '🟢 มีงาน'
                : '⚪ ไม่มีงาน'}
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
// LOAD BRANCHES
// ============================================================

async function loadBranches() {

  try {

    const cars = await supabaseFetch(
      'master_cars',
      'select=branch'
    );

    const branches = [
      ...new Set(
        cars
          .map(row => row.branch)
          .filter(Boolean)
      )
    ].sort();


    const select =
      document.getElementById('branchFilter');


    branches.forEach(branch => {

      const option =
        document.createElement('option');

      option.value = branch;
      option.textContent = branch;

      select.appendChild(option);

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
    document.getElementById('reportDate');

  const today =
    new Date();

  const year =
    today.getFullYear();

  const month =
    String(today.getMonth() + 1)
      .padStart(2, '0');

  const day =
    String(today.getDate())
      .padStart(2, '0');

  input.value =
    `${year}-${month}-${day}`;

}


// ============================================================
// EVENTS
// ============================================================

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
);
