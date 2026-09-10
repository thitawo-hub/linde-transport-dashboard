const SUPABASE_URL = 'https://hhsqijlcebaijtklskag.supabase.co';
const SUPABASE_KEY = 'sb_publishable_z5-j4hCd7dJ50-sLaUKraw_ZgM9ZA4W';

async function getDashboardData() {
  const url = `${SUPABASE_URL}/rest/v1/v_dashboard?select=*`;

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


function formatNumber(value, decimals = 0) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  const number = Number(value);

  if (Number.isNaN(number)) {
    return '-';
  }

  return number.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}


function updateDashboard(data) {

  if (!data || data.length === 0) {
    document.getElementById('status').textContent =
      'ไม่พบข้อมูลจาก Supabase';
    return;
  }

  // ใช้ข้อมูลสาขาที่มีอยู่ใน v_dashboard
  const rows = data.filter(row => row.branch);

  // รวมค่ารถ COCO จาก Master Car
  const cocoCars = rows.reduce((sum, row) => {
    return sum + Number(row.actual_coco_cars || 0);
  }, 0);

  // รวม พขร. จาก Master Person
  const cocoDrivers = rows.reduce((sum, row) => {
    return sum + Number(row.actual_coco_drivers || 0);
  }, 0);

  // ใช้ค่า Ratio จากข้อมูลสาขา
  const ratios = rows
    .map(row => Number(row.actual_driver_ratio))
    .filter(value => !Number.isNaN(value));

  const driverRatio =
    ratios.length > 0
      ? ratios.reduce((sum, value) => sum + value, 0) / ratios.length
      : null;

  // Target KM
  const targets = rows
    .map(row => Number(row.target_km_per_car))
    .filter(value => !Number.isNaN(value) && value > 0);

  const targetKm =
    targets.length > 0
      ? Math.max(...targets)
      : null;


  document.getElementById('cocoCars').textContent =
    formatNumber(cocoCars);

  document.getElementById('cocoDrivers').textContent =
    formatNumber(cocoDrivers);

  document.getElementById('driverRatio').textContent =
    formatNumber(driverRatio, 2);

  document.getElementById('targetKm').textContent =
    formatNumber(targetKm);

  document.getElementById('status').textContent =
    `เชื่อมต่อ Supabase สำเร็จ • ${data.length.toLocaleString()} records`;
}


async function loadDashboard() {

  const status = document.getElementById('status');

  try {

    status.textContent = 'กำลังโหลดข้อมูล...';

    const data = await getDashboardData();

    console.log('Dashboard data:', data);

    updateDashboard(data);

  } catch (error) {

    console.error('Dashboard error:', error);

    status.textContent =
      'เกิดข้อผิดพลาด: ' + error.message;
  }
}


loadDashboard();
