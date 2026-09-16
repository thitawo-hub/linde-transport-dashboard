export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ================================
    // กำหนด Route ของหน้าเว็บ
    // ================================
    const routes = {
      "/": "/index.html",

      "/daily-report": "/daily-report.html",
      "/daily-report/": "/daily-report.html",
      "/daily-report.html": "/daily-report.html",

      "/kpi-distance": "/kpi-distance.html",
      "/kpi-distance/": "/kpi-distance.html",
      "/kpi-distance.html": "/kpi-distance.html",
    };

    // ถ้าเป็น route ที่กำหนดไว้
    if (routes[url.pathname]) {
      url.pathname = routes[url.pathname];

      // ส่ง request ใหม่ไปหา Static Assets
      const assetRequest = new Request(url.toString(), request);

      return env.ASSETS.fetch(assetRequest);
    }

    // ================================
    // ไฟล์อื่น ๆ เช่น
    // CSS / JS / รูปภาพ / favicon
    // ให้ Cloudflare จัดการตามปกติ
    // ================================
    return env.ASSETS.fetch(request);
  },
};
