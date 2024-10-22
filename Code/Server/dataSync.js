// dataSync.js

const XLSX = require('xlsx');
const moment = require('moment');
const dbService = require('./dbService'); // Correctly import dbService
const db = dbService.getDbServiceInstance();

const MAX_CHUNK_SIZE = 1000; 

// // Function to process Excel data
// function processExcelData(filePath) {
//     const workbook = XLSX.readFile(filePath);
//     const sheet = workbook.Sheets[workbook.SheetNames[0]];
//     const data = XLSX.utils.sheet_to_json(sheet);

//     // Log total rows and a sample row for verification
//     console.log(`Total Rows in Excel: ${data.length}`);
//     console.log('Sample Row:', data[0]);

//     return data
//         .filter(row => row.L_UID && row.C_Name && row.C_Date && row.C_Time && row.L_Mode !== undefined)
//         .map(row => ({
//             empId: row.L_UID,
//             empName: row.C_Name,
//             date: moment(`${row.C_Date} ${row.C_Time}`, 'YYYYMMDD HHmmss').format('YYYY-MM-DD HH:mm:ss'),
//             isClockIn: row.L_Mode === 1,
//             isClockOut: row.L_Mode === 2
//         }));
// }

// // Function to update employee_master table
// async function updateEmployeeMaster(employees) {
//     const existingEmployees = await db.query('SELECT EmpID FROM employee_master');
//     const existingIds = new Set(existingEmployees.map(emp => emp.EmpID));
//     const newEmployees = employees.filter(emp => !existingIds.has(emp.empId));

//     if (newEmployees.length === 0) {
//         console.log('No new employees to insert');
//         return;
//     }

//     const values = newEmployees.map(emp => {
//         const [firstName, ...lastNameParts] = emp.empName.split(' ');
//         const lastName = lastNameParts.join(' ');
//         return [emp.empId, firstName, lastName, 1, 1, 'ad', 1, 1, 'Email@ftc.com', 1, 1, 1, 1, 1, 1];
//     });

//     const sql = `INSERT INTO employee_master 
//                 (EmpID, EmpFName, EmpLName, IsLive, EmployeeGradeID, CAddress1, NationalityID, Gender, EmailID, IsAutoPunch, assetId, ShiftId, jobTitle, accomodationId, depId) 
//                 VALUES ?`;

//     for (let i = 0; i < values.length; i += MAX_CHUNK_SIZE) {
//         const chunk = values.slice(i, i + MAX_CHUNK_SIZE);
//         await db.query(sql, [chunk]);
//         console.log(`Inserted ${chunk.length} new employees (${i + chunk.length}/${values.length})`);
//     }
// }

// // Function to update input_data table
// async function updateInputData(processedData) {
//     const groupedData = groupDataByEmployeeAndDate(processedData);
//     const records = Array.from(groupedData.values());

//     // Log a sample record for verification
//     console.log('Sample Input Data Record:', records[0]);

//     const sql = `INSERT INTO input_data (empid, date, clock_in, clock_out) 
//                 VALUES ? 
//                 ON DUPLICATE KEY UPDATE 
//                 clock_in = VALUES(clock_in),
//                 clock_out = VALUES(clock_out)`;

//     for (let i = 0; i < records.length; i += MAX_CHUNK_SIZE) {
//         const chunk = records.slice(i, i + MAX_CHUNK_SIZE);
//         const values = chunk.map(r => [r.empId, r.date, r.clockIn, r.clockOut]);

//         try {
//             await db.query(sql, [values]);
//             console.log(`Upserted ${chunk.length} attendance records (${i + chunk.length}/${records.length})`);
//         } catch (error) {
//             console.error(`Error upserting chunk (${i}-${i + chunk.length}):`, error);
//             throw error;
//         }
//     }
// }

