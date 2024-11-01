// dataSync.js















// const XLSX = require('xlsx');
// const moment = require('moment');
// const dbService = require('./dbService'); // Correctly import dbService
// const db = dbService.getDbServiceInstance();

// const MAX_CHUNK_SIZE = 1000; 














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



















// async function fetchEmployeeDetails(employeeIds) {
//     const CHUNK_SIZE = 500;
//     let results = [];

//     for (let i = 0; i < employeeIds.length; i += CHUNK_SIZE) {
//         const chunk = employeeIds.slice(i, i + CHUNK_SIZE).join(',');
//         const sql = `SELECT EmpID, EmpFName, EmpLName FROM employee_master WHERE EmpID IN (${chunk})`;
//         const chunkResults = await db.executeQuery(sql);

//         results = results.concat(chunkResults);
//     }

//     return results;
// }










/**
 * Process Excel Data
 * @param {string} filePath - Path to the Excel file
 * @returns {Array} - Processed data
 */








// function processExcelData(filePath) {
//     const workbook = XLSX.readFile(filePath);
//     const sheet = workbook.Sheets[workbook.SheetNames[0]];
//     const data = XLSX.utils.sheet_to_json(sheet);

//     // Log total rows and a sample row for verification
//     console.log(`Total Rows in Excel: ${data.length}`);
//     console.log('Sample Row:', data[0]);

//     // Process and filter data
//     return data
//         .filter(row => row.L_UID && row.C_Name && row.C_Date && row.C_Time && row.L_Mode !== undefined)
//         .map(row => ({
//             empId: row.L_UID,
//             empName: row.C_Name,
//             date: moment(`${row.C_Date} ${row.C_Time}`, 'YYYYMMDD HHmmss').format('YYYY-MM-DD HH:mm:ss'),
//             isClockIn: row.L_Mode === 1,
//             isClockOut: row.L_Mode === 2
//         }))
//         .filter(record => record !== null); // Ensure no null records
// }
















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

// async function updateEmployeeMaster(employees) {
//     const sql = "SELECT EmpID FROM employee_master";
//     const existingEmployees = await db.executeQuery(sql, []);
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

//     const placeholders = values.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
//     const insertSql = `INSERT INTO employee_master (EmpID, EmpFName, EmpLName, IsLive, EmployeeGradeID, CAddress1, NationalityID, Gender, EmailID, IsAutoPunch, assetId, ShiftId, jobTitle, accomodationId, depId) VALUES ${placeholders}`;
//     const flattenedValues = [].concat(...values);

//     try {
//         await db.executeQuery(insertSql, flattenedValues);
//         console.log(`Inserted ${newEmployees.length} new employees.`);
//     } catch (error) {
//         console.error('Error inserting new employees:', error);
//         throw error;
//     }
// }









// const xlsx = require('xlsx');
// const path = require('path');

// // Helper function to get department ID from name
// async function getDepartmentId(departmentName) {
//     const sql = "SELECT depId FROM departments WHERE depName = ?";
//     const result = await db.executeQuery(sql, [departmentName]);
//     return result.length > 0 ? result[0].depId : null;
// }

// // Helper function to get visa ID from type
// async function getVisaId(visaType) {
//     const sql = "SELECT visaId FROM visa WHERE visaType = ?";
//     const result = await db.executeQuery(sql, [visaType]);
//     return result.length > 0 ? result[0].visaId : null;
// }

// // Helper function to get or create section
// async function getOrCreateSection(sectionName, siteId) {
//     const checkSql = "SELECT sectionId FROM section WHERE sectionName = ?";
//     const result = await db.executeQuery(checkSql, [sectionName]);
//     if (result.length > 0) {
//         return result[0].sectionId;
//     }
//     const insertSql = "INSERT INTO section (sectionName, site_Id) VALUES (?, ?)";
//     await db.executeQuery(insertSql, [sectionName, siteId]);
//     return (await db.executeQuery(checkSql, [sectionName]))[0].sectionId;
// }

