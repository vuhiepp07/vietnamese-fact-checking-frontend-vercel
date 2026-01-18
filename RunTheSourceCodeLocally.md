# Hướng dẫn chạy Source Code ở Local

Hướng dẫn từ máy chưa setup gì đến khi chạy được code bằng `netlify dev`.

## Bước 1: Cài đặt Node.js

### Kiểm tra đã cài chưa

```bash
node --version
npm --version
```

Nếu hiển thị version, bỏ qua bước này.

### Cài đặt

1. Tải Node.js LTS từ: https://nodejs.org/
2. Cài đặt theo hướng dẫn
3. Đóng và mở lại Terminal
4. Kiểm tra lại: `node --version`

## Bước 2: Cài đặt Netlify CLI

```bash
npm install -g netlify-cli
```

**Lưu ý:** Nếu gặp lỗi permission trên macOS/Linux, dùng `sudo`.

### Xác nhận

```bash
netlify --version
```

## Bước 3: Navigate đến thư mục project

```bash
cd {vị trí project}
```

## Bước 4: Cài đặt Dependencies

```bash
npm install
```

## Bước 5: Chạy Source Code

```bash
netlify dev
```

**Lần đầu chạy:** Có thể cần login, chạy `netlify login` nếu được yêu cầu.

Server sẽ chạy tại: `http://localhost:8888`

## Truy cập ứng dụng

Mở trình duyệt: `http://localhost:8888`

## Dừng Server

Nhấn `Ctrl + C` trong Terminal.

## Troubleshooting

### `'netlify' is not recognized`
- Cài lại: `npm install -g netlify-cli`
- Đóng và mở lại Terminal

### `Cannot find module '@upstash/redis'`
- Chạy: `npm install`

### `Port 8888 is already in use`
- Đóng ứng dụng đang dùng port 8888
- Hoặc Netlify sẽ tự động chọn port khác

### `EACCES: permission denied`
- Windows: Chạy Terminal với quyền Administrator
- macOS/Linux: Dùng `sudo`

## Lưu ý

- Local không cần set environment variables, hệ thống sẽ dùng in-memory storage
- Thay đổi code trong `app.js`, `style.css`, `index.html` sẽ tự động reload
- Thay đổi code trong Netlify Functions cần restart server
