const {createServer} = require('node:http')
const fs = require('node:fs')
const path = require('node:path')

const hostname = '127.0.0.1'
const port = 3000

// File lưu dữ liệu, nằm cùng thư mục với script.js
const DATA_FILE = path.join(__dirname, 'data.csv')

const server = createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/me') {
        const payload = {
            data: 'My name is Lam',
            status: 'OK'
        }

        res.statusCode = 200
        res.setHeader('Content-Type', 'text/plain')
        res.end(JSON.stringify(payload, null, 2))
        return 
    }

    // POST /user: nhận {username, isMale} -> ghi vào data.csv -> trả {status: 'OK'}
    if (req.method === 'POST' && req.url === '/user') {
        let body = ''

        // Body gửi lên bị chia thành nhiều mảnh, gom lại cho đủ
        req.on('data', (chunk) => {
            body += chunk
        })

        // Đã nhận đủ body -> xử lý
        req.on('end', () => {
            const user = JSON.parse(body)

            // Chưa có file thì tạo mới kèm dòng tiêu đề
            if (!fs.existsSync(DATA_FILE)) {
                fs.writeFileSync(DATA_FILE, 'username,isMale\n')
            }

            // Ghi thêm 1 dòng dữ liệu vừa nhận
            fs.appendFileSync(DATA_FILE, `${user.username},${user.isMale}\n`)

            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ status: 'OK' }, null, 2))
        })

        return
    }

    res.statusCode = 200
    res.setHeader('Content-Type', 'text/plain')
    res.end('Hello World!')
})

server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}`)
})