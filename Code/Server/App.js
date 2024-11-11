
const express = require('express');
const dotenv = require('dotenv');
const mysql = require('mysql');
const cors = require('cors');
const app = express();
const path = require("path");
const winston = require('winston');
const XLSX = require('xlsx');
const fs = require('fs');
const chokidar = require('chokidar');
const { processExcelData, mainDataSync } = require('./dataSync');

const redis = require('redis');
const { promisify } = require('util');

dotenv.config();


const PORT = process.env.PORT || 8000;
app.use(cors());


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const dbService = require('./dbService.js'); 
 const { Console } = require('console');
const moment = require('moment/moment.js');
const db = dbService.getDbServiceInstance();


app.use(express.static(path.join(__dirname, '../../Client')));
app.use(express.static(path.join(__dirname, '../Client')));

const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
    //    new winston.transports.File({ filename: 'combined.log' }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});



app.use((err, req, res, next) => {
    logger.error('Unhandled error:', { 
        error: err.message, 
        stack: err.stack,
        path: req.path,
        method: req.method,
        query: req.query,
        body: req.body
    });
    res.status(500).json({ 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message
    });
});







const excelFilePath = path.join(
//    __dirname, 'tEnter.xlsx'
"C:/Users/Hp/OneDrive/Desktop/tEnter.xlsx"
);
const watcher = chokidar.watch(excelFilePath, { persistent: true });

watcher.on('change', async (path) => {
  console.log(`File ${path} has been changed`);
  await mainDataSync(excelFilePath);
});



//comment this part only temporart to make testing faster.
// Initial sync on startup
// if (fs.existsSync(excelFilePath)) {
//   mainDataSync( excelFilePath);
// }

// Sync every 5 minutes
// setInterval(() => {
//   if (fs.existsSync(excelFilePath)) {
//     mainDataSync( excelFilePath);
//   }
// }, 5 * 60 * 1000);




// Add this new endpoint near your other endpoints
app.post('/api/trigger-sync', async (req, res) => {
  try {
    await mainDataSync( excelFilePath);
    res.json({ message: 'Data synchronization triggered successfully' });
  } catch (error) {
    logger.error('Error triggering data sync:', error);
    res.status(500).json({ error: 'Failed to trigger data synchronization' });
  }
});










app.get('/api/admin-credentials', (req, res) => {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    res.json({
        email: adminEmail,
        password: adminPassword,
    });
});


app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname,'..','Client','Login.html'));
});


app.post('/api/input/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const result = await db.insertInput(id);
        if (result === null) {
            res.status(404).send({ message: 'Employee not found' });
        } else {
            res.json({ result });
        }
    } catch (error) {
        console.error('Error handling POST request:', error);
        res.status(500).send({ message: 'Internal Server Error' });
    }
});

app.patch('/api/update/:id', async (req, res) => {
    try {
        const id = req.params.id;
        console.log("id is",id)
        const result = await db.updateClockOut(id);
        if (result.affectedRows === 0) {
            res.status(404).send({ message: 'Employee not found or no record to update' });
        } else {
            res.json({ message: 'Clock out time updated successfully', result });
        }
    } catch (error) {
        console.error('Error handling PATCH request:', error);
        res.status(500).send({ message: 'Internal Server Error' });
    }
});



app.get('/api/employees/:id', async (req, res) => {
    console.log(req.params.id);
     console.log("api is working");
    const id = req.params.id;
    console.log(id);
    const employee = await db.getEmployee(id);
    console.log("app.js ",employee);
    //res.send(employee);
    if (employee === null) {
        res.status(404).send({ message: 'Employee not found' });
      } else {
     res.json({ employee });
      }
})


// Filter options endpoint
app.get('/api/filter-options', async (req, res) => {
    logger.info('Received request for filter options');
    try {
        const options = await db.getFilterOptions();
        logger.debug('Successfully retrieved filter options', { options });
        res.json(options);
    } catch (error) {
        logger.error('Error getting filter options', { 
            error: error.message, 
            stack: error.stack 
        });
        res.status(500).json({ 
            error: 'Failed to retrieve filter options',
            details: error.message 
        });
    }
});




