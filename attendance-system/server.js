// const express = require('express');
// const mysql = require('mysql2');
// const cors = require('cors');

// // Set up the Express app
// const app = express();
// const PORT = 3000;

// app.use(cors());
// // Set up the MySQL connection
// const db = mysql.createConnection({
//     host: 'localhost',      // Replace with your DB host
//     user: 'root',           // Replace with your DB user
//     password: '',           // Replace with your DB password
//     database: 'biometricattendance_ftc_db'
// });

// // Connect to MySQL
// db.connect(err => {
//     if (err) throw err;
//     console.log('MySQL connected');
// });
// // Mapping of IDs to Names
// const nationalityMap = {
//     1: 'India',
//     2: 'Turkey',
//     3: 'United Arab Emirates',
//     4: 'Nepal',
//     5: 'Egypt',
//     6: 'Bangladesh',
//     7: 'Pakistan',
//     8: 'Canada',
//     9: 'Jordan',
//     10: 'Oman',
//     11: 'United Kingdom'
// };

// const departmentMap = {
//     1: 'Engineering',
//     2: 'Finance',
//     3: 'HR & Admin',
//     4: 'Information Technology',
//     5: 'Management',
//     6: 'Operations',
//     7: 'QHSSE',
//     8: 'Sales & Marketing',
//     9: 'Supply Chain'
// };

// const siteMap = {
//     1: 'ICAD 2',
//     2: 'ICAD 1',
//     3: 'M46'
// };
// // Function to calculate overall attendance
// function calculateAttendance(data) {
//     let present = 0;
//     let absent = 0;
//     let Ms = 0;

//     data.forEach(record => {
//         const { clock_in, clock_out } = record;

//         if (clock_in && clock_out) {
//             present += 1;
//         } else if (clock_in || clock_out) {
//             Ms += 1;
//         }
//     });

//     // Assuming total number of employees is 456
//     absent = 456 - present - Ms;

//     return { present, absent, Ms };
// }
// // Endpoint to fetch overall attendance
// app.get('/api/attendance', (req, res) => {
//     const { date } = req.query;

//     if (!date) {
//         return res.status(400).json({ error: 'Please provide a date parameter' });
//     }

//     const query = `
//         SELECT empid, date, clock_in, clock_out
//         FROM input_data
//         WHERE date = ?
//     `;

//     db.query(query, [date], (err, results) => {
//         if (err) {
//             console.error('Error executing query:', err);
//             return res.status(500).json({ error: err.message });
//         }

//         const attendance = calculateAttendance(results);
//         res.json(attendance);
//     });
// });
// // Endpoint to fetch attendance distribution
// app.get('/api/attendance-distribution', (req, res) => {
//     const { date, type } = req.query;

//     if (!date || !type) {
//         return res.status(400).json({ error: 'Please provide date and type parameters' });
//     }

//     let groupField = '';
//     let nameMap = {};

//     if (type === 'nationality') {
//         groupField = 'e.NationalityID';
//         nameMap = nationalityMap;
//     } else if (type === 'department') {
//         groupField = 'e.DepId';
//         nameMap = departmentMap;
//     } else if (type === 'location') {
//         groupField = 'e.SiteId';
//         nameMap = siteMap;
//     } else {
//         res.status(400).json({ error: 'Invalid type parameter' });
//         return;
//     }

//     const query = `
//         SELECT ${groupField} AS groupId, COUNT(DISTINCT e.EmpID) AS employeeCount
//         FROM employee_master e
//         JOIN input_data i ON e.EmpID = i.empid
//         WHERE i.date = ?
//         GROUP BY ${groupField}
//     `;

//     db.query(query, [date], (err, results) => {
//         if (err) {
//             console.error('Error executing query:', err);
//             return res.status(500).json({ error: err.message });
//         }

//         const data = results.map(record => ({
//             id: record.groupId,
//             label: nameMap[record.groupId] || `Unknown (${record.groupId})`,
//             count: record.employeeCount
//         }));

//         res.json(data);
//     });
// });
// /// Endpoint to fetch visa distribution
// app.get('/api/visa-distribution', (req, res) => {
//     const { date } = req.query;

//     if (!date) {
//         return res.status(400).json({ error: 'Please provide a date parameter' });
//     }

//     const query = `
//         SELECT v.visaType, COUNT(*) AS count
//         FROM employee_master e
//         JOIN visa v ON e.VisaId = v.visaId
//         JOIN input_data i ON e.EmpID = i.empid
//         WHERE i.date = ? AND i.clock_in IS NOT NULL AND i.clock_out IS NOT NULL
//         GROUP BY v.visaType
//     `;

//     db.query(query, [date], (err, results) => {
//         if (err) {
//             console.error('Error executing query:', err);
//             return res.status(500).json({ error: err.message });
//         }

//         res.json(results);
//     });
// });
// // Endpoint to fetch employee attendance details
// app.get('/api/employee-attendance', (req, res) => {
//     const { date } = req.query;

//     if (!date) {
//         return res.status(400).json({ error: 'Please provide a date parameter' });
//     }

//     const query = `
//         SELECT e.EmpID, e.FullName, e.EmailID, v.visaType,
//                CASE 
//                    WHEN i.clock_in IS NOT NULL AND i.clock_out IS NOT NULL THEN 'Present'
//                    WHEN i.clock_in IS NULL AND i.clock_out IS NULL THEN 'Absent'
//                    ELSE 'Ms'
//                END AS attendanceStatus
//         FROM employee_master e
//         JOIN visa v ON e.VisaId = v.visaId
//         LEFT JOIN input_data i ON e.EmpID = i.empid AND i.date = ?
//     `;

//     db.query(query, [date], (err, results) => {
//         if (err) {
//             console.error('Error executing query:', err);
//             return res.status(500).json({ error: err.message });
//         }

//         res.json(results);
//     });
// });
// // Serve the HTML file
// app.get('/', (req, res) => {
//     res.sendFile(__dirname + '/index.html');
// });

// // Start the server
// app.listen(PORT, () => {
//     console.log(`Server running on port ${PORT}`);
// });
