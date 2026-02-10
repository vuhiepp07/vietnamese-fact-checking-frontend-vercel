# Hướng dẫn Deploy Frontend lên Vercel và Test Local


## 🚀 Deploy lên Vercel

### Bước 1: Cài đặt Vercel CLI (nếu chưa có)
```bash
npm install -g vercel
```

### Bước 2: Login vào Vercel
```bash
vercel login
```

### Bước 3: Deploy project
Di chuyển vào thư mục project và chạy:
```bash
vercel
```

Vercel CLI sẽ hỏi một số câu hỏi:
- Set up and deploy: **Yes**
- Which scope: Chọn account của bạn
- Link to existing project: **No**
- Project name: Nhấn Enter (hoặc đặt tên khác)
- In which directory is your code located: **.**
- Want to override settings: **No**

### Bước 4: Cấu hình Environment Variables trên Vercel
Sau khi deploy, bạn cần thêm environment variables cho Upstash Redis:

1. Vào Vercel Dashboard: https://vercel.com/dashboard
2. Chọn project vừa deploy
3. Vào **Settings** > **Environment Variables**
4. Thêm 2 biến sau:
   - `UPSTASH_REDIS_REST_URL`: URL của Upstash Redis
   - `UPSTASH_REDIS_REST_TOKEN`: Token của Upstash Redis

5. Sau khi thêm xong, vào tab **Deployments**, chọn deployment mới nhất và click **Redeploy** để áp dụng environment variables.

### Bước 5: Lấy URL deploy
Sau khi deploy thành công, Vercel sẽ cung cấp URL dạng:
```
https://your-project-name.vercel.app
```

---

## 🔧 Chạy Local

### Bước 1: Cài đặt dependencies
```bash
npm install
```

### Bước 2: Cài đặt Vercel CLI (nếu chưa có)
```bash
npm install -g vercel
```

### Bước 3: Tạo file `.env` ở thư mục gốc project
```bash
# .env
UPSTASH_REDIS_REST_URL=https://your-redis-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token
```

**Lưu ý**: Nếu không có Redis Upstash, app vẫn chạy được với in-memory storage (dữ liệu sẽ mất khi restart).

### Bước 4: Chạy Vercel Dev Server
```bash
vercel dev
```

Server sẽ chạy tại: `http://localhost:3000`

---

## 🧪 Test API với Postman

### API Endpoints

Sau khi deploy, bạn sẽ có 2 endpoints:

1. **GET /api/get-message** - Frontend dùng để poll messages
2. **POST /api/receive-message** - Backend fact-checking dùng để gửi messages

---

### Test 1: Gửi message từ backend (POST /api/receive-message)

**Request:**
- Method: `POST`
- URL: 
  - Local: `http://localhost:3000/api/receive-message`
  - Production: `https://your-project.vercel.app/api/receive-message`
- Headers:
  ```
  Content-Type: application/json
  ```
- Body (JSON):
  ```json
  {
    "sessionId": "test_session_123",
    "type": "message",
    "header": "Đang phân tích câu hỏi",
    "content": "Hệ thống đang xử lý câu hỏi của bạn..."
  }
  ```

**Response thành công:**
```json
{
  "success": true,
  "message": "Message received"
}
```

---

### Test 2: Lấy message (GET /api/get-message)

**Request:**
- Method: `GET`
- URL: 
  - Local: `http://localhost:3000/api/get-message?sessionId=test_session_123`
  - Production: `https://your-project.vercel.app/api/get-message?sessionId=test_session_123`

**Response khi có message:**
```json
{
  "success": true,
  "hasMessage": true,
  "message": {
    "type": "message",
    "header": "Đang phân tích câu hỏi",
    "content": "Hệ thống đang xử lý câu hỏi của bạn..."
  },
  "isComplete": false
}
```

**Response khi không có message:**
```json
{
  "success": true,
  "hasMessage": false
}
```

---