// // Helper function to get or create site
// async function getOrCreateSite(siteName, companyId) {
//     const checkSql = "SELECT siteId FROM sites WHERE siteName = ?";
//     const result = await db.executeQuery(checkSql, [siteName]);
//     if (result.length > 0) {
//         return result[0].siteId;
//     }
//     const insertSql = "INSERT INTO sites (siteName, company_Id) VALUES (?, ?)";
//     await db.executeQuery(insertSql, [siteName, companyId]);
//     return (await db.executeQuery(checkSql, [siteName]))[0].siteId;
// }

// // Helper function to get or create company (division)
// async function getOrCreateCompany(divisionName) {
//     const checkSql = "SELECT companyId FROM company WHERE companyName = ?";
//     const result = await db.executeQuery(checkSql, [divisionName]);
//     if (result.length > 0) {
//         return result[0].companyId;
//     }
//     const insertSql = "INSERT INTO company (companyName) VALUES (?)";
//     await db.executeQuery(insertSql, [divisionName]);
//     return (await db.executeQuery(checkSql, [divisionName]))[0].companyId;
// }

// // Helper function to determine grade ID based on OT eligibility
// function determineGradeId(otEligible) {
//     return otEligible ? 2 : 1; // 1 for staff (not eligible), 2 for technician (eligible)
// }

// async function updateEmployeeMaster() {
//     try {
//         // Load the Excel file
//         const filePath = path.resolve("C:/Users/Hp/OneDrive/Desktop/Emp.xlsx");
//         const workbook = xlsx.readFile(filePath);
//         const sheet = workbook.Sheets[workbook.SheetNames[0]];
//         const data = xlsx.utils.sheet_to_json(sheet);

//         // Get existing employees
//         const existingEmps = await db.executeQuery("SELECT * FROM employee_master");
//         const existingEmpMap = new Map(existingEmps.map(emp => [emp.EmpID, emp]));

//         for (const row of data) {
//             const empId = row["Employment Details Previous Employment ID"];
//             if (!empId) continue;

//             // Process name
//             const displayName = row["Display Name"] || "";
//             const nameParts = displayName.trim().split(/\s+/);
//             const firstName = nameParts[0];
//             const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : firstName;

//             // Process department
//             const departmentName = row["Department"];
//             const departmentId = await getDepartmentId(departmentName);
//             if (!departmentId) {
//                 console.log(`Department ${departmentName} not found in mapping`);
//                 continue;
//             }

//             // Process visa
//             const visaName = row["VISA"];
//             let visaId = await getVisaId(visaName);
//             if (!visaId) {
//                 const insertVisaSql = "INSERT INTO visa (visaType) VALUES (?)";
//                 await db.executeQuery(insertVisaSql, [visaName]);
//                 visaId = await getVisaId(visaName);
//             }

//             // Process location and related hierarchies
//             const location = row["Location"];
//             const division = row["Division"];
            
//             // Create/get company (division)
//             const companyId = await getOrCreateCompany(division);
            
//             // Create/get site (location)
//             const siteId = await getOrCreateSite(location, companyId);
            
//             // Create/get section (using location as section name for now)
//             const sectionId = await getOrCreateSection(location, siteId);

//             // Determine OT eligibility
//             const otEligible = row["OT Eligiblity"] === "Eligible" ? 1 : 0;
//             const gradeId = determineGradeId(otEligible);

//             // Prepare employee data
//             const employeeData = {
//                 EmpID: empId,
//                 EmpFName: firstName,
//                 EmpLName: lastName,
//                 IsLive: row["Employee Status"] === "Active" ? 1 : 0,
//                 EmployeeGradeID: gradeId,
//                 CAddress1: 'ad',
//                 NationalityID: row["Nationality"] === "Expat" ? 1 : 2,
//                 Gender: 1, // Default value
//                 EmailID: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@company.com`,
//                 IsAutoPunch: 1,
//                 assetId: 1,
//                 ShiftId: 1,
//                 jobTitle: 1, // You might want to create a mapping for this
//                 accomodationId: 1,
//                 depId: departmentId,
//                 VisaId: visaId,
//                 OT: otEligible
//             };

