// Vercel Serverless Function - 카카오톡 주문 알림
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { order_id } = req.body;
  if (!order_id) return res.status(400).json({ error: 'order_id required' });

  const SUPABASE_URL = 'https://uocawtgzmxhveqpumnuc.supabase.co';
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SERVICE_KEY) return res.status(500).json({ error: 'Service key not configured' });

  const headers = {
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json'
  };

  try {
    // 1. 주문 정보 조회
    const orderRes = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${order_id}&select=*`, { headers });
    const orders = await orderRes.json();
    const order = orders[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // 2. 상점 정보 조회
    const storeRes = await fetch(`${SUPABASE_URL}/rest/v1/store_applications?id=eq.${order.store_id}&select=store_name`, { headers });
    const stores = await storeRes.json();
    const storeName = stores[0]?.store_name || '상점';

    // 3. 사장님 카카오 토큰 조회
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/user_profiles?store_id=eq.${order.store_id}&select=kakao_access_token`,
      { headers }
    );
    const profiles = await profileRes.json();
    const kakaoToken = profiles[0]?.kakao_access_token;

    if (!kakaoToken) {
      return res.status(200).json({ ok: true, skipped: '사장님 카카오 토큰 없음 (카카오로 재로그인 필요)' });
    }

    // 4. 카카오 나에게 보내기
    const text =
      `[모락] 새 주문이 들어왔어요!\n\n` +
      `🏪 ${storeName}\n` +
      `📦 ${order.menu_name} ${order.quantity}개\n` +
      `📅 ${order.delivery_date} ${order.delivery_time}\n` +
      `📍 ${order.delivery_address}\n` +
      `💰 ${Number(order.total_price).toLocaleString()}원\n\n` +
      `사장님 페이지에서 수락/거절해주세요.`;

    const template = JSON.stringify({
      object_type: 'text',
      text,
      link: {
        web_url: 'https://morak-ten.vercel.app/store',
        mobile_web_url: 'https://morak-ten.vercel.app/store'
      }
    });

    const kakaoRes = await fetch('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${kakaoToken}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `template_object=${encodeURIComponent(template)}`
    });

    const kakaoData = await kakaoRes.json();
    return res.status(200).json({ ok: true, kakao: kakaoData });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