// // Function to group data by employee and date
// function groupDataByEmployeeAndDate(data) {
//     return data.reduce((acc, record) => {
//         const key = `${record.empId}_${record.date.split(' ')[0]}`;
//         if (!acc.has(key)) {
//             acc.set(key, { empId: record.empId, date: record.date.split(' ')[0], clockIn: null, clockOut: null });
//         }
//         const existing = acc.get(key);
//         if (record.isClockIn && (!existing.clockIn || record.date < existing.clockIn)) {
//             existing.clockIn = record.date;
//         }
//         if (record.isClockOut && (!existing.clockOut || record.date > existing.clockOut)) {
//             existing.clockOut = record.date;
//         }
//         return acc;
//     }, new Map());
// }

// // Function to insert or update general_attendance_report
// async function insertOrUpdateGAR(report) {
//     if (!Array.isArray(report)) {
//         console.error('Report is not an array:', report);
//         return;
//     }
//     try {
//         const insertOrUpdatePromises = report.map(async (record) => {
//             // Log the record to inspect emp_id and shift_date
//             console.log('Processing Record in insertOrUpdateGAR:', record);
            
//             const validRecord = {
//                 emp_id: record.emp_id,
//                 emp_fname: record.emp_fname,
//                 emp_lname: record.emp_lname,
//                 shift_date: record.shift_date,
//                 first_in: record.first_in,
//                 last_out: record.last_out,
//                 status: record.status,
//                 leave_id: record.leave_id,
//                 awh: record.awh,
//                 ot: record.ot
//             };

//             // Check if emp_id and shift_date are present
//             if (!validRecord.emp_id || !validRecord.shift_date) {
//                 console.warn('Missing emp_id or shift_date:', validRecord);
//                 return;
//             }

//             // Check if a record already exists
//             const existingRecord = await db.query(
//                 'SELECT * FROM general_attendance_report WHERE emp_id = ? AND shift_date = ?',
//                 [validRecord.emp_id, validRecord.shift_date]
//             );

//             if (existingRecord.length > 0) {
//                 // Record exists, check if it needs updating
//                 const currentRecord = existingRecord[0];
//                 const needsUpdate = Object.keys(validRecord).some(key => 
//                     key !== 'emp_id' && key !== 'shift_date' && currentRecord[key] !== validRecord[key]
//                 );

//                 if (needsUpdate) {
//                     // Update the existing record
//                     await db.query(
//                         'UPDATE general_attendance_report SET ? WHERE emp_id = ? AND shift_date = ?',
//                         [validRecord, validRecord.emp_id, validRecord.shift_date]
//                     );
//                     console.log(`Updated record for employee ${validRecord.emp_id} on ${validRecord.shift_date}`);
//                 } else {
//                     console.log(`Duplicate record found for employee ${validRecord.emp_id} on ${validRecord.shift_date}, no changes needed`);
//                 }
//             } else {
//                 // Insert new record
//                 await db.query('INSERT INTO general_attendance_report SET ?', validRecord);
//                 console.log(`Inserted new record for employee ${validRecord.emp_id} on ${validRecord.shift_date}`);
//             }
//         });

//         await Promise.all(insertOrUpdatePromises);
//         console.log(`Processed ${report.length} records in GAR table.`);
//     } catch (error) {
//         console.error('Error processing data for general_attendance_report table:', error);
//         throw error;
//     }
// }

// // Main data synchronization function
// async function mainDataSync(excelFilePath, maxRetries = 3) {
//     try {
//         console.time('Data Sync');
//         const processedData = processExcelData(excelFilePath);
        
//         if (processedData.length === 0) {
//             console.warn('No valid data found in the Excel file');
//             return;
//         }
        
//         const uniqueEmployeesMap = new Map();
//         processedData.forEach(record => {
//             uniqueEmployeesMap.set(record.empId, record.empName);
//         });
//         const uniqueEmployees = Array.from(uniqueEmployeesMap, ([empId, empName]) => ({ empId, empName }));
        
//         console.log(`Processing ${uniqueEmployees.length} unique employees`);
        
//         await retryOperation(() => updateEmployeeMaster(uniqueEmployees), maxRetries);
//         await retryOperation(() => updateInputData(processedData), maxRetries);
        