//             if (existingEmpMap.has(empId)) {
//                 // Update existing employee
//                 const updateFields = [];
//                 const updateValues = [];
//                 const existing = existingEmpMap.get(empId);

//                 // Compare and add changed fields
//                 for (const [key, value] of Object.entries(employeeData)) {
//                     if (existing[key] !== value) {
//                         updateFields.push(`${key} = ?`);
//                         updateValues.push(value);
//                     }
//                 }

//                 if (updateFields.length > 0) {
//                     updateValues.push(empId);
//                     const updateSql = `UPDATE employee_master SET ${updateFields.join(', ')} WHERE EmpID = ?`;
//                     await db.executeQuery(updateSql, updateValues);
//                     console.log(`Updated employee ${empId}`);
//                 }
//             } else {
//                 // Insert new employee
//                 const fields = Object.keys(employeeData).join(', ');
//                 const values = Object.values(employeeData);
//                 const placeholders = values.map(() => '?').join(', ');
//                 const insertSql = `INSERT INTO employee_master (${fields}) VALUES (${placeholders})`;
//                 await db.executeQuery(insertSql, values);
//                 console.log(`Inserted new employee ${empId}`);
//             }
//         }

//         console.log('Employee master update completed successfully');
//     } catch (error) {
//         console.error('Error updating employee master:', error);
//         throw error;
//     }
// }




// /**
//  * Group data by employee and date to prepare for input_data table
//  * @param {Array} data - Array of processed attendance records
//  * @returns {Map} - Grouped data
//  */
// function groupDataByEmployeeAndDate(data) {
//     return data.reduce((acc, record) => {
//         const dateOnly = record.date.split(' ')[0];
//         const key = `${record.empId}_${dateOnly}`;
//         if (!acc.has(key)) {
//             acc.set(key, { empId: record.empId, date: dateOnly, clockIn: null, clockOut: null });
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

// /**
//  * Update input_data table with attendance records
//  * @param {Array} processedData - Array of processed attendance records
//  * @returns {Promise}
//  */


// async function updateInputData(processedData) {
//     const groupedData = groupDataByEmployeeAndDate(processedData);
//     const records = Array.from(groupedData.values());
//     console.log('Sample Input Data Record:', records[0]);

//     // Function to process chunks
//     async function processChunk(chunk) {
//         const values = chunk.map(r => [r.empId, r.date, r.clockIn, r.clockOut]);
//         const placeholders = values.map(() => '(?, ?, ?, ?)').join(', ');
//         const flatValues = values.flat();
//         const sql = `INSERT INTO input_data (empid, date, clock_in, clock_out) VALUES ${placeholders} ON DUPLICATE KEY UPDATE clock_in = VALUES(clock_in), clock_out = VALUES(clock_out)`;

//         try {
//             await db.executeQuery(sql, flatValues);
//             console.log(`Upserted ${chunk.length} attendance records.`);
//         } catch (error) {
//             console.error(`Error upserting attendance records:`, error);
//             throw error;
//         }
//     }

//     // Split data into chunks and process each chunk
//     for (let i = 0; i < records.length; i += MAX_CHUNK_SIZE) {
//         const chunk = records.slice(i, i + MAX_CHUNK_SIZE);
//         await processChunk(chunk);
//     }
// }


// /**
//  * Main Data Synchronization Function
//  * @param {string} excelFilePath - Path to the Excel file
//  */
// async function mainDataSync(excelFilePath) {
//     try {
//         console.time('Data Sync'); // Start timer
//         const processedData = processExcelData(excelFilePath);

//         if (processedData.length === 0) {
//             console.warn('No valid data found in the Excel file');
//             return;
//         }

