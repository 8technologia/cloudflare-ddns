# Cloudflare Dynamic DNS (DDNS)

Công cụ tự động cập nhật địa chỉ IP công khai của tên miền trên Cloudflare khi host server tại nhà. Script sẽ định kỳ kiểm tra IP công khai của server và tự động cập nhật A record trên Cloudflare khi phát hiện IP thay đổi.

## 🌟 Tính năng

- ✅ **Tự động cập nhật DNS**: Kiểm tra và cập nhật A record khi IP công khai thay đổi
- 🔄 **Hỗ trợ nhiều domain**: Quản lý nhiều domain/subdomain cùng lúc
- 📱 **Thông báo Telegram**: Nhận thông báo tức thì khi IP được cập nhật (tùy chọn)
- ⚙️ **Cấu hình linh hoạt**:
  - Tùy chỉnh TTL cho từng domain
  - Bật/tắt Cloudflare Proxy
  - API Token riêng cho từng domain
  - Thời gian kiểm tra tùy chỉnh
- 🔁 **Retry thông minh**: Tự động thử lại khi gặp lỗi mạng
- 🛡️ **Graceful shutdown**: Dừng an toàn không làm mất dữ liệu
- 📝 **Log chi tiết**: Theo dõi mọi hoạt động của script

## 📋 Yêu cầu hệ thống

- **Node.js**: Phiên bản 18.0.0 trở lên (hỗ trợ native fetch API)
- **Hệ điều hành**: Linux, macOS, Windows
- **Kết nối Internet**: Để truy cập Cloudflare API và API lấy IP công khai

## 📦 Cài đặt


### Tạo file cấu hình

Đổi tên file config.example.json thành config.json

## ⚙️ Cấu hình

File `config.json` có cấu trúc như sau:

```json
{
  "telegram": {
    "botToken": "YOUR_TELEGRAM_BOT_TOKEN",
    "chatId": "YOUR_TELEGRAM_CHAT_ID"
  },

  "defaults": {
    "apiToken": "YOUR_DEFAULT_CLOUDFLARE_API_TOKEN",
    "ttl": 60,
    "proxied": false,
    "checkIntervalSeconds": 60
  },

  "domains": [
    {
      "name": "example.com",
      "zoneId": "YOUR_ZONE_ID_FOR_EXAMPLE_COM"
    },
    {
      "name": "www.example.com",
      "zoneId": "YOUR_ZONE_ID_FOR_EXAMPLE_COM"
    },
    {
      "name": "another-domain.com",
      "zoneId": "ANOTHER_ZONE_ID",
      "apiToken": "CUSTOM_API_TOKEN_FOR_THIS_DOMAIN",
      "ttl": 120,
      "proxied": true
    }
  ]
}
```

### Chi tiết cấu hình

#### 1. Telegram (Tùy chọn)

| Tham số | Mô tả | Bắt buộc |
|---------|-------|----------|
| `botToken` | Token của Telegram Bot | Không |
| `chatId` | Chat ID để nhận thông báo | Không |

> **Lưu ý**: Nếu không cần thông báo Telegram, có thể bỏ qua phần này hoặc để trống.

#### 2. Defaults (Giá trị mặc định)

| Tham số | Mô tả | Mặc định | Bắt buộc |
|---------|-------|----------|----------|
| `apiToken` | Cloudflare API Token mặc định | - | Có (nếu domain không có token riêng) |
| `ttl` | Time To Live (giây) | 60 | Không |
| `proxied` | Bật Cloudflare Proxy | false | Không |
| `checkIntervalSeconds` | Thời gian kiểm tra (giây) | 60 | Không |

#### 3. Domains (Danh sách domain)

Mỗi domain có thể có các thuộc tính sau:

| Tham số | Mô tả | Bắt buộc |
|---------|-------|----------|
| `name` | Tên domain hoặc subdomain | Có |
| `zoneId` | Zone ID của domain trên Cloudflare | Có |
| `apiToken` | API Token riêng (override default) | Không |
| `ttl` | TTL riêng (override default) | Không |
| `proxied` | Proxied riêng (override default) | Không |

## 🔑 Lấy thông tin từ Cloudflare

### 1. Lấy Zone ID