app.get('/api/attendance-report', async (req, res) => {
    logger.info('Received attendance report request', { query: req.query });
    try {
        const filters = {
            dateFrom: req.query.dateFrom,
            dateTo: req.query.dateTo,
            empId: req.query.empId,
            empName: req.query.empName,
            department: req.query.department,
            site: req.query.site,
            nationality: req.query.nationality,
            visa: req.query.visa
        };

        // Pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 100; // Default to 100 records per page
        const offset = (page - 1) * limit;

        // Validate date range if provided
        if (filters.dateFrom && filters.dateTo) {
            if (new Date(filters.dateFrom) > new Date(filters.dateTo)) {
                throw new Error('Invalid date range: Start date cannot be after end date');
            }
        }

        logger.debug('Processing report with filters and pagination', { filters, page, limit });
        const { report, totalRecords } = await db.generateAttendanceReport(filters, limit, offset);
        logger.info('Successfully generated report', { 
            recordCount: report.length,
            totalRecords
        });
        res.json({ report, totalRecords, page, limit });
    } catch (error) {
        logger.error('Error generating attendance report', { 
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ 
            error: 'Failed to generate attendance report',
            details: error.message 
        });
    }
});




// Route handler for attendance report
// app.get('/api/attendance-report', async (req, res) => {
//     const { dateFrom, dateTo, empId, empName, department, site, nationality, limit = 100, page = 1 } = req.query;

//     // Construct filters
//     const filters = {};
//     if (dateFrom) filters.dateFrom = dateFrom;
//     if (dateTo) filters.dateTo = dateTo;
//     if (empId) filters.empId = empId;
//     if (empName) filters.empName = empName;
//     if (department) filters.department = department;
//     if (site) filters.site = site;
//     if (nationality) filters.nationality = nationality;

//     // Pagination
//     const limitNum = parseInt(limit, 10);
//     const pageNum = parseInt(page, 10);
//     const offset = (pageNum - 1) * limitNum;

//     try {
//         // Count total records
//         const countSQL = `
//             SELECT COUNT(*) as total
//             FROM general_attendance_report gar
//             JOIN employee_master em ON gar.emp_id = em.EmpID
//             JOIN departments d ON em.depId = d.depId
//             JOIN shift s ON em.ShiftId = s.Shift_id
//             JOIN section sec ON d.section_Id = sec.sectionId
//             JOIN sites st ON sec.site_id = st.siteId
//             JOIN nationalities n ON em.nationalityId = n.nationalityId
//             WHERE 1=1
//             ${filters.dateFrom ? 'AND gar.shift_date >= ?' : ''}
//             ${filters.dateTo ? 'AND gar.shift_date <= ?' : ''}
//             ${filters.empId ? 'AND gar.emp_id = ?' : ''}
//             ${filters.empName ? 'AND (em.EmpFName LIKE ? OR em.EmpLName LIKE ?)' : ''}
//             ${filters.department ? 'AND d.depName = ?' : ''}
//             ${filters.site ? 'AND st.siteName = ?' : ''}
//             ${filters.nationality ? 'AND n.NationalityName = ?' : ''}
//         `;
//         const countValues = [];
//         if (filters.dateFrom) countValues.push(filters.dateFrom);
//         if (filters.dateTo) countValues.push(filters.dateTo);
//         if (filters.empId) countValues.push(filters.empId);
//         if (filters.empName) {
//             countValues.push(`%${filters.empName}%`, `%${filters.empName}%`);
//         }
//         if (filters.department) countValues.push(filters.department);
//         if (filters.site) countValues.push(filters.site);
//         if (filters.nationality) countValues.push(filters.nationality);
//         const countResult = await db.queryDB(countSQL, countValues);
//         const totalRecords = countResult[0]?.total || 0;