//         // Extract unique employees
//         const uniqueEmployeesMap = new Map();
//         processedData.forEach(record => {
//             uniqueEmployeesMap.set(record.empId, record.empName);
//         });
//         const uniqueEmployees = Array.from(uniqueEmployeesMap, ([empId, empName]) => ({ empId, empName }));

//         console.log(`Processing ${uniqueEmployees.length} unique employees`);

//         // Update employee_master table
//        // await updateEmployeeMaster(uniqueEmployees);
//         await updateEmployeeMaster();
//         // Update input_data table
//         await updateInputData(processedData);

//         // Fetch employee details to include first and last names for GAR
//         const employeeIds = Array.from(uniqueEmployeesMap.keys());
//         // const garEmployees = await db.executeQuery(
//         //     'SELECT EmpID, EmpFName, EmpLName FROM employee_master WHERE EmpID IN (?)',
//         //     [employeeIds]
//         // );





// // Usage in mainDataSync:
// const garEmployees = await fetchEmployeeDetails(employeeIds);





//         const empMap = new Map(garEmployees.map(emp => [emp.EmpID, { EmpFName: emp.EmpFName, EmpLName: emp.EmpLName }]));

//         // Prepare records for general_attendance_report table
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

//         // Log the number of GAR records being inserted/updated
//         console.log('Data being passed to insertOrUpdateGAR:', garRecords.length, 'records');

//         // Update general_attendance_report table
//         await db.insertOrUpdateGAR(garRecords);

//         console.log('Data synchronization completed successfully');
//         console.timeEnd('Data Sync'); // End timer
//     } catch (error) {
//         console.error('Error during data synchronization:', error);
//     }
// }

// module.exports = {
//     mainDataSync
// };

const XLSX = require('xlsx');
const moment = require('moment');
const path = require('path');
const dbService = require('./dbService');
const db = dbService.getDbServiceInstance();

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
// Export the rest of the functions as they were...
// Original functions for processing attendance data
// function processExcelData(filePath) {
//     const workbook = XLSX.readFile(filePath);
//     const sheet = workbook.Sheets[workbook.SheetNames[0]];
//     const data = XLSX.utils.sheet_to_json(sheet);

//     console.log(`Total Rows in Excel: ${data.length}`);
//     if (data.length > 0) console.log('Sample Row:', data[0]);

//     return data
//         .filter(row => row.L_UID && row.C_Name && row.C_Date && row.C_Time && row.L_Mode !== undefined)
//         .map(row => ({
//             empId: row.L_UID,
//             empName: row.C_Name,
//             date: moment(`${row.C_Date} ${row.C_Time}`, 'YYYYMMDD HHmmss').format('YYYY-MM-DD HH:mm:ss'),
//             isClockIn: row.L_Mode === 1,
//             isClockOut: row.L_Mode === 2
//         }))
//         .filter(record => record !== null);
// }

// function groupDataByEmployeeAndDate(data) {
//     return data.reduce((acc, record) => {
//         const dateOnly = record.date.split(' ')[0];
//         const key = `${record.empId}_${dateOnly}`;
//         if (!acc.has(key)) {
//             acc.set(key, { empId: record.empId, date: dateOnly, clockIn: null, clockOut: null });
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

// async function updateInputData(processedData) {
//     const groupedData = groupDataByEmployeeAndDate(processedData);
//     const records = Array.from(groupedData.values());
//     console.log('Sample Input Data Record:', records[0]);

//     for (let i = 0; i < records.length; i += MAX_CHUNK_SIZE) {
//         const chunk = records.slice(i, i + MAX_CHUNK_SIZE);
//         const values = chunk.map(r => [r.empId, r.date, r.clockIn, r.clockOut]);
//         const placeholders = values.map(() => '(?, ?, ?, ?)').join(', ');
//         const flatValues = values.flat();
//         const sql = `INSERT INTO input_data (empid, date, clock_in, clock_out) 
//                     VALUES ${placeholders} 
//                     ON DUPLICATE KEY UPDATE 
//                     clock_in = VALUES(clock_in), 
//                     clock_out = VALUES(clock_out)`;