1. Đăng nhập vào [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Chọn domain của bạn
3. Kéo xuống bên phải, tìm mục **Zone ID** trong phần **API**
4. Copy Zone ID

### 2. Tạo API Token

1. Vào [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Click **"Create Token"**
3. Chọn template **"Edit zone DNS"** hoặc tạo custom token với quyền:
   - **Zone** → **DNS** → **Edit**
   - **Zone** → **Zone** → **Read**
4. Chọn **Zone Resources**:
   - **Include** → **Specific zone** → Chọn domain của bạn
5. Click **"Continue to summary"** → **"Create Token"**
6. Copy token (chỉ hiển thị 1 lần)

> **Bảo mật**: API Token rất quan trọng, không chia sẻ với ai và không commit lên Git!

## 📱 Cấu hình Telegram (Tùy chọn)

### 1. Tạo Telegram Bot

1. Mở Telegram và tìm [@BotFather](https://t.me/BotFather)
2. Gửi lệnh `/newbot`
3. Đặt tên và username cho bot
4. Copy **Bot Token** (dạng: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 2. Lấy Chat ID

**Cách 1**: Dùng bot [@userinfobot](https://t.me/userinfobot)
- Mở bot và nó sẽ hiển thị Chat ID của bạn

**Cách 2**: Dùng API
1. Gửi tin nhắn bất kỳ cho bot của bạn
2. Truy cập: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
3. Tìm giá trị `"id"` trong `"chat"` object

### 3. Cập nhật config.json

```json
{
  "telegram": {
    "botToken": "123456789:ABCdefGHIjklMNOpqrsTUVwxyz",
    "chatId": "987654321"
  }
}
```

## 🚀 Sử dụng

### Chạy script thủ công

```bash
node cloudflare-ddns.js
```

### Output mẫu

```
[2025-01-15T10:30:00.000Z] 🚀 Bắt đầu script Dynamic DNS...
[2025-01-15T10:30:00.100Z] 📄 Đọc cấu hình từ config.json
[2025-01-15T10:30:00.150Z] ✅ Cấu hình hợp lệ: 3 domain(s)
  - example.com (Zone: 12345678..., Token: abcdefghij..., TTL: 60s, Proxied: false)
  - www.example.com (Zone: 12345678..., Token: abcdefghij..., TTL: 60s, Proxied: false)
  - another-domain.com (Zone: 87654321..., Token: zyxwvutsrq..., TTL: 120s, Proxied: true)
[2025-01-15T10:30:01.000Z] A record cho example.com đã khớp (203.0.113.10), bỏ qua.
[2025-01-15T10:30:01.200Z] A record cho www.example.com khác (203.0.113.5 vs 203.0.113.10), đang cập nhật...
[2025-01-15T10:30:02.000Z] Đã cập nhật A record cho www.example.com thành 203.0.113.10 (TTL: 60s, Proxied: false)
[2025-01-15T10:30:02.500Z] Đã gửi thông báo Telegram: 🌐 *Cập nhật DNS thành công* 🌐...
[2025-01-15T10:30:02.600Z] ⏰ Lập lịch kiểm tra tiếp theo sau 60 giây...
```

## 🔄 nên cài pm2 và chạy bằng pm2

## 🔧 Xử lý sự cố

### Script không chạy

**Kiểm tra**:
- Node.js đã cài đúng phiên bản chưa: `node --version` (cần >= 18.0.0)
- File `config.json` có tồn tại không
- Cấu hình JSON có đúng cú pháp không

**Giải pháp**:
```bash
# Kiểm tra cú pháp JSON
node -e "console.log(JSON.parse(require('fs').readFileSync('config.json')))"
```

### Lỗi "Không tìm thấy A record"

**Nguyên nhân**:
- Domain chưa có A record trên Cloudflare
- Tên domain trong config không khớp với DNS record

**Giải pháp**:
1. Đăng nhập Cloudflare Dashboard
2. Vào **DNS** → **Records**
3. Tạo A record cho domain với IP bất kỳ
4. Script sẽ tự động cập nhật IP đúng

### Lỗi "HTTP 401" hoặc "HTTP 403"

**Nguyên nhân**: API Token không hợp lệ hoặc không đủ quyền

**Giải pháp**:
1. Kiểm tra lại API Token
2. Đảm bảo token có quyền **Edit DNS** và **Read Zone**
3. Kiểm tra Zone ID có đúng không

### Lỗi gửi Telegram

**Nguyên nhân**: Bot Token hoặc Chat ID không đúng

**Giải pháp**:
1. Kiểm tra lại Bot Token
2. Đảm bảo đã gửi ít nhất 1 tin nhắn cho bot
3. Kiểm tra Chat ID có đúng không
4. Nếu không cần Telegram, có thể bỏ qua phần này trong config

### IP không được cập nhật

**Kiểm tra**:
- Xem log có lỗi gì không
- Kiểm tra kết nối Internet
- Test API: `curl https://api.ipify.org?format=json`

**Giải pháp**:
- Tăng `checkIntervalSeconds` nếu mạng không ổn định
- Kiểm tra firewall có chặn không
- Restart script


```

## 📊 Giải thích hoạt động

1. **Kiểm tra IP công khai**: Script gọi API `https://api.ipify.org` để lấy IP công khai hiện tại
2. **Lấy A record**: Gọi Cloudflare API để lấy IP đang được set cho domain
3. **So sánh**: Nếu IP khác nhau → cập nhật
4. **Cập nhật DNS**: Gọi Cloudflare API để cập nhật A record
5. **Thông báo**: Gửi thông báo qua Telegram (nếu được cấu hình)
6. **Lặp lại**: Chờ theo `checkIntervalSeconds` rồi lặp lại từ bước 1

## 🛡️ Bảo mật

- ⚠️ **KHÔNG** commit file `config.json` lên Git
- ⚠️ **KHÔNG** chia sẻ API Token với bất kỳ ai
- ✅ Sử dụng `.gitignore` để loại trừ `config.json`
- ✅ Chỉ cấp quyền tối thiểu cần thiết cho API Token
- ✅ Định kỳ rotate API Token (3-6 tháng)
- ✅ Sử dụng API Token riêng cho từng domain (tùy chọn)

## 📝 License

ISC License

## 👤 Tác giả

**Tám Công Nghệ**

## 🤝 Đóng góp

Mọi đóng góp đều được chào đón! Hãy tạo Pull Request hoặc Issue nếu bạn có ý tưởng cải thiện.

## 📮 Hỗ trợ

Nếu gặp vấn đề, hãy:
1. Kiểm tra phần **Xử lý sự cố** ở trên
2. Xem log chi tiết
3. Tạo Issue mới với thông tin chi tiết

---

**Lưu ý**: Script này sử dụng native fetch API của Node.js 18+, không cần cài thêm dependencies nào.