//         // Fetch employee details to include first and last names
//         const employeeIds = Array.from(uniqueEmployeesMap.keys());
//         const employees = await db.query(
//             'SELECT EmpID, EmpFName, EmpLName FROM employee_master WHERE EmpID IN (?)',
//             [employeeIds]
//         );
//         const empMap = new Map(employees.map(emp => [emp.EmpID, { EmpFName: emp.EmpFName, EmpLName: emp.EmpLName }]));
        
//         // Prepare records for GAR
//         const groupedData = groupDataByEmployeeAndDate(processedData);
//         const garRecords = Array.from(groupedData.values()).map(record => {
//             const empDetails = empMap.get(record.empId);
//             return {
//                 emp_id: record.empId,
//                 emp_fname: empDetails ? empDetails.EmpFName : 'N/A',
//                 emp_lname: empDetails ? empDetails.EmpLName : 'N/A',
//                 shift_date: record.date,
//                 first_in: record.clockIn || null,
//                 last_out: record.clockOut || null,
//                 status: (record.clockIn && record.clockOut) ? 'Present' : 'Absent',
//                 leave_id: null, // Assign based on your business logic
//                 awh: 0,          // Assign based on your business logic
//                 ot: 0            // Assign based on your business logic
//             };
//         });

//         // Log the prepared GAR records
//         console.log('Data being passed to insertOrUpdateGAR:', garRecords);

//         // Pass the prepared records to insertOrUpdateGAR
//         await retryOperation(() => insertOrUpdateGAR(garRecords), maxRetries);
        
//         console.log('Data synchronization completed successfully');
//         console.timeEnd('Data Sync');
//     } catch (error) {
//         console.error('Error during data synchronization:', error);
//     } finally {
//         // Optionally close database connections if needed
//     }
// }

// // Retry operation helper function
// async function retryOperation(operation, maxRetries) {
//     let lastError;
//     for (let attempt = 1; attempt <= maxRetries; attempt++) {
//         try {
//             return await operation();
//         } catch (error) {
//             console.warn(`Attempt ${attempt} failed:`, error.message);
//             lastError = error;
//             if (attempt < maxRetries) {
//                 const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
//                 await new Promise(resolve => setTimeout(resolve, delay));
//             }
//         }
//     }
//     throw lastError;
// }


// dataSync.js
// dataSync.js




async function fetchEmployeeDetails(employeeIds) {
    const CHUNK_SIZE = 500;
    let results = [];

    for (let i = 0; i < employeeIds.length; i += CHUNK_SIZE) {
        const chunk = employeeIds.slice(i, i + CHUNK_SIZE).join(',');
        const sql = `SELECT EmpID, EmpFName, EmpLName FROM employee_master WHERE EmpID IN (${chunk})`;
        const chunkResults = await db.executeQuery(sql);

        results = results.concat(chunkResults);
    }

    return results;
}










/**
 * Process Excel Data
 * @param {string} filePath - Path to the Excel file
 * @returns {Array} - Processed data
 */
function processExcelData(filePath) {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    // Log total rows and a sample row for verification
    console.log(`Total Rows in Excel: ${data.length}`);
    console.log('Sample Row:', data[0]);

    // Process and filter data
    return data
        .filter(row => row.L_UID && row.C_Name && row.C_Date && row.C_Time && row.L_Mode !== undefined)
        .map(row => ({
            empId: row.L_UID,
            empName: row.C_Name,
            date: moment(`${row.C_Date} ${row.C_Time}`, 'YYYYMMDD HHmmss').format('YYYY-MM-DD HH:mm:ss'),
            isClockIn: row.L_Mode === 1,
            isClockOut: row.L_Mode === 2
        }))
        .filter(record => record !== null); // Ensure no null records
}

/**
 * Update employee_master table with new employees
 * @param {Array} employees - Array of employee objects
 * @returns {Promise}
 */
// async function updateEmployeeMaster(employees) {
//     const sql = "SELECT EmpID FROM employee_master";
//     const existingEmployees = await db.executeQuery(sql, []);
//     const existingIds = new Set(existingEmployees.map(emp => emp.EmpID));
//     const newEmployees = employees.filter(emp => !existingIds.has(emp.empId));