//         // Fetch the actual report data
//         const reportSQL = `
//             SELECT
//                 gar.emp_id,
//                 em.EmpFName,
//                 em.EmpLName,
//                 gar.shift_date,
//                 gar.first_in,
//                 gar.last_out,
//                 gar.status,
//                 gar.leave_id,
//                 gar.awh,
//                 gar.ot
//             FROM general_attendance_report gar
//             JOIN employee_master em ON gar.emp_id = em.EmpID
//             JOIN departments d ON em.depId = d.depId
//             JOIN shift s ON em.ShiftId = s.Shift_id
//             JOIN section sec ON d.section_Id = sec.sectionId
//             JOIN sites st ON sec.site_id = st.siteId
//             JOIN nationalities n ON em.nationalityId = n.nationalityId
//             WHERE 1=1
//             ${filters.dateFrom ? 'AND gar.shift_date >= ?' : ''}
//             ${filters.dateTo ? 'AND gar.shift_date <= ?' : ''}
//             ${filters.empId ? 'AND gar.emp_id = ?' : ''}
//             ${filters.empName ? 'AND (em.EmpFName LIKE ? OR em.EmpLName LIKE ?)' : ''}
//             ${filters.department ? 'AND d.depName = ?' : ''}
//             ${filters.site ? 'AND st.siteName = ?' : ''}
//             ${filters.nationality ? 'AND n.NationalityName = ?' : ''}
//             ORDER BY gar.shift_date DESC
//             LIMIT ? OFFSET ?
//         `;
//         const reportValues = [...countValues, limitNum, offset];
//         const reportData = await db.queryDB(reportSQL, reportValues);

//         // Construct response
//         const response = {
//             recordCount: reportData.length,
//             totalRecords,
//             data: reportData
//         };
//         res.json(response);
//         logger.info('Successfully generated report', { recordCount: reportData.length, totalRecords, timestamp: new Date().toISOString() });
//     } catch (err) {
//         logger.error('Error generating attendance report', {
//             error: err.message,
//             stack: err.stack
//         });
//         res.status(500).json({
//             error: 'Failed to generate attendance report',
//             details: err.message
//         });
//     }
// });







async function getPrimaryKeys(table) {
    const query = `
        SELECT k.COLUMN_NAME
        FROM information_schema.table_constraints t
        JOIN information_schema.key_column_usage k
        USING(constraint_name,table_schema,table_name)
        WHERE t.constraint_type='PRIMARY KEY'
          AND t.table_schema=DATABASE()
          AND t.table_name=?;
    `;
    return await db.executeQuery(query, [table]);
}



app.get('/tableInfo/:table', async (req, res) => {
    try {
        const TABLE = req.params.table;
        // Validate table name to prevent SQL injection
        const validTables = ['accommodation', 'asst_master', 'company', 'departments', 'employee_master', 'general_attendance_report', 'grade', 'holidays', 'input_data', 'jobtitle', 'nationalities', 'section', 'shift', 'sites', 'test_user', 'visa', 'weekend'];
        if (!validTables.includes(TABLE)) {
            return res.status(400).json({ error: 'Invalid table name' });
        }
        
// if(TABLE==input_data){
// }

        console.log(`Attempting to fetch data from table: ${TABLE}`);
        const primaryKeys = await getPrimaryKeys(TABLE);
        const data = await db.executeQuery(`SELECT * FROM ${TABLE}`);
        console.log(`Data fetched from ${TABLE}:`, data);
        
        if (data.length === 0) {
            console.log(`No data found in table: ${TABLE}`);
            return res.json({ primaryKeys: primaryKeys.map(pk => pk.COLUMN_NAME), data: [] });
        }
        
        res.json({ primaryKeys: primaryKeys.map(pk => pk.COLUMN_NAME), data });
    } catch (error) {
        console.error(`Error fetching data from table ${req.params.table}:`, error);
        res.status(500).json({ error: error.message });
    }
});
  

