
const XLSX = require('xlsx');
const moment = require('moment');
const path = require('path');
const dbService = require('./dbService');
const db = dbService.getDbServiceInstance();

   // server: 'FTC-UNIS-TEST\SQLEXPRESS',

const sql = require('mssql');

const sqlServerConfig = {
    user: 'sa',
    password: 'ftc@123',
    server: 'FTC-UNIS-TEST\\SQLEXPRESS', 
    database: 'UNIS',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};



sql.connect(sqlServerConfig).then(pool => {
    if (pool.connecting) {
        console.log('Connecting to the SQL Server...');
    }
    if (pool.connected) {
        console.log('Connected to the SQL Server');
    }
    return pool;
}).catch(err => {
    console.error('SQL Server connection failed', err);
});




















const MAX_CHUNK_SIZE = 1000;

function parseDateOfJoining(dateStr) {
    if (!dateStr) return null;

    // Try different date formats
    const possibleFormats = [
        'DD-MM-YYYY',
        'MM-DD-YYYY',
        'YYYY-MM-DD',
        'DD/MM/YYYY',
        'MM/DD/YYYY',
        'YYYY/MM/DD',
        'D-M-YYYY',
        'M-D-YYYY',
        'D/M/YYYY',
        'M/D/YYYY',
        'MM/DD/YY',
        'DD/MM/YY',
        'YY/MM/DD',
        'M/D/YY',
        'D/M/YY'
    ];

    // Convert Excel date number to date string if necessary
    let dateToParse = dateStr;
    if (typeof dateStr === 'number') {
        // Convert Excel date number to JavaScript date
        const excelDate = new Date((dateStr - 25569) * 86400 * 1000);
        dateToParse = moment(excelDate).format('YYYY-MM-DD');
    }

    for (const format of possibleFormats) {
        const parsed = moment(dateToParse, format, true);
        if (parsed.isValid()) {
            return parsed.format('YYYY-MM-DD');
        }
    }

    console.error(`Failed to parse date: ${dateStr}`);
    return null;
}

async function processEmployeeRecord(row) {
    try {
        // Get base values from row
        const sapId = parseInt(row['SAP ID']);
        const empId = parseInt(row['EMP ID']);
        const fullName = row['Full Name'];
        const empStatus = row['EMP Status'].toLowerCase() === 'active' ? 1 : 0;
        const department = row['Department'];
        const division = row['Division'];
        const site = row['Site'];
        const email = row['E-mail'];
        
        // Parse date of joining with new robust function
        const rawDate = row['Date of Joining'];
        const dateOfJoining = parseDateOfJoining(rawDate);
        if (!dateOfJoining) {
            throw new Error(`Invalid date format for Date of Joining: ${rawDate}`);
        }

        const visa = row['VISA'];
        const otEligibility = row['OT Eligiblity'] === 'Eligible' ? 1 : 0;
        const isAutoPunch = row['IsAutoPunch'].toLowerCase() === 'yes' ? 1 : 0;
        const address = row['Address'] || '';
        const nationality = row['Natinality'];
        const expLoc = row['EXP_LOC'].toLowerCase() === 'local' ? 1 : 0;
        const assetId = row['Asset ID'] || '';
        const gender = row['Gender'].toLowerCase() === 'male' ? 1 : 0;
        const empGrade = row['Emp Grade'].toLowerCase() === 'staff' ? 1 : 2;
        const jobTitle = row['Designation'];
        const accomodation = row['Accomedation'];

        // Map site names to IDs
        const siteMapping = {
            'ICAD 2': 1,
            'ICAD 1': 2,
            'Musaffah M46': 3,
            'M46': 3
        };
        const siteId = siteMapping[site] || 1;

        // Map departments to IDs
        const departmentMapping = {
            'Engineering': 1,
            'Finance': 2,
            'HR & Admin': 3,
            'Information Technology': 4,
            'Management': 5,
            'Operations': 6,
            'QHSSE': 7,
            'Sales & Marketing': 8,
            'Supply Chain': 9
        };
        const depId = departmentMapping[department] || 6;

        // Map divisions to IDs
        const divisionMapping = {
            'Federal Cable': 1,
            'Federal Transformers': 2,
            'Support Services': 3,
            'Federal Switchgear & Busway': 4,
            'Federal Power': 5
        };
        const divId = divisionMapping[division] || 1;

        // Map nationalities to IDs
        const nationalityMapping = {
            'India': 1,
            'Turkey': 2,
            'United Arab Emirates': 3,
            'Nepal': 4,
            'Egypt': 5,
            'Bangladesh': 6,
            'Pakistan': 7,
            'Canada': 8,
            'Jordan': 9,
            'Oman': 10,
            'United Kingdom': 11
        };
        const nationalityId = nationalityMapping[nationality] || 1;

        // Map visa types to IDs
        const visaMapping = {
            'FM-FTC LLC': 1,
            'F1-FPT LLC': 2,
            'FB-FTC Branch LLC': 3,
            'DU-Idle Pay Group': 4,
            'FD-Federal Dubai': 5
        };
        const visaId = visaMapping[visa] || 1;

        // Map shift times to IDs
        const shiftMapping = {
            '07:30-16:30': 1,
            '8:00-17:00': 2,
            '9:00-15:00': 3
        };
        const shiftId = shiftMapping[row['Shift Time']] || 1;

        return {
            SAPID: sapId,
            EmpID: empId,
            FullName: fullName,
            EmpStatus: empStatus,
            EmployeeGradeID: empGrade,
            Address: address,
            NationalityID: nationalityId,
            EXP_LOC: expLoc,
            Gender: gender,
            EmailID: email,
            IsAutoPunch: isAutoPunch,
            AssetId: assetId,
            ShiftId: shiftId,
            JobTitle: jobTitle,
            Accomodation: accomodation,
            DepId: depId,
            DivId: divId,
            SiteId: siteId,
            VisaId: visaId,
            OT: otEligibility,
            DateOfJoining: dateOfJoining
        };
    } catch (error) {
        console.error('Error processing employee record:', error);
        throw error;
    }
}

