const { createServer } = require('node:http')
const fs = require('node:fs')
const path = require('node:path')

const hostname = '127.0.0.1'
const port = 3000

const DATA_FILE = path.join(__dirname, 'data.csv')
const TASK_FILE = path.join(__dirname, 'task.csv')

// Id của người dùng đang đăng nhập (null = chưa đăng nhập)
let currentUserId = null

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

// Kiểm tra đăng nhập: chưa đăng nhập thì trả 401 + false, ngược lại true
function requireLogin(res) {
    if (currentUserId === null) {
        sendJson(res, 401, { message: 'Please login' })
        return false
    }
    return true
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

            // Nếu đang đăng nhập bằng id khác -> đăng xuất, thay bằng id mới
            if (currentUserId !== null && currentUserId !== account.id) {
                console.log(`Logout id ${currentUserId}`)
            }

            // Lưu id và xem như đã đăng nhập
            currentUserId = account.id

            sendJson(res, 200, { status: 'OK', id: currentUserId })
        })

        return
    }

    // DELETE /user: nhận {id} (bắt buộc đăng nhập)
    if (req.method === 'DELETE' && req.url === '/user') {
        if (!requireLogin(res)) return

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
        if (!requireLogin(res)) return

        // Tìm tài khoản đang đăng nhập theo id
        const account = readAccounts().find((acc) => acc.id === currentUserId)
        const { password, ...payload } = account

        sendJson(res, 200, payload)

        return
    }

    // POST /task: nhận {id, userId, task} (bắt buộc đăng nhập)
    if (req.method === 'POST' && req.url === '/task') {
        if (!requireLogin(res)) return

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
        if (!requireLogin(res)) return

        sendJson(res, 200, readTasks())

        return
    }

    // PATCH /assign-task: nhận {id, userId} (bắt buộc đăng nhập)
    if (req.method === 'PATCH' && req.url === '/assign-task') {
        if (!requireLogin(res)) return

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
        if (!requireLogin(res)) return

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