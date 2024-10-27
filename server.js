const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../student'))); // ให้บริการไฟล์ static

// ตั้งค่า PostgreSQL client
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'student', // เปลี่ยนให้ตรงกับชื่อฐานข้อมูลของคุณ
    password: 'jaja4433', // รหัสผ่านฐานข้อมูลของคุณ
    port: 5432,
});

// ฟังก์ชันสำหรับตรวจสอบ token
function authenticateToken(req, res, next) {
    const token = req.headers['authorization'] && req.headers['authorization'].split(' ')[1];
    if (!token) return res.sendStatus(401); // ถ้าไม่มี token
    jwt.verify(token, 'your_jwt_secret', (err, user) => {
        if (err) return res.sendStatus(403); // ถ้า token ไม่ถูกต้อง
        req.user = user; // เก็บข้อมูลผู้ใช้ใน req.user
        next(); // ดำเนินการต่อไป
    });
}

// เส้นทางเว็บ
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../student/public/login.html'));
});

app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../student/public/index.html'));
});

app.get('/register.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../student/public/register.html'));
});
app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../student/public/login.html'));
});

app.get('/add_student.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../student/public/add_student.html'));
});

// API สำหรับดึงข้อมูลนักเรียน
app.get('/students', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM public.student');
        const students = result.rows.map(student => ({
            ...student,
            checkedIn: student.status === 'Y' // สมมติว่า 'Y' แสดงว่าเช็คชื่อแล้ว
        }));
        res.json(students);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching data' });
    }
});


// API สำหรับแก้ไขข้อมูลนักเรียน
app.put('/edit-student', authenticateToken, async (req, res) => {
    const { studentId, firstName, lastName, phone, email } = req.body;
    try {
        await pool.query(
            `UPDATE public.student 
            SET first_name = $1, last_name = $2, telephone = $3, "e-mail" = $4 
            WHERE "Studentid" = $5`,
            [firstName, lastName, phone, email, studentId]
        );
        res.json({ message: 'Student information updated successfully!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error updating student information' });
    }
});

// API สำหรับเช็คชื่อนักศึกษา
app.post('/attendance', authenticateToken, async (req, res) => {
    const { studentId, attendanceStatus } = req.body;
    try {
        await pool.query('UPDATE public.student_list SET status = $1 WHERE "Studentid" = $2', [attendanceStatus ? 'Y' : 'N', studentId]);
        res.json({ message: 'Attendance updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error updating attendance' });
    }
});

// API สำหรับลบข้อมูลนักเรียน
app.delete('/delete-student', authenticateToken, async (req, res) => {
    const { studentId } = req.body;
    try {
        await pool.query('DELETE FROM public.student WHERE "Studentid" = $1', [studentId]);
        res.json({ message: 'Student deleted successfully!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error deleting student' });
    }
});

// ฟังก์ชันสำหรับเพิ่มข้อมูลนักศึกษาใหม่
app.post('/add_student', async (req, res) => {
    const { studentId, firstName, lastName, phone, email } = req.body;
    try {
        const query = `
            INSERT INTO public.student ("Studentid", first_name, last_name, telephone, "e-mail", status)
            VALUES ($1, $2, $3, $4, $5, 'active')
        `;
        await pool.query(query, [studentId, firstName, lastName, phone, email]);
        res.json({ message: 'Student added successfully!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error adding student' });
    }
});

// API สำหรับการลงทะเบียนผู้ใช้
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10); // เข้ารหัสรหัสผ่าน
        await pool.query('INSERT INTO public.users (username, password) VALUES ($1, $2)', [username, hashedPassword]);
        res.json({ message: 'User registered successfully!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error registering user' });
    }
});

// API สำหรับการล็อกอิน
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM public.users WHERE username = $1', [username]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            const match = await bcrypt.compare(password, user.password);
            if (match) {
                const token = jwt.sign({ id: user.id, username: user.username }, 'your_jwt_secret', { expiresIn: '1h' });
                res.json({ token });
            } else {
                res.status(401).json({ error: 'Invalid credentials' });
            }
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error logging in' });
    }
});

// เริ่มต้นเซิร์ฟเวอร์
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