//     if (newEmployees.length === 0) {
//         console.log('No new employees to insert');
//         return;
//     }

//     // const values = newEmployees.map(emp => {
//     //     const [firstName, ...lastNameParts] = emp.empName.split(' ');
//     //     const lastName = lastNameParts.join(' ');
//     //     // Adjust the fields as per your employee_master table schema
//     //     return [emp.empId, firstName, lastName, 1, 1, 'ad', 1, 1, 'Email@ftc.com', 1, 1, 1, 1, 1, 1];
//     // });

//     // const insertSql = `INSERT INTO employee_master 
//     //     (EmpID, EmpFName, EmpLName, IsLive, EmployeeGradeID, CAddress1, NationalityID, Gender, EmailID, IsAutoPunch, assetId, ShiftId, jobTitle, accomodationId, depId) 
//     //     VALUES (?)`;

//     const values = newEmployees.map(emp => {
//         const [firstName, ...lastNameParts] = emp.empName.split(' ');
//         const lastName = lastNameParts.join(' ');
//         return [emp.empId, firstName, lastName, 1, 1, 'ad', 1, 1, 'Email@ftc.com', 1, 1, 1, 1, 1, 1];
//     });
    
//     const sql1 = "INSERT INTO employee_master (EmpID, EmpFName, EmpLName, IsLive, EmployeeGradeID, CAddress1, NationalityID, Gender, EmailID, IsAutoPunch, assetId, ShiftId, jobTitle, accommodationId, depId) VALUES ?";
    
//     db.executeQuery(sql1, [values], function(err) {
//         if (err) throw err;
//         console.log("Records inserted!");
//     });
    


//     // Perform bulk insert
//     try {
//         await db.executeQuery(sql1, [values]);
//         console.log(`Inserted ${newEmployees.length} new employees.`);
//     } catch (error) {
//         console.error('Error inserting new employees:', error);
//         throw error;
//     }
// }

async function updateEmployeeMaster(employees) {
    const sql = "SELECT EmpID FROM employee_master";
    const existingEmployees = await db.executeQuery(sql, []);
    const existingIds = new Set(existingEmployees.map(emp => emp.EmpID));
    const newEmployees = employees.filter(emp => !existingIds.has(emp.empId));
    
    if (newEmployees.length === 0) {
        console.log('No new employees to insert');
        return;
    }

    const values = newEmployees.map(emp => {
        const [firstName, ...lastNameParts] = emp.empName.split(' ');
        const lastName = lastNameParts.join(' ');
        return [emp.empId, firstName, lastName, 1, 1, 'ad', 1, 1, 'Email@ftc.com', 1, 1, 1, 1, 1, 1];
    });

    const placeholders = values.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
    const insertSql = `INSERT INTO employee_master (EmpID, EmpFName, EmpLName, IsLive, EmployeeGradeID, CAddress1, NationalityID, Gender, EmailID, IsAutoPunch, assetId, ShiftId, jobTitle, accomodationId, depId) VALUES ${placeholders}`;
    const flattenedValues = [].concat(...values);

    try {
        await db.executeQuery(insertSql, flattenedValues);
        console.log(`Inserted ${newEmployees.length} new employees.`);
    } catch (error) {
        console.error('Error inserting new employees:', error);
        throw error;
    }
}




/**
 * Group data by employee and date to prepare for input_data table
 * @param {Array} data - Array of processed attendance records
 * @returns {Map} - Grouped data
 */
function groupDataByEmployeeAndDate(data) {
    return data.reduce((acc, record) => {
        const dateOnly = record.date.split(' ')[0];
        const key = `${record.empId}_${dateOnly}`;
        if (!acc.has(key)) {
            acc.set(key, { empId: record.empId, date: dateOnly, clockIn: null, clockOut: null });
        }
        const existing = acc.get(key);
        if (record.isClockIn && (!existing.clockIn || record.date < existing.clockIn)) {
            existing.clockIn = record.date;
        }
        if (record.isClockOut && (!existing.clockOut || record.date > existing.clockOut)) {
            existing.clockOut = record.date;
        }
        return acc;
    }, new Map());
}