//         try {
//             await db.executeQuery(sql, flatValues);
//             console.log(`Processed ${chunk.length} attendance records`);
//         } catch (error) {
//             console.error(`Error processing attendance records:`, error);
//             throw error;
//         }
//     }
// }

// async function fetchEmployeeDetails(employeeIds) {
//     const CHUNK_SIZE = 500;
//     let results = [];

//     for (let i = 0; i < employeeIds.length; i += CHUNK_SIZE) {
//         const chunk = employeeIds.slice(i, i + CHUNK_SIZE);
//         if (chunk.length === 0) continue;
        
//         const placeholders = chunk.map(() => '?').join(',');
//         const sql = `SELECT EmpID, EmpFName, EmpLName FROM employee_master WHERE EmpID IN (${placeholders})`;
//         const chunkResults = await db.executeQuery(sql, chunk);
//         results = results.concat(chunkResults);
//     }

//     return results;
// }

// async function mainDataSync(attendanceFilePath) {
//     try {
//         console.time('Data Sync');
//         console.log('Starting data synchronization...');

//         // First, update employee master from the new Excel file
//         console.log('Updating employee master from new Excel file...');
//         await updateEmployeeMasterFromExcel();
        
//         // Then process attendance data
//         console.log('Processing attendance data...');
//         const processedData = processExcelData(attendanceFilePath);

//         if (processedData.length === 0) {
//             console.warn('No valid attendance data found in the Excel file');
//             return;
//         }

//         // Extract unique employees
//         const uniqueEmployeesMap = new Map();
//         processedData.forEach(record => {
//             uniqueEmployeesMap.set(record.empId, record.empName);
//         });
//         const uniqueEmployees = Array.from(uniqueEmployeesMap, ([empId, empName]) => ({ empId, empName }));

//         console.log(`Processing ${uniqueEmployees.length} unique employees from attendance data`);

//         // Update input_data table
//         await updateInputData(processedData);

//         // Fetch employee details for GAR
//         const employeeIds = Array.from(uniqueEmployeesMap.keys());
//         const garEmployees = await fetchEmployeeDetails(employeeIds);
//         const empMap = new Map(garEmployees.map(emp => [emp.EmpID, { EmpFName: emp.EmpFName, EmpLName: emp.EmpLName }]));

//         // Prepare and update GAR
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
//                 leave_id: null,
//                 awh: 0,
//                 ot: 0
//             };
//         });

//         console.log(`Updating GAR with ${garRecords.length} records`);
//         await db.insertOrUpdateGAR(garRecords);

//         console.log('Data synchronization completed successfully');
//         console.timeEnd('Data Sync');
//     } catch (error) {
//         console.error('Error during data synchronization:', error);
//         throw error;
//     }
// }

// module.exports = {
//     mainDataSync,
//     updateEmployeeMasterFromExcel
// };


function processExcelData(filePath) {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    console.log(`Total Rows in Excel: ${data.length}`);
    if (data.length > 0) console.log('Sample Row:', data[0]);

    return data
        .filter(row => row.L_UID && row.C_Name && row.C_Date && row.C_Time && row.L_Mode !== undefined)
        .map(row => ({
            empId: row.L_UID,
            fullName: row.C_Name,
            date: moment(`${row.C_Date} ${row.C_Time}`, 'YYYYMMDD HHmmss').format('YYYY-MM-DD HH:mm:ss'),
            isClockIn: row.L_Mode === 1,
            isClockOut: row.L_Mode === 2
        }))
        .filter(record => record !== null);
}

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