async function updateEmployeeMasterFromExcel() {
    try {
        console.log('Starting employee master update from Excel...');
        
        const filePath = path.resolve("C:/Users/Hp/OneDrive/Desktop/Emp1.xlsx");
        const workbook = XLSX.readFile(filePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        
        // Convert sheet to JSON
        const data = XLSX.utils.sheet_to_json(sheet);
        
        console.log(`Processing ${data.length} employees...`);
        let successCount = 0;
        let errorCount = 0;

        // Process in chunks for better memory management
        for (let i = 0; i < data.length; i += MAX_CHUNK_SIZE) {
            const chunk = data.slice(i, i + MAX_CHUNK_SIZE);
            
            for (const row of chunk) {
                try {
                    const employeeData = await processEmployeeRecord(row);
                    
                    // Check if employee exists
                    const existingEmps = await db.executeQuery(
                        "SELECT EmpID FROM employee_master WHERE EmpID = ?", 
                        [employeeData.EmpID]
                    );

                    if (existingEmps.length > 0) {
                        // Update existing employee
                        const updateFields = Object.entries(employeeData)
                            .map(([key]) => `${key} = ?`)
                            .join(', ');
                        
                        await db.executeQuery(
                            `UPDATE employee_master SET ${updateFields} WHERE EmpID = ?`,
                            [...Object.values(employeeData), employeeData.EmpID]
                        );
                        console.log(`Updated employee ${employeeData.EmpID}`);
                    } else {
                        // Insert new employee
                        const fields = Object.keys(employeeData).join(', ');
                        const placeholders = Array(Object.keys(employeeData).length).fill('?').join(', ');
                        
                        await db.executeQuery(
                            `INSERT INTO employee_master (${fields}) VALUES (${placeholders})`,
                            Object.values(employeeData)
                        );
                        console.log(`Inserted new employee ${employeeData.EmpID}`);
                    }
                    successCount++;
                } catch (error) {
                    errorCount++;
                    console.error(`Error processing row:`, error);
                    console.error('Problematic row:', row);
                }
            }
        }
        
        console.log(`Employee master update completed. Successful: ${successCount}, Failed: ${errorCount}`);
    } catch (error) {
        console.error('Error in updateEmployeeMasterFromExcel:', error);
        throw error;
    }
}

module.exports = {
    updateEmployeeMasterFromExcel
};









// Fetch data from SQL Server tEnter table
async function fetchDataFromSqlServer() {
    try {
        const pool = await sql.connect(sqlServerConfig);
        console.log('Connected to SQL Server');

        const result = await pool.request().query(`
            SELECT L_UID, C_Name, C_Date, C_Time, L_Mode
            FROM tEnter
            WHERE L_UID IS NOT NULL AND C_Name IS NOT NULL AND C_Date IS NOT NULL AND C_Time IS NOT NULL AND L_Mode IS NOT NULL
        `);

        console.log(`Total Rows Fetched: ${result.recordset.length}`);
        if (result.recordset.length > 0) console.log('Sample Row:', result.recordset[0]);

        return result.recordset
            .map(row => ({
                empId: row.L_UID,
                fullName: row.C_Name,
                date: moment(`${row.C_Date} ${row.C_Time}`, 'YYYYMMDD HHmmss').format('YYYY-MM-DD HH:mm:ss'),
                isClockIn: row.L_Mode === 1,
                isClockOut: row.L_Mode === 2
            }))
            .filter(record => record !== null);
    } catch (err) {
        console.error('Error fetching data from SQL Server:', err);
        throw err;
    } finally {
        await sql.close();
    }
}

// Group data by employee and date (same as before)
function groupDataByEmployeeAndDate(data) {
    return data.reduce((acc, record) => {
        const dateOnly = record.date.split(' ')[0];
        const key = `${record.empId}_${dateOnly}`;
        if (!acc.has(key)) {
            acc.set(key, { empId: record.empId, fullName: record.fullName, date: dateOnly, clockIn: null, clockOut: null });
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

// Function to update input_data in MySQL
async function updateInputData(processedData) {
    const groupedData = groupDataByEmployeeAndDate(processedData);
    const records = Array.from(groupedData.values());
    console.log('Sample Input Data Record:', records[0]);

    const MAX_CHUNK_SIZE = 1000; // Define a reasonable chunk size

    for (let i = 0; i < records.length; i += MAX_CHUNK_SIZE) {
        const chunk = records.slice(i, i + MAX_CHUNK_SIZE);
        const values = chunk.map(r => [r.empId, r.date, r.clockIn, r.clockOut]);
        const placeholders = values.map(() => '(?, ?, ?, ?)').join(', ');
        const flatValues = values.flat();
        const sqlQuery = `INSERT INTO input_data (empid, date, clock_in, clock_out) 
                          VALUES ${placeholders} 
                          ON DUPLICATE KEY UPDATE 
                          clock_in = VALUES(clock_in), 
                          clock_out = VALUES(clock_out)`;

        try {
            await db.executeQuery(sqlQuery, flatValues);
            console.log(`Processed ${chunk.length} attendance records`);
        } catch (error) {
            console.error(`Error processing attendance records:`, error);
            throw error;
        }
    }
}

// Main function to orchestrate the process
async function syncDataFromSqlServer() {
    try {
        const data = await fetchDataFromSqlServer();
        await updateInputData(data);
    } catch (err) {
        console.error('Error syncing data:', err);
    }
}

// Execute the sync function
syncDataFromSqlServer();









module.exports = {
    // mainDataSync,
    syncDataFromSqlServer,
    updateEmployeeMasterFromExcel
};




   // server: 'FTC-UNIS-TEST\SQLEXPRESS',

//    const sql = require('mssql');

//    const sqlServerConfig = {
//        user: 'sa',
//        password: 'ftc@123',
//        server: 'FTC-UNIS-TEST\\SQLEXPRESS', // Use double backslashes
//        database: 'UNIS',
//        options: {
//            encrypt: false,
//            trustServerCertificate: true
//        }
//    };
   
   
   
//    sql.connect(sqlServerConfig).then(pool => {
//        if (pool.connecting) {
//            console.log('Connecting to the SQL Server...');
//        }
//        if (pool.connected) {
//            console.log('Connected to the SQL Server');
//        }
//        return pool;
//    }).catch(err => {
//        console.error('SQL Server connection failed', err);
//    });
   






// const {syncDataFromSqlServer} = require('./datasync2');
// if(1+1==2){
//     syncDataFromSqlServer();
//  }
