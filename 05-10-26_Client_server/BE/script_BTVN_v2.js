const { createServer } = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const hostname = '127.0.0.1'
const port = 3000

const DATA_FILE = path.join(__dirname, 'data.csv')
const TASK_FILE = path.join(__dirname, 'task.csv')
const TOKEN_FILE = path.join(__dirname, 'token.csv')
const FE_INDEX = path.join(__dirname, '..', 'FE', 'index.html')

// Đọc token.csv và trả về danh sách phiên đăng nhập {token, userId}
function readTokens() {
    if (!fs.existsSync(TOKEN_FILE)) return []

    const lines = fs
        .readFileSync(TOKEN_FILE, 'utf8')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '')

    // Bỏ dòng tiêu đề (token, userId), phần còn lại là dữ liệu
    return lines.slice(1).map((line) => {
        const [token, userId] = line.split(',').map((part) => part.trim())
        return { token, userId: Number(userId) }
    })
}

// Ghi danh sách phiên đăng nhập xuống token.csv (tạo file nếu chưa có)
function writeTokens(tokens) {
    const content =
        'token, userId\n' +
        tokens.map((item) => `${item.token}, ${item.userId}\n`).join('')

    fs.writeFileSync(TOKEN_FILE, content)
}

// Lấy access token từ header: Authorization: Bearer <token>
function getTokenFromRequest(req) {
    const auth = req.headers['authorization']

    if (auth && auth.startsWith('Bearer ')) {
        return auth.slice(7).trim()
    }

    return null
}

// Tìm userId theo access token trong token.csv (null nếu token không hợp lệ)
function findUserIdByToken(token) {
    if (!token) return null

    const session = readTokens().find((item) => item.token === token)
    return session ? session.userId : null
}

// Đọc data.csv và trả về danh sách tài khoản {id, username, password}
function readAccounts() {
    if (!fs.existsSync(DATA_FILE)) return []

    const lines = fs
        .readFileSync(DATA_FILE, 'utf8')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '')

    // Bỏ dòng tiêu đề (id, username, password), phần còn lại là dữ liệu
    return lines.slice(1).map((line) => {
        const [id, username, password] = line.split(',').map((part) => part.trim())
        return { id: Number(id), username, password }
    })
}

// Đọc task.csv và trả về danh sách task {id, userId, task}
function readTasks() {
    if (!fs.existsSync(TASK_FILE)) return []

    const lines = fs
        .readFileSync(TASK_FILE, 'utf8')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '')

    // Bỏ dòng tiêu đề (id, userId, task), phần còn lại là dữ liệu
    return lines.slice(1).map((line) => {
        const [id, userId, task] = line.split(',').map((part) => part.trim())
        return { id: Number(id), userId: Number(userId), task }
    })
}

// Xóa account có id tương ứng
function deleteAccountById(id) {
    const accounts = readAccounts()
    const remaining = accounts.filter((acc) => acc.id !== id)

    // Không có gì thay đổi -> không tìm thấy id
    if (remaining.length === accounts.length) return false

    const content =
        'id, username, password\n' +
        remaining.map((acc) => `${acc.id}, ${acc.username}, ${acc.password}\n`).join('')

    fs.writeFileSync(DATA_FILE, content)
    return true
}

// Xóa task có id tương ứng trong task.csv
function deleteTaskById(id) {
    const tasks = readTasks()
    const remaining = tasks.filter((task) => task.id !== id)

    // Không có gì thay đổi -> không tìm thấy id
    if (remaining.length === tasks.length) return false

    const content =
        'id, userId, task\n' +
        remaining.map((task) => `${task.id}, ${task.userId}, ${task.task}\n`).join('')

    fs.writeFileSync(TASK_FILE, content)
    return true
}

// Cập nhật userId của task có id tương ứng trong task.csv, trả về true nếu tìm thấy
function assignTask(id, userId) {
    const tasks = readTasks()
    let found = false

    const updated = tasks.map((task) => {
        if (task.id === id) {
            found = true
            return { ...task, userId }
        }
        return task
    })

    // Không có gì thay đổi -> không tìm thấy id
    if (!found) return false

    const content =
        'id, userId, task\n' +
        updated.map((task) => `${task.id}, ${task.userId}, ${task.task}\n`).join('')

    fs.writeFileSync(TASK_FILE, content)
    return true
}

// Gửi response dạng JSON
function sendJson(res, statusCode, payload) {
    res.statusCode = statusCode
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(payload))
}

// Cho phép trang HTML mở trực tiếp từ ổ đĩa (file://) gọi được server này.
// Khi mở bằng file://, trình duyệt coi origin là "null" nên cần các header CORS dưới đây.
function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

// Kiểm tra đăng nhập dựa vào access token trong header:
// hợp lệ thì trả về userId, ngược lại trả 401 + null
function requireLogin(req, res) {
    const userId = findUserIdByToken(getTokenFromRequest(req))

    if (userId === null) {
        sendJson(res, 401, { message: 'Please login' })
        return null
    }

    return userId
}

// Gom body của request rồi parse JSON, gọi callback với object nhận được
function readBody(req, callback) {
    let body = ''

    // Body gửi lên bị chia thành nhiều mảnh, gom lại cho đủ
    req.on('data', (chunk) => {
        body += chunk
    })

    // Đã nhận đủ body -> parse JSON rồi xử lý
    req.on('end', () => {
        const data = JSON.parse(body || '{}')
        callback(data)
    })
}