### Test 3: Gửi message END (kết thúc phiên)

**Request:**
- Method: `POST`
- URL: `http://localhost:3000/api/receive-message` (hoặc production URL)
- Body (JSON):
  ```json
  {
    "sessionId": "test_session_123",
    "type": "END",
    "header": "Hoàn thành",
    "content": "Phân tích hoàn tất!"
  }
  ```

**Response:**
```json
{
  "success": true,
  "message": "Message received"
}
```

---

## 🔄 Workflow hoàn chỉnh

1. **Frontend gửi query** → Gọi API backend fact-checking
2. **Backend fact-checking** → Xử lý và gửi messages đến `/api/receive-message` (với sessionId)
3. **Frontend poll** → Gọi `/api/get-message` mỗi 1 giây để lấy messages
4. **Frontend hiển thị** → Render messages với streaming effect

---

## 📝 Message Format

Mỗi message cần có cấu trúc:
```json
{
  "sessionId": "unique_session_id",
  "type": "bất_kỳ_string_nào hoặc END",
  "header": "Tiêu đề (in đậm, lớn)",
  "content": "Nội dung chi tiết (font thường)"
}
```

**Loại type:**
- **Bất kỳ string nào** (ví dụ: "message", "step1", "analysis", v.v.) - Message thường, frontend sẽ hiển thị và tiếp tục poll
- **`END`** - Message đặc biệt đánh dấu kết thúc. Frontend sẽ hiển thị message này, dừng poll và show completion message

---

## 📦 Postman Collection Example

### Collection: Vietnamese Fact Checking API

#### 1. Send Message
```
POST {{base_url}}/api/receive-message

Body:
{
  "sessionId": "{{session_id}}",
  "type": "message",
  "header": "Test Header",
  "content": "Test Content"
}
```

#### 2. Get Message
```
GET {{base_url}}/api/get-message?sessionId={{session_id}}
```

**Environment Variables:**
- `base_url`: 
  - Local: `http://localhost:3000`
  - Production: `https://your-project.vercel.app`
- `session_id`: `test_session_123` (hoặc bất kỳ ID nào)

---

## ⚠️ Lưu ý quan trọng

1. **SessionId phải giống nhau** giữa request gửi và request lấy message
2. **Messages được lấy theo thứ tự FIFO** (First In First Out) - message nào gửi trước sẽ được lấy ra trước
3. **Messages có TTL 1 giờ** trong Redis (3600 giây)
4. **Khi gửi message type "END"**, frontend sẽ dừng poll và hiển thị thông báo hoàn thành
5. **CORS đã được enable** cho tất cả origins (`*`)

---

## 🐛 Troubleshooting

### Lỗi: Cannot find module '@upstash/redis'
```bash
npm install @upstash/redis
```

### Lỗi: Redis connection failed
- Kiểm tra environment variables `UPSTASH_REDIS_REST_URL` và `UPSTASH_REDIS_REST_TOKEN`
- App vẫn hoạt động với in-memory storage nếu không có Redis

### Frontend không nhận được message
1. Kiểm tra `sessionId` có đúng không
2. Mở Developer Console để xem logs
3. Kiểm tra network tab xem có lỗi API không

---

## 📞 Contact

Nếu có vấn đề, kiểm tra console logs:
- **Frontend**: Mở Developer Console (F12) → Console tab
- **Backend**: Xem logs tại Vercel Dashboard → Project → Functions → Logs

---

## ✅ Checklist Deploy

- [ ] Đã cài đặt dependencies (`npm install`)
- [ ] Đã test local với `vercel dev`
- [ ] Đã login Vercel (`vercel login`)
- [ ] Đã deploy (`vercel`)
- [ ] Đã thêm Environment Variables trên Vercel Dashboard
- [ ] Đã redeploy sau khi thêm env vars
- [ ] Đã test API bằng Postman/curl
- [ ] Đã test frontend flow hoàn chỉnh