app.post('/updateTable', async (req, res) => {
    try {
        const { table, primaryKeys, primaryKeyValues, column, value } = req.body;
        console.log('Update request:', { table, primaryKeys, primaryKeyValues, column, value });

        const whereClause = primaryKeys.map((key, index) => `${key} = ?`).join(' AND ');
        const sql = `UPDATE ${table} SET ${column} = ? WHERE ${whereClause}`;
        console.log('SQL query:', sql);

        const result = await db.executeQuery(sql, [value, ...primaryKeyValues]);
        console.log('Update result:', result);
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating table:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/insertRow', async (req, res) => {
    try {
        const { table, row } = req.body;
        console.log('Insert request:', { table, row });

        const columns = Object.keys(row).join(', ');
        const placeholders = Object.keys(row).map(() => '?').join(', ');
        const values = Object.values(row);

        const sql = `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`;
        console.log('SQL query:', sql);

        const result = await db.executeQuery(sql, values);
        console.log('Insert result:', result);
        res.json({ success: true });
    } catch (error) {
        console.error('Error inserting row:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/deleteRow', async (req, res) => {
    try {
        const { table, primaryKeys, rowData } = req.body;
        console.log('Delete request:', { table, primaryKeys, rowData });

        const whereClause = primaryKeys.map(key => `${key} = ?`).join(' AND ');
        const values = primaryKeys.map(key => rowData[key]);

        const sql = `DELETE FROM ${table} WHERE ${whereClause}`;
        console.log('SQL query:', sql);

        const result = await db.executeQuery(sql, values);
        console.log('Delete result:', result);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting row:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});














app.get('/filteredAttendance', async (req, res) => {
    try {
        const { startDate, endDate, empId, empName, status, page, rowsPerPage } = req.query;
                let whereConditions = [];
        let params = [];

        if (startDate && endDate) {
            whereConditions.push('shift_date BETWEEN ? AND ?');
            params.push(startDate, endDate);
        }
        if (empId) {
            whereConditions.push('emp_id = ?');
            params.push(empId);
        }
        if (empName) {
            whereConditions.push('FullName LIKE ?');
            params.push(`%${empName}%`);
        }
        if (status) {
            whereConditions.push('status = ?');
            params.push(status);
        }

        const whereClause = whereConditions.length > 0 
            ? 'WHERE ' + whereConditions.join(' AND ')
            : '';




        // Handle pagination
        let limitClause = '';
        let limitParams = [];

        if (rowsPerPage && rowsPerPage !== 'All') {
            const offset = (parseInt(page) - 1) * parseInt(rowsPerPage);
            limitClause = 'LIMIT ? OFFSET ?';
            limitParams.push(parseInt(rowsPerPage), offset);
        }

        // Query to get total number of rows matching the filters (for pagination)
        const countQuery = `
            SELECT COUNT(*) AS totalRows FROM general_attendance_report 
            ${whereClause}
        `;
        const countResult = await db.executeQuery(countQuery, params);
        const totalRows = countResult[0].totalRows;






        const query = `
        SELECT * FROM general_attendance_report 
        ${whereClause}
        ORDER BY shift_date
        ${limitClause}
    `;

    

    const data = await db.executeQuery(query, [...params, ...limitParams]);
    res.json({ success: true, data, totalRows });
} catch (error) {
    console.error('Error fetching filtered data:', error);
    res.status(500).json({ success: false, error: error.message });
}
});




app.post('/bulkUpdate', async (req, res) => {
    try {
        const { column, value, filters } = req.body;
        let whereConditions = [];
        let params = [value]; // First parameter is the new value

        if (filters.startDate && filters.endDate) {
            whereConditions.push('shift_date BETWEEN ? AND ?');
            params.push(filters.startDate, filters.endDate);
        }
        if (filters.empId) {
            whereConditions.push('emp_id = ?');
            params.push(filters.empId);
        }
        if (filters.empName) {
            whereConditions.push('FullName LIKE ?');
            params.push(`%${filters.empName}%`);
        }
        if (filters.status) {
            whereConditions.push('status = ?');
            params.push(filters.status);
        }

        const whereClause = whereConditions.length > 0 
            ? 'WHERE ' + whereConditions.join(' AND ')
            : '';

        const query = `
            UPDATE general_attendance_report 
            SET ${column} = ?
            ${whereClause}`;

        const result = await db.executeQuery(query, params);
        res.json({ success: true, rowsAffected: result.affectedRows });
    } catch (error) {
        console.error('Error performing bulk update:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});









app.get('/isClockedin/:id', async (req, res) => {
    console.log("this is the api working");
    const id = req.params.id
    const report = await db.IsclockedIn(id);
    console.log(report);
    res.json(report);

})

app.get('/api/departments', async (req, res) => {
    try {
        const departments = await db.getDepartments();
        res.json(departments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



app.get('/api/data', async (req, res) => {
    try {
      const query = 'SELECT * FROM your_table_name';
      const [rows] = await db.execute(query);
      res.json(rows);
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });
  












  const nationalityMap = {
    1: 'India',
    2: 'Turkey',
    3: 'United Arab Emirates',
    4: 'Nepal',
    5: 'Egypt',
    6: 'Bangladesh',
    7: 'Pakistan',
    8: 'Canada',
    9: 'Jordan',
    10: 'Oman',
    11: 'United Kingdom'
};

const departmentMap = {
    1: 'Engineering',
    2: 'Finance',
    3: 'HR & Admin',
    4: 'Information Technology',
    5: 'Management',
    6: 'Operations',
    7: 'QHSSE',
    8: 'Sales & Marketing',
    9: 'Supply Chain'
};

const siteMap = {
    1: 'ICAD 2',
    2: 'ICAD 1',
    3: 'M46'
};
// Function to calculate overall attendance
function calculateAttendance(data) {
    let present = 0;
    let absent = 0;
    let Ms = 0;

    data.forEach(record => {
        const { clock_in, clock_out } = record;

        if (clock_in && clock_out) {
            present += 1;
        } else if (clock_in || clock_out) {
            Ms += 1;
        }
    });

    // Assuming total number of employees is 456
    absent = 456 - present - Ms;

    return { present, absent, Ms };
}

/*
// Endpoint to fetch overall attendance
app.get('/api/attendance', (req, res) => {
    const { date } = req.query;

    if (!date) {
        return res.status(400).json({ error: 'Please provide a date parameter' });
    }

    const query = `
        SELECT empid, date, clock_in, clock_out
        FROM input_data
        WHERE date = ?
    `;

    db.executeQuery(query, [date], (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).json({ error: err.message });
        }

        const attendance = calculateAttendance(results);
        res.json(attendance);
    });
});
*/




app.get('/api/attendance', async (req, res) => {
    const { date } = req.query;
  
    if (!date) {
      return res.status(400).json({ error: 'Please provide a date parameter' });
    }
  
    const query = `
      SELECT empid, date, clock_in, clock_out
      FROM input_data
      WHERE date = ?
    `;
  
    try {
      const results = await db.executeQuery(query, [date]);
      const attendance = calculateAttendance(results);
      res.json(attendance);
    } catch (err) {
      console.error('Error executing query:', err);
      res.status(500).json({ error: err.message });
    }
  });
  



/*
// Endpoint to fetch attendance distribution
app.get('/api/attendance-distribution', (req, res) => {
    const { date, type } = req.query;

    if (!date || !type) {
        return res.status(400).json({ error: 'Please provide date and type parameters' });
    }

    let groupField = '';
    let nameMap = {};

    if (type === 'nationality') {
        groupField = 'e.NationalityID';
        nameMap = nationalityMap;
    } else if (type === 'department') {
        groupField = 'e.DepId';
        nameMap = departmentMap;
    } else if (type === 'location') {
        groupField = 'e.SiteId';
        nameMap = siteMap;
    } else {
        res.status(400).json({ error: 'Invalid type parameter' });
        return;
    }

    const query = `
        SELECT ${groupField} AS groupId, COUNT(DISTINCT e.EmpID) AS employeeCount
        FROM employee_master e
        JOIN input_data i ON e.EmpID = i.empid
        WHERE i.date = ?
        GROUP BY ${groupField}
    `;

    db.executeQuery(query, [date], (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).json({ error: err.message });
        }

        const data = results.map(record => ({
            id: record.groupId,
            label: nameMap[record.groupId] || `Unknown (${record.groupId})`,
            count: record.employeeCount
        }));

        res.json(data);
    });
});
*/


app.get('/api/attendance-distribution', (req, res) => {
    const { date, type } = req.query;

    if (!date || !type) {
        return res.status(400).json({ error: 'Please provide date and type parameters' });
    }

    let groupField = '';
    let nameMap = {};

    if (type === 'nationality') {
        groupField = 'e.NationalityID';
        nameMap = nationalityMap;
    } else if (type === 'department') {
        groupField = 'e.DepId';
        nameMap = departmentMap;
    } else if (type === 'location') {
        groupField = 'e.SiteId';
        nameMap = siteMap;
    } else {
        return res.status(400).json({ error: 'Invalid type parameter' });
    }

    const query = `
        SELECT ${groupField} AS groupId, COUNT(DISTINCT e.EmpID) AS employeeCount
        FROM employee_master e
        JOIN input_data i ON e.EmpID = i.empid
        WHERE i.date = ?
        GROUP BY ${groupField}
    `;

    db.executeQuery(query, [date])
        .then(results => {
            const data = results.map(record => ({
                id: record.groupId,
                label: nameMap[record.groupId] || `Unknown (${record.groupId})`,
                count: record.employeeCount
            }));
            res.json(data);
        })
        .catch(err => {
            console.error('Error executing query:', err);
            res.status(500).json({ error: err.message });
        });
});


/*
/// Endpoint to fetch visa distribution
app.get('/api/visa-distribution', (req, res) => {
    const { date } = req.query;

    if (!date) {
        return res.status(400).json({ error: 'Please provide a date parameter' });
    }

    const query = `
        SELECT v.visaType, COUNT(*) AS count
        FROM employee_master e
        JOIN visa v ON e.VisaId = v.visaId
        JOIN input_data i ON e.EmpID = i.empid
        WHERE i.date = ? AND i.clock_in IS NOT NULL AND i.clock_out IS NOT NULL
        GROUP BY v.visaType
    `;

    db.executeQuery(query, [date], (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).json({ error: err.message });
        }

        res.json(results);
    });
});
// Endpoint to fetch employee attendance details
app.get('/api/employee-attendance', (req, res) => {
    const { date } = req.query;

    if (!date) {
        return res.status(400).json({ error: 'Please provide a date parameter' });
    }

    const query = `
        SELECT e.EmpID, e.FullName, e.EmailID, v.visaType,
               CASE 
                   WHEN i.clock_in IS NOT NULL AND i.clock_out IS NOT NULL THEN 'Present'
                   WHEN i.clock_in IS NULL AND i.clock_out IS NULL THEN 'Absent'
                   ELSE 'Ms'
               END AS attendanceStatus
        FROM employee_master e
        JOIN visa v ON e.VisaId = v.visaId
        LEFT JOIN input_data i ON e.EmpID = i.empid AND i.date = ?
    `;

    db.executeQuery(query, [date], (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).json({ error: err.message });
        }

        res.json(results);
    });
});
*/






app.get('/api/visa-distribution', (req, res) => {
    const { date } = req.query;

    if (!date) {
        return res.status(400).json({ error: 'Please provide a date parameter' });
    }

    const query = `
        SELECT v.visaType, COUNT(*) AS count
        FROM employee_master e
        JOIN visa v ON e.VisaId = v.visaId
        JOIN input_data i ON e.EmpID = i.empid
        WHERE i.date = ? AND i.clock_in IS NOT NULL AND i.clock_out IS NOT NULL
        GROUP BY v.visaType
    `;

    db.executeQuery(query, [date])
        .then(results => {
            res.json(results);
        })
        .catch(err => {
            console.error('Error executing query:', err);
            res.status(500).json({ error: err.message });
        });
});





app.get('/api/employee-attendance', (req, res) => {
    const { date } = req.query;

    if (!date) {
        return res.status(400).json({ error: 'Please provide a date parameter' });
    }

    const query = `
        SELECT e.EmpID, e.FullName, e.EmailID, v.visaType,
               CASE 
                   WHEN i.clock_in IS NOT NULL AND i.clock_out IS NOT NULL THEN 'Present'
                   WHEN i.clock_in IS NULL AND i.clock_out IS NULL THEN 'Absent'
                   ELSE 'Ms'
               END AS attendanceStatus
        FROM employee_master e
        JOIN visa v ON e.VisaId = v.visaId
        LEFT JOIN input_data i ON e.EmpID = i.empid AND i.date = ?
    `;

    db.executeQuery(query, [date])
        .then(results => {
            res.json(results);
        })
        .catch(err => {
            console.error('Error executing query:', err);
            res.status(500).json({ error: err.message });
        });
});







// muster report 
function fillMusterRollTable(res, limit = 500) {
      const query = 'SELECT e.EmpID, e.FullName, CAST(i.date AS DATE) as date, i.clock_in, i.clock_out FROM employee_master e JOIN input_data i ON e.EmpID = i.empid LIMIT ?';
      db.query(query, [limit])
        .then(results => {
          console.log('Data retrieved:', results.length);
          const musterRoll = results.map(row => [
            row.EmpID,
            row.FullName,
            row.date,
            row.clock_in,
            row.clock_out
          ]);
    
          const checkQuery = 'SELECT * FROM muster_roll WHERE emp_id = ? AND shift_date = ?';
          const promises = musterRoll.map(record => {
            return db.query(checkQuery, [record[0], record[2]])
              .then(result => {
                if (result.length === 0) {
                  const insertQuery = 'INSERT INTO muster_roll (emp_id, emp_name, shift_date, clock_in, clock_out) VALUES (?, ?, ?, ?, ?)';
                  return db.query(insertQuery, record);
                } else {
                  return Promise.resolve();
                }
              });
          });
    
          Promise.all(promises)
            .then(() => {
              console.log('Muster roll table updated successfully.');
              res.send('Muster roll table updated successfully.');
            })
            .catch(error => {
              console.error('Insert query error:', error);
              res.status(500).send('Insert query error');
            });
        })
        .catch(error => {
          console.error('Query error:', error);
          res.status(500).send('Query error');
        });
    }
    app.get('/fill-muster-roll-table', (req, res) => {
      const limit = req.query.limit || 500;
      fillMusterRollTable(res, limit);
    });
    
    app.get('/fetch-muster-roll', async (req, res) => {
      try {
        const limit = req.query.limit || 500;
        const query = 'SELECT emp_id, emp_name, DATE_FORMAT(shift_date, "%Y-%m-%d") as shift_date, clock_in, clock_out FROM muster_roll LIMIT ?';
        const results = await db.query(query, [limit]);
        res.json(results);
      } catch (err) {
        console.error('Query error:', err);
        res.status(500).send('Internal Server Error');
      }
    });







app.get('/muster_roll', (req, res) => {
        res.sendFile(path.join(__dirname,'..','Client','muster_roll.html'));
    });

app.get('/Clocking', (req, res) => {
    res.sendFile(path.join(__dirname,'..','Client','Clocking.html'));
});

app.get('/gar', (req, res) => {
    res.sendFile(path.join(__dirname,'..','Client','GAR2.html'));
});

app.get('/Dashboard', (req, res) => {
    res.sendFile(path.join(__dirname,'..','Client','Dashboard.html'));
});

app.get('/Admin_CRUD.html', (req, res) => {
    res.sendFile(path.join(__dirname,'..','Client','Admin_CRUD.html'));
});


app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
})

