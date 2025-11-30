const fs = require('fs');
const path = require('path');

// Thời gian đợi network sẵn sàng khi khởi động (giây)
const STARTUP_DELAY_SECONDS = 60;

// Số lần thử lại khi khởi động nếu không lấy được IP
const STARTUP_RETRIES = 5;

// Thời gian kiểm tra IP định kỳ (giây)
const CHECK_INTERVAL_SECONDS = 60; // 1 phút

// Timeout cho các request mạng (ms)
const NETWORK_TIMEOUT_MS = 10000; // 10 giây

// Config variables (sẽ được load từ config.json)
let TELEGRAM_BOT_TOKEN;
let TELEGRAM_CHAT_ID;
let DOMAINS = [];

class DDNSService {
    constructor() {
        this.isRunning = false;
        this.isShuttingDown = false;
        this.mainTimer = null;
        this.healthCheckInterval = null;
        this.dailyReportInterval = null;
        this.retryCount = 0;
        this.MAX_RETRIES = 10;
        this.lastSuccessfulCheck = null;
        this.startTime = new Date();
        this.successfulUpdates = 0;
        this.failedUpdates = 0;
        this.lastReportDate = null;
    }

    // Load configuration from config.json với retry
    async loadConfigWithRetry() {
        const MAX_RETRIES = 10;
        const RETRY_DELAY = 5000; // 5 giây
        
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                this.loadConfig();
                console.log(`[${new Date().toISOString()}] ✅ Load config thành công (lần ${attempt})`);
                return true;
            } catch (error) {
                console.warn(`[${new Date().toISOString()}] ⚠️ Lỗi load config (lần ${attempt}/${MAX_RETRIES}): ${error.message}`);
                
                if (attempt === MAX_RETRIES) {
                    console.error(`[${new Date().toISOString()}] ❌ Không thể load config sau ${MAX_RETRIES} lần thử`);
                    return false;
                }
                
                await new Promise(r => setTimeout(r, RETRY_DELAY));
            }
        }
    }

    loadConfig() {
        const configPath = path.join(__dirname, 'config.json');

        if (!fs.existsSync(configPath)) {
            console.error(`[${new Date().toISOString()}] ❌ File config.json không tồn tại!`);
            console.error('Vui lòng tạo file config.json từ config.example.json:');
            console.error('Sau đó chỉnh sửa config.json với thông tin của bạn.');
            process.exit(1);
        }

        console.log(`[${new Date().toISOString()}] 📄 Đọc cấu hình từ config.json`);
        try {
            const configData = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(configData);

            // Telegram config (optional)
            if (config.telegram) {
                TELEGRAM_BOT_TOKEN = config.telegram.botToken;
                TELEGRAM_CHAT_ID = config.telegram.chatId;
            }

            // Defaults
            const defaults = config.defaults || {};
            const defaultApiToken = defaults.apiToken;
            const defaultTtl = defaults.ttl || 60;
            const defaultProxied = defaults.proxied || false;

            // Domains
            if (config.domains && Array.isArray(config.domains)) {
                DOMAINS = config.domains
                    .filter(d => d.name && d.zoneId) // Chỉ lấy domain có name và zoneId hợp lệ
                    .map(d => ({
                        name: d.name,
                        zoneId: d.zoneId,
                        apiToken: d.apiToken || defaultApiToken, // Override hoặc dùng default
                        ttl: d.ttl !== undefined ? d.ttl : defaultTtl,
                        proxied: d.proxied !== undefined ? d.proxied : defaultProxied
                    }));
            }

            return true;
        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ Lỗi đọc config.json: ${error.message}`);
            if (error instanceof SyntaxError) {
                console.error('File config.json có lỗi cú pháp JSON. Vui lòng kiểm tra lại.');
            }
            throw error; // Re-throw để xử lý retry
        }
    }

    // Validate cấu hình
    validateConfig() {
        const errors = [];

        if (DOMAINS.length === 0) {
            errors.push('Không tìm thấy domain nào');
        }

        // Kiểm tra từng domain
        DOMAINS.forEach((domain, index) => {
            if (!domain.name) {
                errors.push(`Domain #${index + 1}: thiếu tên domain`);
            }
            if (!domain.zoneId) {
                errors.push(`Domain "${domain.name || index + 1}": thiếu zoneId`);
            }
            if (!domain.apiToken || domain.apiToken.trim() === '') {
                errors.push(`Domain "${domain.name || index + 1}": thiếu apiToken`);
            }
        });

        if (errors.length > 0) {
            console.error(`[${new Date().toISOString()}] ❌ Lỗi cấu hình:`);
            errors.forEach(err => console.error(`  - ${err}`));
            process.exit(1);
        }

        // Warning cho Telegram (optional)
        if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
            console.warn(`[${new Date().toISOString()}] ⚠️ Telegram không được cấu hình - thông báo sẽ bị tắt`);
        }

        console.log(`[${new Date().toISOString()}] ✅ Cấu hình hợp lệ: ${DOMAINS.length} domain(s)`);
        DOMAINS.forEach(d => {
            const tokenPreview = d.apiToken ? `${d.apiToken.substring(0, 10)}...` : 'N/A';
            console.log(`  - ${d.name} (Zone: ${d.zoneId.substring(0, 8)}..., Token: ${tokenPreview}, TTL: ${d.ttl}s, Proxied: ${d.proxied})`);
        });
    }

    // Helper function để retry cho Cloudflare API với timeout
    async retryCloudflareAPI(fn, context, { retries = 3, initialDelayMs = 1000 } = {}) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                const isLast = attempt === retries;
                const delay = Math.min(initialDelayMs * Math.pow(2, attempt - 1), 10000);

                if (isLast) {
                    console.error(`[${new Date().toISOString()}] ${context} thất bại sau ${retries} lần thử: ${error.message}`);
                    throw error;
                } else {
                    console.warn(`[${new Date().toISOString()}] ${context} (lần ${attempt}/${retries}): ${error.message}. Thử lại sau ${delay}ms...`);
                    await new Promise(r => setTimeout(r, delay));
                }
            }
        }
    }

    // Hàm fetch với timeout
    async fetchWithTimeout(url, options = {}) {
        const controller = new AbortController();
        const timeout = setTimeout(() => {
            controller.abort(new Error(`Request timeout after ${NETWORK_TIMEOUT_MS}ms`));
        }, NETWORK_TIMEOUT_MS);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeout);
            return response;
        } catch (error) {
            clearTimeout(timeout);
            throw error;
        }
    }

    // Lấy public IP từ nhiều endpoint dự phòng (đã bỏ api64.ipify.org)
    async getPublicIp() {
        const endpoints = [
            'https://api.ipify.org?format=json',
            'https://checkip.amazonaws.com/',
            'https://icanhazip.com/'
        ];

        for (const endpoint of endpoints) {
            try {
                console.log(`[${new Date().toISOString()}] 🔍 Đang lấy IP từ: ${endpoint}`);
                const response = await this.fetchWithTimeout(endpoint);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                let ip;
                if (endpoint.includes('ipify.org')) {
                    const data = await response.json();
                    ip = data.ip;
                } else {
                    // Cho amazonaws.com và icanhazip.com
                    ip = (await response.text()).trim();
                }

                if (ip && this.isValidIP(ip)) {
                    console.log(`[${new Date().toISOString()}] ✅ Lấy IP thành công: ${ip} từ ${endpoint}`);
                    return ip;
                } else {
                    throw new Error('IP không hợp lệ');
                }
            } catch (error) {
                console.warn(`[${new Date().toISOString()}] ⚠️ Không thể lấy IP từ ${endpoint}: ${error.message}`);
                // Tiếp tục thử endpoint tiếp theo
            }
        }

        console.error(`[${new Date().toISOString()}] ❌ Không thể lấy IP từ bất kỳ endpoint nào`);
        return null;
    }

    // Kiểm tra IP có hợp lệ không
    isValidIP(ip) {
        const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
        const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
        return ipv4Regex.test(ip) || ipv6Regex.test(ip);
    }

    async getARecord(domainConfig) {
        const { name, zoneId, apiToken } = domainConfig;
        try {
            return await this.retryCloudflareAPI(async () => {
                const response = await this.fetchWithTimeout(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=A&name=${encodeURIComponent(name)}`, {
                    headers: {
                        'Authorization': `Bearer ${apiToken}`,
                        'Content-Type': 'application/json'
                    }
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const data = await response.json();
                if (data.success && data.result.length > 0) {
                    return { ip: data.result[0].content, recordId: data.result[0].id };
                }
                console.error(`[${new Date().toISOString()}] Không tìm thấy A record cho ${name}`);
                return null;
            }, `Lấy A record cho ${name}`);
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Lỗi khi lấy A record cho ${name}: ${error.message}`);
            return null;
        }
    }

    async sendTelegramMessage(message, { retries = 5, initialDelayMs = 500, timeoutMs = 10000 } = {}) {
        if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
            console.warn(`[${new Date().toISOString()}] Bỏ qua gửi Telegram vì thiếu TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID.`);
            return false;
        }

        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const payload = {
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'Markdown'
        };

        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(new Error('Request timed out')), timeoutMs);

                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });
                clearTimeout(timer);

                if (!response.ok) {
                    const text = await response.text().catch(() => '');
                    throw new Error(`HTTP ${response.status} ${response.statusText}: ${text.slice(0, 200)}`);
                }

                const data = await response.json();
                if (!data.ok) throw new Error(data.description || 'Telegram API returned ok=false.');

                console.log(`[${new Date().toISOString()}] Đã gửi thông báo Telegram: ${message}`);
                return true;
            } catch (error) {
                const isLast = attempt === retries;
                const delay = Math.min(initialDelayMs * Math.pow(2, attempt - 1), 15000) + Math.floor(Math.random() * 300); // jitter

                if (isLast) {
                    console.error(`[${new Date().toISOString()}] Lỗi gửi thông báo Telegram sau ${retries} lần thử: ${error.message}`);
                    return false;
                } else {
                    console.warn(`[${new Date().toISOString()}] Lỗi gửi Telegram (lần ${attempt}/${retries}): ${error.message}. Sẽ thử lại sau ${delay}ms...`);
                    await new Promise(r => setTimeout(r, delay));
                }
            }
        }
        return false;
    }

    async updateARecord(domainConfig, recordId, newIp, oldIp) {
        const { name, zoneId, apiToken, ttl, proxied } = domainConfig;
        try {
            const success = await this.retryCloudflareAPI(async () => {
                const response = await this.fetchWithTimeout(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${apiToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        type: 'A',
                        name: name,
                        content: newIp,
                        ttl: ttl,
                        proxied: proxied
                    })
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const data = await response.json();
                if (data.success) {
                    return true;
                } else {
                    throw new Error(`Cloudflare API error: ${JSON.stringify(data.errors)}`);
                }
            }, `Cập nhật A record cho ${name}`);

            if (success) {
                console.log(`[${new Date().toISOString()}] Đã cập nhật A record cho ${name} thành ${newIp} (TTL: ${ttl}s, Proxied: ${proxied})`);
                this.successfulUpdates++;
                const message = `🌐 *Cập nhật DNS thành công* 🌐\n` +
                                `📍 *Domain*: ${name}\n` +
                                `🔄 *IP cũ*: ${oldIp}\n` +
                                `✅ *IP mới*: ${newIp}\n` +
                                `⚙️ *TTL*: ${ttl}s\n` +
                                `☁️ *Proxied*: ${proxied ? 'Yes' : 'No'}\n` +
                                `🕒 *Thời gian*: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`;
                await this.sendTelegramMessage(message);
            }
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Lỗi khi cập nhật A record cho ${name}: ${error.message}`);
            this.failedUpdates++;
        }
    }

    async checkAndUpdate() {
        // Tránh race condition - nếu đang chạy thì bỏ qua
        if (this.isRunning) {
            console.warn(`[${new Date().toISOString()}] ⚠️ checkAndUpdate đang chạy, bỏ qua lần này`);
            return;
        }

        this.isRunning = true;
        try {
            const publicIp = await this.getPublicIp();
            if (!publicIp) {
                console.error(`[${new Date().toISOString()}] Không lấy được IP công khai, bỏ qua lần này.`);
                this.retryCount++;
                return;
            }

            let hasError = false;
            for (const domainConfig of DOMAINS) {
                try {
                    const record = await this.getARecord(domainConfig);
                    if (!record) {
                        hasError = true;
                        this.failedUpdates++;
                        continue;
                    }

                    if (record.ip === publicIp) {
                        console.log(`[${new Date().toISOString()}] A record cho ${domainConfig.name} đã khớp (${publicIp}), bỏ qua.`);
                    } else {
                        console.log(`[${new Date().toISOString()}] A record cho ${domainConfig.name} khác (${record.ip} vs ${publicIp}), đang cập nhật...`);
                        await this.updateARecord(domainConfig, record.recordId, publicIp, record.ip);
                    }
                } catch (error) {
                    console.error(`[${new Date().toISOString()}] Lỗi xử lý domain ${domainConfig.name}: ${error.message}`);
                    hasError = true;
                    this.failedUpdates++;
                }
            }

            if (!hasError) {
                this.retryCount = 0; // Reset retry count khi thành công
                this.lastSuccessfulCheck = new Date();
            } else {
                this.retryCount++;
            }

            // Health check: nếu có quá nhiều lỗi liên tiếp
            if (this.retryCount >= this.MAX_RETRIES) {
                console.error(`[${new Date().toISOString()}] ❌ Quá nhiều lỗi liên tiếp (${this.retryCount}), cần kiểm tra hệ thống`);
                await this.sendTelegramMessage(`🚨 *CẢNH BÁO HỆ THỐNG* 🚨\nScript DDNS đã gặp ${this.retryCount} lỗi liên tiếp. Cần kiểm tra ngay!`);
            }

        } catch (error) {
            console.error(`[${new Date().toISOString()}] Lỗi không xác định trong checkAndUpdate: ${error.message}`);
            this.retryCount++;
            this.failedUpdates++;
        } finally {
            this.isRunning = false;
        }
    }

    // Chờ network sẵn sàng với timeout
    async waitForNetwork() {
        const MAX_WAIT_SECONDS = 180; // Tăng thời gian chờ tối đa
        const CHECK_INTERVAL = 10; // Kiểm tra mỗi 10s
        
        console.log(`[${new Date().toISOString()}] 🔄 Đang chờ network sẵn sàng (tối đa ${MAX_WAIT_SECONDS}s)...`);
        
        for (let seconds = 0; seconds < MAX_WAIT_SECONDS; seconds += CHECK_INTERVAL) {
            const ip = await this.getPublicIp();
            if (ip) {
                console.log(`[${new Date().toISOString()}] ✅ Network sẵn sàng, IP: ${ip}`);
                return ip;
            }
            
            console.log(`[${new Date().toISOString()}] ⏳ Chờ network... (${seconds}/${MAX_WAIT_SECONDS}s)`);
            await new Promise(r => setTimeout(r, CHECK_INTERVAL * 1000));
        }
        
        throw new Error(`Không thể kết nối network sau ${MAX_WAIT_SECONDS} giây`);
    }

    // Startup với retry - luôn tiếp tục dù thất bại
    async startupWithRetry() {
        console.log(`[${new Date().toISOString()}] 🔄 Đợi ${STARTUP_DELAY_SECONDS}s để hệ thống ổn định...`);
        await new Promise(r => setTimeout(r, STARTUP_DELAY_SECONDS * 1000));

        let startupSuccess = false;
        
        for (let attempt = 1; attempt <= STARTUP_RETRIES; attempt++) {
            console.log(`[${new Date().toISOString()}] 🚀 Thử kiểm tra startup (lần ${attempt}/${STARTUP_RETRIES})...`);

            try {
                const publicIp = await this.waitForNetwork();
                if (publicIp) {
                    console.log(`[${new Date().toISOString()}] ✅ Network sẵn sàng, IP hiện tại: ${publicIp}`);
                    startupSuccess = true;
                    break;
                }
            } catch (error) {
                console.warn(`[${new Date().toISOString()}] ⚠️ Lỗi startup lần ${attempt}: ${error.message}`);
            }

            if (attempt < STARTUP_RETRIES) {
                const delay = Math.min(5000 * attempt, 30000);
                console.warn(`[${new Date().toISOString()}] ⚠️ Chưa khởi động thành công, thử lại sau ${delay/1000}s...`);
                await new Promise(r => setTimeout(r, delay));
            }
        }

        if (!startupSuccess) {
            console.error(`[${new Date().toISOString()}] ❌ Không thể khởi động hoàn toàn sau ${STARTUP_RETRIES} lần thử, nhưng sẽ tiếp tục chạy...`);
        }

        // LUÔN chạy checkAndUpdate và tiếp tục dù startup có thành công hay không
        console.log(`[${new Date().toISOString()}] 🔄 Thực hiện kiểm tra đầu tiên...`);
        await this.checkAndUpdate();
        
        return startupSuccess;
    }

    // Gửi báo cáo hàng ngày lúc 8h sáng giờ Việt Nam
    async sendDailyReport() {
        const now = new Date();
        const vietnamTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
        const currentHour = vietnamTime.getHours();
        const currentDate = vietnamTime.getDate();

        // Chỉ gửi báo cáo vào 8h sáng và chưa gửi trong ngày hôm nay
        if (currentHour === 8 && currentDate !== this.lastReportDate) {
            const uptime = Math.floor((new Date() - this.startTime) / 1000 / 60 / 60); // giờ
            const successRate = this.successfulUpdates + this.failedUpdates > 0 
                ? Math.round((this.successfulUpdates / (this.successfulUpdates + this.failedUpdates)) * 100)
                : 0;

            const message = `📊 *BÁO CÁO HOẠT ĐỘNG HẰNG NGÀY* 📊\n` +
                           `⏰ *Thời gian*: ${vietnamTime.toLocaleString('vi-VN')}\n` +
                           `🕐 *Uptime*: ${uptime} giờ\n` +
                           `🌐 *Số domain*: ${DOMAINS.length}\n` +
                           `✅ *Cập nhật thành công*: ${this.successfulUpdates}\n` +
                           `❌ *Cập nhật thất bại*: ${this.failedUpdates}\n` +
                           `📈 *Tỷ lệ thành công*: ${successRate}%\n` +
                           `🔄 *Lần kiểm tra cuối*: ${this.lastSuccessfulCheck ? this.lastSuccessfulCheck.toLocaleString('vi-VN') : 'Chưa có'}\n` +
                           `⚙️ *Trạng thái*: ${this.retryCount > 0 ? 'Có vấn đề' : 'Ổn định'}`;

            const sent = await this.sendTelegramMessage(message);
            if (sent) {
                this.lastReportDate = currentDate;
                console.log(`[${new Date().toISOString()}] ✅ Đã gửi báo cáo hàng ngày`);
            }
        }
    }

    // Kiểm tra và gửi báo cáo hàng ngày
    setupDailyReport() {
        // Kiểm tra mỗi phút để xem có phải 8h sáng chưa
        this.dailyReportInterval = setInterval(() => {
            this.sendDailyReport();
        }, 60000); // 1 phút

        console.log(`[${new Date().toISOString()}] 📊 Đã thiết lập báo cáo hàng ngày lúc 8h sáng (GMT+7)`);
    }

    // Sử dụng setInterval thay vì setTimeout đệ quy
    scheduleNextCheck() {
        if (this.isShuttingDown) return;
        
        console.log(`[${new Date().toISOString()}] ⏰ Lập lịch kiểm tra định kỳ mỗi ${CHECK_INTERVAL_SECONDS} giây...`);
        
        this.mainTimer = setInterval(async () => {
            if (this.isShuttingDown) return;
            await this.checkAndUpdate();
        }, CHECK_INTERVAL_SECONDS * 1000);

        // Health check mỗi 5 phút
        this.healthCheckInterval = setInterval(() => {
            this.healthCheck();
        }, 5 * 60 * 1000);
    }

    // Health check đơn giản
    async healthCheck() {
        const now = new Date();
        const lastCheck = this.lastSuccessfulCheck;
        
        if (lastCheck && (now - lastCheck) > (CHECK_INTERVAL_SECONDS * 3 * 1000)) {
            console.warn(`[${new Date().toISOString()}] ⚠️ Health check: Không có check thành công trong ${Math.round((now - lastCheck) / 1000)}s`);
        }
    }

    // Graceful shutdown
    async gracefulShutdown(signal) {
        if (this.isShuttingDown) return;
        this.isShuttingDown = true;

        console.log(`\n[${new Date().toISOString()}] 🛑 Nhận tín hiệu ${signal}, đang dừng...`);

        // Gửi thông báo shutdown
        const uptime = Math.floor((new Date() - this.startTime) / 1000 / 60); // phút
        await this.sendTelegramMessage(`🛑 *Script DDNS đang dừng*\n⏰ *Uptime*: ${uptime} phút\n📅 *Thời gian*: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`);

        // Dừng tất cả timer
        this.stop();

        // Đợi operation hiện tại hoàn thành
        if (this.isRunning) {
            console.log(`[${new Date().toISOString()}] ⏳ Đang đợi operation hiện tại hoàn thành...`);
            
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Shutdown timeout')), 30000)
            );
            
            const completionPromise = new Promise(resolve => {
                const check = setInterval(() => {
                    if (!this.isRunning) {
                        clearInterval(check);
                        resolve();
                    }
                }, 100);
            });

            try {
                await Promise.race([completionPromise, timeoutPromise]);
                console.log(`[${new Date().toISOString()}] ✅ Script đã dừng an toàn`);
                process.exit(0);
            } catch (error) {
                console.error(`[${new Date().toISOString()}] ⚠️ ${error.message}, thoát cưỡng bức`);
                process.exit(1);
            }
        } else {
            console.log(`[${new Date().toISOString()}] ✅ Script đã dừng an toàn`);
            process.exit(0);
        }
    }

    stop() {
        if (this.mainTimer) {
            clearInterval(this.mainTimer);
            this.mainTimer = null;
        }
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
        if (this.dailyReportInterval) {
            clearInterval(this.dailyReportInterval);
            this.dailyReportInterval = null;
        }
        console.log(`[${new Date().toISOString()}] ✅ Đã dừng tất cả timer`);
    }

    // Khởi động service
    async start() {
        console.log(`[${new Date().toISOString()}] 🚀 Bắt đầu script Dynamic DNS...`);
        
        // Load config với retry
        const configLoaded = await this.loadConfigWithRetry();
        if (!configLoaded) {
            console.error(`[${new Date().toISOString()}] ❌ Không thể load config, dừng script`);
            process.exit(1);
        }
        
        this.validateConfig();
        console.log(`[${new Date().toISOString()}] ⚙️ Startup delay: ${STARTUP_DELAY_SECONDS}s, Startup retries: ${STARTUP_RETRIES}, Check interval: ${CHECK_INTERVAL_SECONDS}s`);

        // Đăng ký signal handlers
        process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
        process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));

        // Thiết lập báo cáo hàng ngày
        this.setupDailyReport();

        // Khởi động và LUÔN tiếp tục dù kết quả thế nào
        await this.startupWithRetry();
        this.scheduleNextCheck();
    }
}

// Khởi động service
const service = new DDNSService();
service.start().catch(error => {
    console.error(`[${new Date().toISOString()}] ❌ Lỗi khởi động service: ${error.message}`);
    process.exit(1);
});
