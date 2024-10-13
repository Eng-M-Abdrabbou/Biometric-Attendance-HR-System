
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




const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

// Error handling middleware
// app.use((err, req, res, next) => {
//     logger.error('Unhandled error:', { 
//         error: err.message, 
//         stack: err.stack,
//         path: req.path,
//         method: req.method
//     });
//     res.status(500).json({ 
//         error: 'Internal server error',
//         details: err.message 
//     });
// });


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
  await mainDataSync(db, excelFilePath);
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

// Attendance report endpoint
// app.get('/api/attendance-report', async (req, res) => {
//     logger.info('Received attendance report request', { query: req.query });
//     try {
//         const filters = {
//             dateFrom: req.query.dateFrom,
//             dateTo: req.query.dateTo,
//             empId: req.query.empId,
//             empName: req.query.empName,
//             department: req.query.department,
//             site: req.query.site,
//             nationality: req.query.nationality
//         };

//         // Validate date range if provided
//         if (filters.dateFrom && filters.dateTo) {
//             if (new Date(filters.dateFrom) > new Date(filters.dateTo)) {
//                 throw new Error('Invalid date range: Start date cannot be after end date');
//             }
//         }

//         logger.debug('Processing report with filters', { filters });
//         const report = await db.generateAttendanceReport(filters);
//         logger.info('Successfully generated report', { 
//             recordCount: Object.keys(report).length 
//         });
//         res.json(report);
//     } catch (error) {
//         logger.error('Error generating attendance report', { 
//             error: error.message, 
//             stack: error.stack 
//         });
//         res.status(500).json({ 
//             error: 'Failed to generate attendance report',
//             details: error.message 
//         });
//     }
// });







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
            nationality: req.query.nationality
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
    return await db.query1(query, [table]);
}



app.get('/tableInfo/:table', async (req, res) => {
    try {
        const TABLE = req.params.table;
        // Validate table name to prevent SQL injection
        const validTables = ['accommodation', 'asst_master', 'clocking', 'company', 'departments', 'employee_master', 'emp_dep', 'emp_visa', 'general_attendance_report', 'grade', 'holidays', 'input_data', 'jobtitle', 'records', 'section', 'shift', 'sites', 'test_user', 'visa', 'weekend'];
        if (!validTables.includes(TABLE)) {
            return res.status(400).json({ error: 'Invalid table name' });
        }
        
        console.log(`Attempting to fetch data from table: ${TABLE}`);
        const primaryKeys = await getPrimaryKeys(TABLE);
        const data = await db.query1(`SELECT * FROM ${TABLE}`);
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

        const result = await db.query1(sql, [value, ...primaryKeyValues]);
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

        const result = await db.query1(sql, values);
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

        const result = await db.query1(sql, values);
        console.log('Delete result:', result);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting row:', error);
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

