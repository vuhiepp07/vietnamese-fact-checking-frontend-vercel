# 🚀 HƯỚNG DẪN CHẠY NHANH

## Chạy Local (Development)

### Bước 1: Cài dependencies
```bash
npm install
```

### Bước 2: Cài Vercel CLI (nếu chưa có)
```bash
npm install -g vercel
```

### Bước 3: Chạy dev server
```bash
vercel dev
```

**Lưu ý**: 
- KHÔNG chạy `npm run dev` (sẽ lỗi recursive)
- Chạy trực tiếp: `vercel dev`
- Server sẽ chạy tại: http://localhost:3000

### Bước 4 (Optional): Tạo file .env nếu có Redis
```bash
# .env
UPSTASH_REDIS_REST_URL=https://your-redis-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token
```

**Không có Redis?** → App vẫn chạy được với in-memory storage.

---

## Test API bằng Postman

### 1. Gửi message (Backend → Frontend)
```
POST http://localhost:3000/api/receive-message

Headers:
Content-Type: application/json

Body:
{
  "sessionId": "test_123",
  "type": "message",
  "header": "Đang phân tích",
  "content": "Hệ thống đang xử lý..."
}
```

### 2. Lấy message (Frontend poll)
```
GET http://localhost:3000/api/get-message?sessionId=test_123
```

### 3. Gửi message END (kết thúc)
```
POST http://localhost:3000/api/receive-message

Body:
{
  "sessionId": "test_123",
  "type": "END",
  "header": "Hoàn thành",
  "content": "Phân tích xong rồi!"
}
```

---

## Deploy lên Vercel

### Cách 1: CLI
```bash
vercel login
vercel
```

### Cách 2: Git (Khuyến nghị)
1. Push code lên GitHub
2. Import vào Vercel: https://vercel.com/new
3. Thêm Environment Variables:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
4. Deploy!

---

## Troubleshooting

### Lỗi: recursive invocation
❌ **ĐỪNG** chạy: `npm run dev`  
✅ **Chạy**: `vercel dev`

### Lỗi: Cannot find module
```bash
npm install
```

### Port 3000 đã bị dùng
Vercel sẽ tự động chọn port khác (3001, 3002...)

---

## So sánh với Netlify

| Netlify | Vercel |
|---------|--------|
| `netlify dev` | `vercel dev` |
| `netlify/functions/` | `api/` |
| `/.netlify/functions/get-message` | `/api/get-message` |
| Port 8888 | Port 3000 |

**Logic hoàn toàn giống nhau**, chỉ đổi platform!