const server = createServer((req, res) => {
    setCorsHeaders(res)

    // Trình duyệt tự gửi request OPTIONS (preflight) trước request thật khi khác origin.
    // Trả lời rỗng (204) để trình duyệt cho phép gửi tiếp request chính.
    if (req.method === 'OPTIONS') {
        res.statusCode = 204
        res.end()
        return
    }

    // GET /: trả về trang giao diện FE
    if (req.method === 'GET' && req.url === '/') {
        try {
            const html = fs.readFileSync(FE_INDEX, 'utf8')
            res.statusCode = 200
            res.setHeader('Content-Type', 'text/html; charset=utf-8')
            res.end(html)
        } catch (error) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'text/plain; charset=utf-8')
            res.end('Không tìm thấy FE/index.html')
        }

        return
    }

    // POST /sign-up: nhận {id, username, password} (không cần đăng nhập)
    if (req.method === 'POST' && req.url === '/sign-up') {
        readBody(req, (user) => {
            // Chưa có file (hoặc file rỗng) thì tạo mới kèm dòng tiêu đề
            if (!fs.existsSync(DATA_FILE) || fs.statSync(DATA_FILE).size === 0) {
                fs.writeFileSync(DATA_FILE, 'id, username, password\n')
            }

            // Ghi thêm 1 dòng dữ liệu vừa nhận
            fs.appendFileSync(DATA_FILE, `${user.id}, ${user.username}, ${user.password}\n`)

            sendJson(res, 200, { status: 'OK' })
        })

        return
    }

    // POST /login: nhận {username, password} (không cần đăng nhập)
    if (req.method === 'POST' && req.url === '/login') {
        readBody(req, (login) => {
            // Tìm tài khoản khớp cả username và password trong data.csv
            const account = readAccounts().find(
                (acc) => acc.username === login.username && acc.password === login.password
            )

            // Không hợp lệ -> báo không tìm thấy tài khoản
            if (!account) {
                sendJson(res, 401, { message: 'Cannot find account' })
                return
            }

            // Sinh access token mới cho phiên đăng nhập này
            const token = crypto.randomUUID()

            // Ghi phiên vào token.csv: xóa phiên cũ của user rồi thêm phiên mới
            // (token.csv chưa có sẽ được tạo tự động trong writeTokens)
            const tokens = readTokens().filter((item) => item.userId !== account.id)
            tokens.push({ token, userId: account.id })
            writeTokens(tokens)

            // Trả token cho client để dùng cho các request sau
            sendJson(res, 200, { status: 'OK', id: account.id, accessToken: token })
        })

        return
    }

    // DELETE /user: nhận {id} (bắt buộc đăng nhập)
    if (req.method === 'DELETE' && req.url === '/user') {
        const currentUserId = requireLogin(req, res)
        if (currentUserId === null) return

        readBody(req, ({ id }) => {
            // Đang đăng nhập bằng chính id này -> không thể xóa
            if (id === currentUserId) {
                sendJson(res, 400, { message: 'Đang đăng nhập, không thể xóa' })
                return
            }

            // Tìm thấy id tương ứng -> xóa
            if (deleteAccountById(id)) {
                sendJson(res, 200, { status: 'OK' })
                return
            }

            // Không tìm thấy id tương ứng
            sendJson(res, 404, { message: 'Cannot find account' })
        })

        return
    }

    // GET /me (bắt buộc đăng nhập)
    if (req.method === 'GET' && req.url === '/me') {
        const currentUserId = requireLogin(req, res)
        if (currentUserId === null) return

        // Tìm tài khoản đang đăng nhập theo id
        const account = readAccounts().find((acc) => acc.id === currentUserId)
        const { password, ...payload } = account

        sendJson(res, 200, payload)

        return
    }

    // POST /task: nhận {id, userId, task} (bắt buộc đăng nhập)
    if (req.method === 'POST' && req.url === '/task') {
        if (requireLogin(req, res) === null) return

        readBody(req, (task) => {
            // Chưa có file (hoặc file rỗng) thì tạo mới kèm dòng tiêu đề
            if (!fs.existsSync(TASK_FILE) || fs.statSync(TASK_FILE).size === 0) {
                fs.writeFileSync(TASK_FILE, 'id, userId, task\n')
            }

            // Ghi thêm 1 dòng dữ liệu vừa nhận
            fs.appendFileSync(TASK_FILE, `${task.id}, ${task.userId}, ${task.task}\n`)

            sendJson(res, 200, { status: 'OK' })
        })

        return
    }

    // GET /tasks: trả về toàn bộ task có trong task.csv (bắt buộc đăng nhập)
    if (req.method === 'GET' && req.url === '/tasks') {
        if (requireLogin(req, res) === null) return

        sendJson(res, 200, readTasks())

        return
    }

    // PATCH /assign-task: nhận {id, userId} (bắt buộc đăng nhập)
    if (req.method === 'PATCH' && req.url === '/assign-task') {
        if (requireLogin(req, res) === null) return

        readBody(req, ({ id, userId }) => {
            // Tìm thấy id tương ứng -> sửa userId
            if (assignTask(id, userId)) {
                sendJson(res, 200, { status: 'OK' })
                return
            }

            // Không tìm thấy id tương ứng
            sendJson(res, 404, { message: 'Cannot find task' })
        })

        return
    }

    // DELETE /task: nhận {id} (bắt buộc đăng nhập)
    if (req.method === 'DELETE' && req.url === '/task') {
        if (requireLogin(req, res) === null) return

        readBody(req, ({ id }) => {
            // Tìm thấy id tương ứng -> xóa
            if (deleteTaskById(id)) {
                sendJson(res, 200, { status: 'OK' })
                return
            }

            // Không tìm thấy id tương ứng
            sendJson(res, 404, { message: 'Cannot find task' })
        })

        return
    }
})

server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`)
})