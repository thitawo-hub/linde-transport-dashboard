const SUPABASE_URL = 'https://hhsqijlcebaijtklskag.supabase.co';
const SUPABASE_KEY = 'sb_publishable_z5-j4hCd7dJ50-sLaUKraw_ZgM9ZA4W';


/* =========================================================
   SUPABASE
========================================================= */

async function getDashboardData() {

  const url =
    `${SUPABASE_URL}/rest/v1/v_dashboard?select=*`;

  const response = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`
    }
  });

  if (!response.ok) {
    throw new Error(`Supabase Error ${response.status}`);
  }

  return await response.json();
}


/* =========================================================
   FORMAT
========================================================= */

function formatNumber(value, decimals = 0) {

  if (
    value === null ||
    value === undefined ||
    value === '' ||
    Number.isNaN(Number(value))
  ) {
    return '-';
  }

  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}


/* =========================================================
   UNIQUE MASTER DATA
   v_dashboard มีหลายแถวต่อสาขา
   ดังนั้น Master Car / Master Driver ต้องนับครั้งเดียวต่อสาขา
========================================================= */

function getBranchMasterData(data) {

  const branchMap = new Map();

  data.forEach(row => {

    const branch = String(row.branch || '').trim();

    if (!branch) return;

    if (!branchMap.has(branch)) {

      branchMap.set(branch, {
        branch: branch,

        actual_coco_cars:
          Number(row.actual_coco_cars || 0),

        actual_coco_drivers:
          Number(row.actual_coco_drivers || 0),

        actual_driver_ratio:
          row.actual_driver_ratio !== null &&
          row.actual_driver_ratio !== undefined
            ? Number(row.actual_driver_ratio)
            : null,

        target_km_per_car:
          row.target_km_per_car !== null &&
          row.target_km_per_car !== undefined
            ? Number(row.target_km_per_car)
            : null
      });

    }

  });

  return Array.from(branchMap.values());
}


/* =========================================================
   UPDATE DASHBOARD
========================================================= */

function updateDashboard(data, selectedBranch = '') {

  const status = document.getElementById('status');

  if (!data || data.length === 0) {

    status.textContent =
      'ไม่พบข้อมูลจาก Supabase';

    return;
  }


  /* -------------------------------------------------------
     เอาเฉพาะข้อมูล Master ที่ไม่ซ้ำสาขา
  ------------------------------------------------------- */

  const branchData = getBranchMasterData(data);


  /* -------------------------------------------------------
     FILTER สาขา
  ------------------------------------------------------- */

  let selectedData;

  if (selectedBranch) {

    selectedData = branchData.filter(
      item => item.branch === selectedBranch
    );

  } else {

    selectedData = branchData;

  }


  /* -------------------------------------------------------
     รถ COCO
  ------------------------------------------------------- */

  const cocoCars = selectedData.reduce(
    (sum, item) =>
      sum + Number(item.actual_coco_cars || 0),
    0
  );


  /* -------------------------------------------------------
     พขร.
  ------------------------------------------------------- */

  const cocoDrivers = selectedData.reduce(
    (sum, item) =>
      sum + Number(item.actual_coco_drivers || 0),
    0
  );


  /* -------------------------------------------------------
     DRIVER RATIO
     
     สำคัญ:
     ไม่เฉลี่ย Ratio ของแต่ละสาขา
     
     ต้องคำนวณจาก:
     พขร. ÷ รถ
  ------------------------------------------------------- */

  const driverRatio =
    cocoCars > 0
      ? cocoDrivers / cocoCars
      : null;


  /* -------------------------------------------------------
     TARGET KM
     
     ถ้าเลือกสาขา → แสดง Target ของสาขานั้น
     
     ถ้า "ทุกสาขา" → ไม่เอา MAX มั่ว ๆ
  ------------------------------------------------------- */

  let targetKm = null;

  if (selectedBranch && selectedData.length > 0) {

    targetKm = selectedData[0].target_km_per_car;

  }


  /* -------------------------------------------------------
     UPDATE CARD
  ------------------------------------------------------- */

  document.getElementById('cocoCars').textContent =
    formatNumber(cocoCars);


  document.getElementById('cocoDrivers').textContent =
    formatNumber(cocoDrivers);


  document.getElementById('driverRatio').textContent =
    formatNumber(driverRatio, 2);


  document.getElementById('targetKm').textContent =
    targetKm !== null
      ? formatNumber(targetKm)
      : '-';


  /* -------------------------------------------------------
     STATUS
  ------------------------------------------------------- */

  if (selectedBranch) {

    status.textContent =
      `สาขา ${selectedBranch} • เชื่อมต่อ Supabase สำเร็จ`;

  } else {

    status.textContent =
      `ทุกสาขา • เชื่อมต่อ Supabase สำเร็จ • ${branchData.length} สาขา`;

  }

}


/* =========================================================
   BRANCH FILTER
========================================================= */

function setupBranchFilter(data) {

  const filter =
    document.getElementById('branchFilter');

  if (!filter) return;


  /* -------------------------------------------------------
     รายชื่อสาขาจากข้อมูลจริง
  ------------------------------------------------------- */

  const branches = [
    ...new Set(
      data
        .map(row => String(row.branch || '').trim())
        .filter(Boolean)
    )
  ];


  /* -------------------------------------------------------
     สร้าง Option ใหม่
  ------------------------------------------------------- */

  filter.innerHTML = '';

  const allOption =
    document.createElement('option');

  allOption.value = '';
  allOption.textContent = 'ทุกสาขา';

  filter.appendChild(allOption);


  branches
    .sort((a, b) => a.localeCompare(b, 'th'))
    .forEach(branch => {

      const option =
        document.createElement('option');

      option.value = branch;
      option.textContent = branch;

      filter.appendChild(option);

    });


  /* -------------------------------------------------------
     เปลี่ยนสาขา
  ------------------------------------------------------- */

  filter.addEventListener('change', () => {

    updateDashboard(
      data,
      filter.value
    );

  });

}


/* =========================================================
   LOAD DASHBOARD
========================================================= */

async function loadDashboard() {

  const status =
    document.getElementById('status');

  try {

    status.textContent =
      'กำลังโหลดข้อมูล...';


    const data =
      await getDashboardData();


    console.log(
      'Dashboard data:',
      data
    );


    /* -----------------------------------------------------
       ตั้งค่า Filter
    ----------------------------------------------------- */

    setupBranchFilter(data);


    /* -----------------------------------------------------
       โหลดหน้าแรก = ทุกสาขา
    ----------------------------------------------------- */

    updateDashboard(
      data,
      ''
    );


  } catch (error) {

    console.error(
      'Dashboard error:',
      error
    );


    status.textContent =
      'เกิดข้อผิดพลาด: ' +
      error.message;

  }

}


/* =========================================================
   START
========================================================= */

loadDashboard();