async function updateInputData(processedData) {
    const groupedData = groupDataByEmployeeAndDate(processedData);
    const records = Array.from(groupedData.values());
    console.log('Sample Input Data Record:', records[0]);

    for (let i = 0; i < records.length; i += MAX_CHUNK_SIZE) {
        const chunk = records.slice(i, i + MAX_CHUNK_SIZE);
        const values = chunk.map(r => [r.empId, r.date, r.clockIn, r.clockOut]);
        const placeholders = values.map(() => '(?, ?, ?, ?)').join(', ');
        const flatValues = values.flat();
        const sql = `INSERT INTO input_data (empid, date, clock_in, clock_out) 
                    VALUES ${placeholders} 
                    ON DUPLICATE KEY UPDATE 
                    clock_in = VALUES(clock_in), 
                    clock_out = VALUES(clock_out)`;

        try {
            await db.executeQuery(sql, flatValues);
            console.log(`Processed ${chunk.length} attendance records`);
        } catch (error) {
            console.error(`Error processing attendance records:`, error);
            throw error;
        }
    }
}

async function fetchEmployeeDetails(employeeIds) {
    const CHUNK_SIZE = 500;
    let results = [];

    for (let i = 0; i < employeeIds.length; i += CHUNK_SIZE) {
        const chunk = employeeIds.slice(i, i + CHUNK_SIZE);
        if (chunk.length === 0) continue;
        
        const placeholders = chunk.map(() => '?').join(',');
        const sql = `SELECT EmpID, FullName FROM employee_master WHERE EmpID IN (${placeholders})`;
        const chunkResults = await db.executeQuery(sql, chunk);
        results = results.concat(chunkResults);
    }

    return results;
}

async function mainDataSync(attendanceFilePath) {
    try {
        console.time('Data Sync');
        console.log('Starting data synchronization...');

        // First, update employee master from the new Excel file
        console.log('Updating employee master from new Excel file...');
        await updateEmployeeMasterFromExcel();
        
        // Then process attendance data
        console.log('Processing attendance data...');
        const processedData = processExcelData(attendanceFilePath);

        if (processedData.length === 0) {
            console.warn('No valid attendance data found in the Excel file');
            return;
        }

        // Extract unique employees
        const uniqueEmployeesMap = new Map();
        processedData.forEach(record => {
            uniqueEmployeesMap.set(record.empId, record.fullName);
        });
        const uniqueEmployees = Array.from(uniqueEmployeesMap, ([empId, fullName]) => ({ empId, fullName }));

        console.log(`Processing ${uniqueEmployees.length} unique employees from attendance data`);

        // Update input_data table
        await updateInputData(processedData);

        // Fetch employee details for GAR
        // const employeeIds = Array.from(uniqueEmployeesMap.keys());
    //    const garEmployees = await fetchEmployeeDetails(employeeIds);
        // const empMap = new Map(garEmployees.map(emp => [emp.EmpID, { FullName: emp.FullName }]));

        // Prepare and update GAR
     //   const groupedData = groupDataByEmployeeAndDate(processedData);
        // const garRecords = Array.from(groupedData.values()).map(record => {
        //     const empDetails = empMap.get(record.empId);
        //     return {
        //         emp_id: record.empId,
        //         emp_fname: empDetails ? empDetails.FullName.split(' ')[0] : 'N/A',
        //         emp_lname: empDetails ? empDetails.FullName.split(' ')[1] : 'N/A',
        //         shift_date: record.date,
        //         first_in: record.clockIn || null,
        //         last_out: record.clockOut || null,
        //         status: (record.clockIn && record.clockOut) ? 'Present' : 'Absent',
        //         leave_id: null,
        //         awh: 0,
        //         ot: 0
        //     };
        // });

     //   console.log(`Updating GAR with ${garRecords.length} records`);
     //   await db.insertOrUpdateGAR(garRecords);

        console.log('Data synchronization completed successfully');
        console.timeEnd('Data Sync');
    } catch (error) {
        console.error('Error during data synchronization:', error);
        throw error;
    }
}

module.exports = {
    mainDataSync,
    updateEmployeeMasterFromExcel
};