/**
 * Update input_data table with attendance records
 * @param {Array} processedData - Array of processed attendance records
 * @returns {Promise}
 */


async function updateInputData(processedData) {
    const groupedData = groupDataByEmployeeAndDate(processedData);
    const records = Array.from(groupedData.values());
    console.log('Sample Input Data Record:', records[0]);

    // Function to process chunks
    async function processChunk(chunk) {
        const values = chunk.map(r => [r.empId, r.date, r.clockIn, r.clockOut]);
        const placeholders = values.map(() => '(?, ?, ?, ?)').join(', ');
        const flatValues = values.flat();
        const sql = `INSERT INTO input_data (empid, date, clock_in, clock_out) VALUES ${placeholders} ON DUPLICATE KEY UPDATE clock_in = VALUES(clock_in), clock_out = VALUES(clock_out)`;

        try {
            await db.executeQuery(sql, flatValues);
            console.log(`Upserted ${chunk.length} attendance records.`);
        } catch (error) {
            console.error(`Error upserting attendance records:`, error);
            throw error;
        }
    }

    // Split data into chunks and process each chunk
    for (let i = 0; i < records.length; i += MAX_CHUNK_SIZE) {
        const chunk = records.slice(i, i + MAX_CHUNK_SIZE);
        await processChunk(chunk);
    }
}


/**
 * Main Data Synchronization Function
 * @param {string} excelFilePath - Path to the Excel file
 */
async function mainDataSync(excelFilePath) {
    try {
        console.time('Data Sync'); // Start timer
        const processedData = processExcelData(excelFilePath);

        if (processedData.length === 0) {
            console.warn('No valid data found in the Excel file');
            return;
        }

        // Extract unique employees
        const uniqueEmployeesMap = new Map();
        processedData.forEach(record => {
            uniqueEmployeesMap.set(record.empId, record.empName);
        });
        const uniqueEmployees = Array.from(uniqueEmployeesMap, ([empId, empName]) => ({ empId, empName }));

        console.log(`Processing ${uniqueEmployees.length} unique employees`);

        // Update employee_master table
        await updateEmployeeMaster(uniqueEmployees);

        // Update input_data table
        await updateInputData(processedData);

        // Fetch employee details to include first and last names for GAR
        const employeeIds = Array.from(uniqueEmployeesMap.keys());
        // const garEmployees = await db.executeQuery(
        //     'SELECT EmpID, EmpFName, EmpLName FROM employee_master WHERE EmpID IN (?)',
        //     [employeeIds]
        // );





// Usage in mainDataSync:
const garEmployees = await fetchEmployeeDetails(employeeIds);





        const empMap = new Map(garEmployees.map(emp => [emp.EmpID, { EmpFName: emp.EmpFName, EmpLName: emp.EmpLName }]));

        // Prepare records for general_attendance_report table
        const groupedData = groupDataByEmployeeAndDate(processedData);
        const garRecords = Array.from(groupedData.values()).map(record => {
            const empDetails = empMap.get(record.empId);
            return {
                emp_id: record.empId,
                emp_fname: empDetails ? empDetails.EmpFName : 'N/A',
                emp_lname: empDetails ? empDetails.EmpLName : 'N/A',
                shift_date: record.date,
                first_in: record.clockIn || null,
                last_out: record.clockOut || null,
                status: (record.clockIn && record.clockOut) ? 'Present' : 'Absent',
                leave_id: null, // Assign based on your business logic
                awh: 0,          // Assign based on your business logic
                ot: 0            // Assign based on your business logic
            };
        });

        // Log the number of GAR records being inserted/updated
        console.log('Data being passed to insertOrUpdateGAR:', garRecords.length, 'records');

        // Update general_attendance_report table
        await db.insertOrUpdateGAR(garRecords);

        console.log('Data synchronization completed successfully');
        console.timeEnd('Data Sync'); // End timer
    } catch (error) {
        console.error('Error during data synchronization:', error);
    }
}

module.exports = {
    mainDataSync
};
