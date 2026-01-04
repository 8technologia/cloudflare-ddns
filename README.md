# Cloudflare Dynamic DNS (DDNS)

Công cụ tự động cập nhật địa chỉ IP công khai của tên miền trên Cloudflare khi host server tại nhà. Script sẽ định kỳ kiểm tra IP công khai của server và tự động cập nhật A record trên Cloudflare khi phát hiện IP thay đổi.

## 🌟 Tính năng

- ✅ **Tự động cập nhật DNS**: Kiểm tra và cập nhật A record khi IP công khai thay đổi
- 🔄 **Hỗ trợ nhiều domain**: Quản lý nhiều domain/subdomain cùng lúc
- 📱 **Thông báo đa nền tảng**: Hỗ trợ Telegram và Discord (có thể chọn một hoặc cả hai)
- 🌐 **Nhiều endpoint IP dự phòng**: Tự động chuyển sang endpoint khác nếu một endpoint lỗi
- ⚙️ **Cấu hình linh hoạt**:
  - Tùy chỉnh TTL cho từng domain
  - Bật/tắt Cloudflare Proxy
  - API Token riêng cho từng domain
  - Thời gian kiểm tra tùy chỉnh
  - Chế độ thông báo: Telegram, Discord, cả hai, hoặc tắt
- 🔁 **Retry thông minh**: Tự động thử lại khi gặp lỗi mạng với exponential backoff
- 📊 **Báo cáo hàng ngày**: Tự động gửi báo cáo hoạt động lúc 8h sáng (GMT+7)
- 🏥 **Health check**: Tự động theo dõi và cảnh báo khi hệ thống có vấn đề
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
  "notification": {
    "mode": "telegram"
  },

  "telegram": {
    "botToken": "YOUR_TELEGRAM_BOT_TOKEN",
    "chatId": "YOUR_TELEGRAM_CHAT_ID"
  },

  "discord": {
    "webhookUrl": "YOUR_DISCORD_WEBHOOK_URL"
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

#### 1. Notification (Chế độ thông báo)

| Tham số | Mô tả                                         | Mặc định   | Bắt buộc |
| ------- | --------------------------------------------- | ---------- | -------- |
| `mode`  | Chế độ: `telegram`, `discord`, `both`, `none` | `telegram` | Không    |

> **Lưu ý**:
>
> - `'telegram'`: Chỉ gửi thông báo qua Telegram
> - `'discord'`: Chỉ gửi thông báo qua Discord
> - `'both'`: Gửi thông báo qua cả Telegram và Discord
> - `'none'`: Tắt tất cả thông báo

#### 2. Telegram (Tùy chọn)

| Tham số    | Mô tả                     | Bắt buộc |
| ---------- | ------------------------- | -------- |
| `botToken` | Token của Telegram Bot    | Không    |
| `chatId`   | Chat ID để nhận thông báo | Không    |

> **Lưu ý**: Cần thiết nếu `notification.mode` là `'telegram'` hoặc `'both'`.

#### 3. Discord (Tùy chọn)

| Tham số      | Mô tả               | Bắt buộc |
| ------------ | ------------------- | -------- |
| `webhookUrl` | Discord Webhook URL | Không    |

> **Lưu ý**: Cần thiết nếu `notification.mode` là `'discord'` hoặc `'both'`.

#### 4. Defaults (Giá trị mặc định)

| Tham số                | Mô tả                         | Mặc định | Bắt buộc                             |
| ---------------------- | ----------------------------- | -------- | ------------------------------------ |
| `apiToken`             | Cloudflare API Token mặc định | -        | Có (nếu domain không có token riêng) |
| `ttl`                  | Time To Live (giây)           | 60       | Không                                |
| `proxied`              | Bật Cloudflare Proxy          | false    | Không                                |
| `checkIntervalSeconds` | Thời gian kiểm tra (giây)     | 60       | Không                                |

#### 5. Domains (Danh sách domain)

Mỗi domain có thể có các thuộc tính sau:

| Tham số    | Mô tả                              | Bắt buộc |
| ---------- | ---------------------------------- | -------- |
| `name`     | Tên domain hoặc subdomain          | Có       |
| `zoneId`   | Zone ID của domain trên Cloudflare | Có       |
| `apiToken` | API Token riêng (override default) | Không    |
| `ttl`      | TTL riêng (override default)       | Không    |
| `proxied`  | Proxied riêng (override default)   | Không    |

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

## 📱 Cấu hình thông báo (Tùy chọn)

### Cấu hình Telegram

#### 1. Tạo Telegram Bot

1. Mở Telegram và tìm [@BotFather](https://t.me/BotFather)
2. Gửi lệnh `/newbot`
3. Đặt tên và username cho bot
4. Copy **Bot Token** (dạng: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

#### 2. Lấy Chat ID

**Cách 1**: Dùng bot [@userinfobot](https://t.me/userinfobot)

- Mở bot và nó sẽ hiển thị Chat ID của bạn

**Cách 2**: Dùng API

1. Gửi tin nhắn bất kỳ cho bot của bạn
2. Truy cập: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
3. Tìm giá trị `"id"` trong `"chat"` object

#### 3. Cập nhật config.json

```json
{
  "notification": {
    "mode": "telegram"
  },
  "telegram": {
    "botToken": "123456789:ABCdefGHIjklMNOpqrsTUVwxyz",
    "chatId": "987654321"
  }
}
```

### Cấu hình Discord

#### 1. Tạo Discord Webhook

1. Mở Discord và vào server của bạn
2. Vào **Server Settings** → **Integrations** → **Webhooks**
3. Click **New Webhook** hoặc **Create Webhook**
4. Đặt tên cho webhook (ví dụ: "Cloudflare DDNS")
5. Chọn channel để nhận thông báo
6. Click **Copy Webhook URL**
7. (Tùy chọn) Click **Save Changes**

#### 2. Cập nhật config.json

```json
{
  "notification": {
    "mode": "discord"
  },
  "discord": {
    "webhookUrl": "https://discord.com/api/webhooks/YOUR_WEBHOOK_URL"
  }
}
```

### Sử dụng cả Telegram và Discord

Để nhận thông báo qua cả hai nền tảng:

```json
{
  "notification": {
    "mode": "both"
  },
  "telegram": {
    "botToken": "YOUR_TELEGRAM_BOT_TOKEN",
    "chatId": "YOUR_TELEGRAM_CHAT_ID"
  },
  "discord": {
    "webhookUrl": "YOUR_DISCORD_WEBHOOK_URL"
  }
}
```

## 🚀 Sử dụng

### Chạy script bằng pm2

- Cài đặt PM2 (nếu chưa có)

```bash
npm install pm2 -g
```

- Di chuyển đến thư mục dự án rồi khởi chạy

```bash
pm2 start ecosystem.config.js
```

- Đảm bảo PM2 khởi động cùng hệ thống (sau khi reboot):

```bash
pm2 save
```

```bash
pm2 startup
```

- Xem log

```bash
pm2 logs cloudflare-ddns
```

### Output mẫu

```text
2025-11-30T23:34:27: [2025-11-30T16:34:27.718Z] 🚀 Bắt đầu script Dynamic DNS...
2025-11-30T23:34:27: [2025-11-30T16:34:27.719Z] 📄 Đọc cấu hình từ config.json
2025-11-30T23:34:27: [2025-11-30T16:34:27.719Z] ✅ Load config thành công (lần 1)
2025-11-30T23:34:27: [2025-11-30T16:34:27.719Z] ✅ Cấu hình hợp lệ: 1 domain(s)
2025-11-30T23:34:27:   - tamcongnghe.com (Zone: 5e2a9a45..., Token: aKPyQX74c9..., TTL: 60s, Proxied: false)
2025-11-30T23:34:27: [2025-11-30T16:34:27.719Z] ⚙️ Startup delay: 60s, Startup retries: 5, Check interval: 60s
2025-11-30T23:34:27: [2025-11-30T16:34:27.720Z] 📢 Chế độ thông báo: telegram
2025-11-30T23:34:27: [2025-11-30T16:34:27.720Z] 📊 Đã thiết lập báo cáo hàng ngày lúc 8h sáng (GMT+7)
2025-11-30T23:34:27: [2025-11-30T16:34:27.720Z] 🔄 Đợi 60s để hệ thống ổn định...
2025-11-30T23:35:27: [2025-11-30T16:35:27.740Z] 🚀 Thử kiểm tra startup (lần 1/5)...
2025-11-30T23:35:27: [2025-11-30T16:35:27.741Z] 🔄 Đang chờ network sẵn sàng (tối đa 180s)...
2025-11-30T23:35:27: [2025-11-30T16:35:27.741Z] 🔍 Đang lấy IP từ: https://api.ipify.org?format=json
2025-11-30T23:35:28: [2025-11-30T16:35:28.222Z] ✅ Lấy IP thành công: 14.247.122.72 từ https://api.ipify.org?format=json
2025-11-30T23:35:28: [2025-11-30T16:35:28.222Z] ✅ Network sẵn sàng, IP: 14.247.122.72
2025-11-30T23:35:28: [2025-11-30T16:35:28.222Z] ✅ Network sẵn sàng, IP hiện tại: 14.247.122.72
2025-11-30T23:35:28: [2025-11-30T16:35:28.222Z] 🔄 Thực hiện kiểm tra đầu tiên...
2025-11-30T23:35:28: [2025-11-30T16:35:28.222Z] 🔍 Đang lấy IP từ: https://api.ipify.org?format=json
2025-11-30T23:35:28: [2025-11-30T16:35:28.510Z] ✅ Lấy IP thành công: 14.247.122.72 từ https://api.ipify.org?format=json
2025-11-30T23:35:29: [2025-11-30T16:35:29.151Z] A record cho tamcongnghe.com đã khớp (14.247.122.72), bỏ qua.
2025-11-30T23:35:29: [2025-11-30T16:35:29.151Z] ⏰ Lập lịch kiểm tra định kỳ mỗi 60 giây...
2025-11-30T23:36:29: [2025-11-30T16:36:29.151Z] 🔍 Đang lấy IP từ: https://api.ipify.org?format=json
2025-11-30T23:36:29: [2025-11-30T16:36:29.644Z] ✅ Lấy IP thành công: 14.247.122.72 từ https://api.ipify.org?format=json
2025-11-30T23:36:30: [2025-11-30T16:36:30.069Z] A record cho tamcongnghe.com đã khớp (14.247.122.72), bỏ qua.
2025-11-30T23:37:29: [2025-11-30T16:37:29.151Z] 🔍 Đang lấy IP từ: https://api.ipify.org?format=json
```

## 🔧 Xử lý sự cố

### Script không chạy

**Kiểm tra**:

- Node.js đã cài đúng phiên bản chưa: `node --version` (cần >= 18.0.0)
- File `config.json` có tồn tại không
- Cấu hình JSON có đúng cú pháp không
- Cài PM2 chưa

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

### Lỗi gửi thông báo

#### Lỗi Telegram

**Nguyên nhân**: Bot Token hoặc Chat ID không đúng

**Giải pháp**:

1. Kiểm tra lại Bot Token
2. Đảm bảo đã gửi ít nhất 1 tin nhắn cho bot
3. Kiểm tra Chat ID có đúng không
4. Nếu không cần Telegram, đặt `notification.mode` thành `'discord'` hoặc `'none'`

#### Lỗi Discord

**Nguyên nhân**: Webhook URL không hợp lệ hoặc đã bị xóa

**Giải pháp**:

1. Kiểm tra lại Webhook URL
2. Đảm bảo webhook vẫn còn hoạt động trong Discord
3. Tạo webhook mới nếu cần
4. Nếu không cần Discord, đặt `notification.mode` thành `'telegram'` hoặc `'none'`

### IP không được cập nhật

**Kiểm tra**:

- Xem log có lỗi gì không
- Kiểm tra kết nối Internet
- Test các API endpoint:
  - `curl https://api.ipify.org?format=json`
  - `curl https://checkip.amazonaws.com/`
  - `curl https://icanhazip.com/`

**Giải pháp**:

- Script tự động thử các endpoint dự phòng nếu một endpoint lỗi
- Tăng `checkIntervalSeconds` nếu mạng không ổn định
- Kiểm tra firewall có chặn không
- Restart script

## 📊 Giải thích hoạt động

1. **Khởi động**: Script đợi 60 giây để hệ thống ổn định, sau đó thử lấy IP công khai (tối đa 5 lần)
2. **Kiểm tra IP công khai**: Script gọi nhiều API endpoint để lấy IP công khai (theo thứ tự):
   - `https://api.ipify.org?format=json` (chính)
   - `https://checkip.amazonaws.com/` (dự phòng)
   - `https://icanhazip.com/` (dự phòng)
   - Tự động chuyển sang endpoint tiếp theo nếu endpoint hiện tại lỗi
3. **Lấy A record**: Gọi Cloudflare API để lấy IP đang được set cho domain
4. **So sánh**: Nếu IP khác nhau → cập nhật
5. **Cập nhật DNS**: Gọi Cloudflare API để cập nhật A record với retry tự động
6. **Thông báo**: Gửi thông báo qua Telegram/Discord (tùy theo cấu hình)
7. **Báo cáo hàng ngày**: Tự động gửi báo cáo hoạt động lúc 8h sáng (GMT+7)
8. **Health check**: Kiểm tra sức khỏe hệ thống mỗi 5 phút
9. **Lặp lại**: Chờ theo `checkIntervalSeconds` rồi lặp lại từ bước 2

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

Tám Công Nghệ

## 🤝 Đóng góp

Mọi đóng góp đều được chào đón! Hãy tạo Pull Request hoặc Issue nếu bạn có ý tưởng cải thiện.

## 📮 Hỗ trợ

Nếu gặp vấn đề, hãy:

1. Kiểm tra phần **Xử lý sự cố** ở trên
2. Xem log chi tiết
3. Tạo Issue mới với thông tin chi tiết

---

**Lưu ý**: Script này sử dụng native fetch API của Node.js 18+, không cần cài thêm dependencies nào.
