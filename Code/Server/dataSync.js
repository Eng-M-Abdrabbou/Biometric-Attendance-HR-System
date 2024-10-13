// dataSync.js

const XLSX = require('xlsx');
const moment = require('moment');
const dbService = require('./dbService'); // Correctly import dbService

const MAX_CHUNK_SIZE = 1000; 

function processExcelData(filePath) {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    return data.filter(row => row.L_UID && row.C_Name).map(row => ({
        empId: row.L_UID,
        empName: row.C_Name,
        date: moment(`${row.C_Date} ${row.C_Time}`, 'YYYYMMDD HHmmss').format('YYYY-MM-DD HH:mm:ss'),
        isClockIn: row.L_Mode === 1,
        isClockOut: row.L_Mode === 2
    }));
}

async function updateEmployeeMaster(employees) {
    const existingEmployees = await dbService.query('SELECT EmpID FROM employee_master');
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

    const sql = `INSERT INTO employee_master 
                (EmpID, EmpFName, EmpLName, IsLive, EmployeeGradeID, CAddress1, NationalityID, Gender, EmailID, IsAutoPunch, assetId, ShiftId, jobTitle, accomodationId, depId) 
                VALUES ?`;

    for (let i = 0; i < values.length; i += MAX_CHUNK_SIZE) {
        const chunk = values.slice(i, i + MAX_CHUNK_SIZE);
        await dbService.query(sql, [chunk]);
        console.log(`Inserted ${chunk.length} new employees (${i + chunk.length}/${values.length})`);
    }
}

async function updateInputData(processedData) {
    const groupedData = groupDataByEmployeeAndDate(processedData);
    const records = Array.from(groupedData.values());

    const sql = `INSERT INTO input_data (empid, date, clock_in, clock_out) 
                VALUES ? 
                ON DUPLICATE KEY UPDATE 
                clock_in = VALUES(clock_in),
                clock_out = VALUES(clock_out)`;

    for (let i = 0; i < records.length; i += MAX_CHUNK_SIZE) {
        const chunk = records.slice(i, i + MAX_CHUNK_SIZE);
        const values = chunk.map(r => [r.empId, r.date, r.clockIn, r.clockOut]);

        try {
            await dbService.query(sql, [values]);
            console.log(`Upserted ${chunk.length} attendance records (${i + chunk.length}/${records.length})`);
        } catch (error) {
            console.error(`Error upserting chunk (${i}-${i + chunk.length}):`, error);
            throw error;
        }
    }
}

function groupDataByEmployeeAndDate(data) {
    return data.reduce((acc, record) => {
        const key = `${record.empId}_${record.date.split(' ')[0]}`;
        if (!acc.has(key)) {
            acc.set(key, { empId: record.empId, date: record.date.split(' ')[0], clockIn: null, clockOut: null });
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

async function mainDataSync(excelFilePath, maxRetries = 3) {
    try {
        console.time('Data Sync');
        const processedData = processExcelData(excelFilePath);
        
        if (processedData.length === 0) {
            console.warn('No valid data found in the Excel file');
            return;
        }
        
        const uniqueEmployeesMap = new Map();
        processedData.forEach(record => {
            uniqueEmployeesMap.set(record.empId, record.empName);
        });
        const uniqueEmployees = Array.from(uniqueEmployeesMap, ([empId, empName]) => ({ empId, empName }));
        
        console.log(`Processing ${uniqueEmployees.length} unique employees`);
        
        await retryOperation(() => updateEmployeeMaster(uniqueEmployees), maxRetries);
        await retryOperation(() => updateInputData(processedData), maxRetries);
        
        // After updating employee_master and input_data, insert or update GAR
        await retryOperation(() => dbService.insertOrUpdateGAR(processedData), maxRetries);
        
        console.log('Data synchronization completed successfully');
        console.timeEnd('Data Sync');
    } catch (error) {
        console.error('Error during data synchronization:', error);
    } finally {
        // Optionally close database connections if needed
    }
}

async function retryOperation(operation, maxRetries) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            console.warn(`Attempt ${attempt} failed:`, error.message);
            lastError = error;
            if (attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    throw lastError;
}

module.exports = {
    processExcelData,
    mainDataSync
};
