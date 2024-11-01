//const mysql = require('mysql');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const moment = require('moment'); 
const winston = require('winston');
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 300 }); // Cache expires in 5 minutes
const util = require('util');
const e = require('express');


let instance = null;
dotenv.config();

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



const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  acquireTimeout: 60000,
  connectTimeout: 60000,
  maxIdle: 10,
  idleTimeout: 60000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

pool.getConnection((err, connection) => {
  if (err) {
      if (err.code === 'PROTOCOL_CONNECTION_LOST') {
          console.error('Database connection was closed.');
      }
      if (err.code === 'ER_CON_COUNT_ERROR') {
          console.error('Database has too many connections.');
      }
      if (err.code === 'ECONNREFUSED') {
          console.error('Database connection was refused.');
      }
  }
  if (connection) {
      connection.release();
      console.log('Connected to database');
  } 
});

pool.getConnection((err, connection) => {
  console.log('Callback:', typeof connection);
  if (err) {
      console.error('Error getting connection:', err);
      return;
  }
  connection.release();
});


pool.getConnection((err, connection) => {
  if (err) {
      console.error(err);
      return;
  }
  // Use the connection
  connection.release();
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});


// Promisify the pool.query method to use with async/await
const query = util.promisify(pool.query).bind(pool);


class DbService {

    static instance;
    static getDbServiceInstance() {
        return instance ? instance : instance = new DbService();
    }

    constructor() {
      this.pool = pool;
      };
  

  
    async getEmployee(id) {
        console.log("db is working");
        try {
          const response = await new Promise((resolve, reject) => {
            const query = "SELECT EmpID FROM employee_master WHERE EmpID = ?;";
            pool.query(query, [id], (err, results) => {
              if (err) reject(new Error(err.message));
              if (results.length === 0) {
                resolve(null); // or throw an error
              } else {
                const [{ EmpID }] = results;
                resolve(EmpID);
              }
            });
          });
          console.log(response, "response");  
          return response;
        } catch (error) {
          console.log(error);
        }
      }



async insertInput(EmpID) {
  console.log("db is working");
  try {
    const response = await new Promise((resolve, reject) => {
      const query = "INSERT INTO input_data (empid, clock_in) VALUES (?, NOW());";
      pool.query(query, [EmpID], (err, results) => {
        if (err) reject(new Error(err.message));
        resolve(results);
      });
    });
    console.log(response, "response");
    return response;
  } catch (error) {
    console.log(error);
  }
}

async updateClockOut(empid) {
  try {
    console.log("trying to update clock out");
    const response = await new Promise((resolve, reject) => {
      const query = `
        UPDATE input_data 
        SET clock_out = NOW() 
        WHERE empid = ? AND date = CURDATE();
      `;
      pool.query(query, [empid], (err, results) => {
        console.log("trying to update clock out");

        if (err) reject(new Error(err.message));
        resolve(results);
        console.log(results, "results");
      });
    });
    console.log(response, "response yaaaay");
    return response;
  } catch (error) {
    console.log(error);
  }
}


async IsclockedIn(id){
console.log("is he clocked in");
  let Conn;
try {
  Conn = await this.getConnection();
  const response = await new Promise((resolve, reject) => {
    const query = "SELECT * FROM input_data WHERE empid = ? AND clock_in IS NOT NULL AND date = CURDATE();";
    pool.query(query, [id], (err, results) => {
      if (err) reject(new Error(err.message));
      if (results.length === 0) {
        resolve(false); // or throw an error
      } else {
        resolve(true);
      }
    });
  });
  console.log(response, "the employee response for IsClockedIn");
  return response;
} catch (error) {
  console.log(error);
}

}



async queryDB(sql, values = []) {
  try {
      logger.debug('Executing query', { sql, values });
      const results = await query(sql, values);
      logger.debug('Query executed successfully', { rowCount: results.length, timestamp: new Date().toISOString() });
      return results;
  } catch (error) {
      logger.error('Database query error', { 
          error: error.message,
          sql,
          values 
      });
      throw error;
  }
}



async getFilterOptions() {
  let conn;
  try {
      logger.debug('Fetching filter options');
     // conn = await this.getConnection();
      logger.debug('Database connection established', { timestamp: new Date().toISOString() });
      const departments = await this.executeQuery(
           
          'SELECT depId as id, depName as name FROM departments'
      );
      
      const sites = await this.executeQuery(
          
          'SELECT siteId as id, siteName as name FROM sites'
      );
      
      const nationalities = await this.executeQuery(
          
          'SELECT NationalityID as id, NationalityName as name FROM nationalities'
      );
      const visa = await this.executeQuery(

          'SELECT VisaID as id, visaType as name FROM visa'
      );
      logger.info('Filter options retrieved successfully', {
          departmentCount: departments.length,
          siteCount: sites.length,
          nationalityCount: nationalities.length,
          visaCount: visa.length
      });

      return { departments, sites, nationalities, visa };
  } catch (error) {
      logger.error('Error retrieving filter options', { error });
      throw error;
  } finally {
      if (conn) conn.release();
  }
}



async getConnection() {
  return new Promise((resolve, reject) => {
      this.pool.getConnection((err, connection) => {
          if (err) {
              logger.error('Error getting database connection', { 
                  error: err.message 
              });
              reject(new Error('Database connection failed'));
          } else {
              logger.debug('Database connection acquired');
              resolve(connection);
          }
      });
  });
}



async query(sql, values = []) {
    try {
        if (typeof sql !== 'string' || !sql.trim()) {
            const error = new Error('SQL query is empty or not a string');
            logger.error('Database query error', { error: error.message, sql, values });
            throw error;
        }

        logger.debug('Executing query', { sql, values });

        const [results] = await this.pool.execute(sql, values);
        logger.debug('Query executed successfully', { rowCount: results.length, timestamp: new Date().toISOString() });
        return results;
    } catch (error) {
        logger.error('Database query error', { 
            error: error.message,
            sql,
            values 
        });
        throw error;
    }
}






async query1(sql, values = []) {
  return new Promise((resolve, reject) => {
    pool.query(sql, values, (error, results) => {
      if (error) {
        console.error('Database query error:', error);
        reject(error);
      } else {
        resolve(results);
      }
    });
  });}







organizeReportData(report) {
  const organized = {};

  report.flat().forEach(record => {
    if (!organized[record.shift_id]) {
      organized[record.shift_id] = {
        shift_name: record.shift_name,
        shift_type: record.shift_type,
        shift_start: record.shift_start,
        shift_end: record.shift_end,
        hours_allowed_for_break: record.hours_allowed_for_break,
        time_allowed_before_shift: record.time_allowed_before_shift,
        shift_incharge: record.shift_incharge,
        total_working_hours_before: record.total_working_hours_before,
        lgt_in_minutes: record.lgt_in_minutes,
        sites: {}
      };
    }

    if (!organized[record.shift_id].sites[record.site_id]) {
      organized[record.shift_id].sites[record.site_id] = {
        site_name: record.site_name,
        departments: {}
      };
    }

    if (!organized[record.shift_id].sites[record.site_id].departments[record.department_id]) {
      organized[record.shift_id].sites[record.site_id].departments[record.department_id] = {
        department_name: record.department_name,
        employees: {}
      };
    }

    if (!organized[record.shift_id].sites[record.site_id].departments[record.department_id].employees[record.emp_id]) {
      organized[record.shift_id].sites[record.site_id].departments[record.department_id].employees[record.emp_id] = {
        emp_name: record.full_name,
        grade: record.grade_name,
        designation: record.designation_name,
        attendance: []
      };
    }

    organized[record.shift_id].sites[record.site_id].departments[record.department_id].employees[record.emp_id].attendance.push({
      shift_date: record.shift_date,
      first_in: record.first_in,
      last_out: record.last_out,
      status: record.status,
      awh: record.awh,
      ot: record.ot
    });
  });

  console.log("organized", JSON.stringify(organized, null, 2));
  return organized;
}







async  determineStatus(clockInTime, clockOutTime, shiftStart, lgtMinutes, date) {
  console.log("trying to determine status", clockInTime, shiftStart, lgtMinutes);

  // if (!moment.isMoment(clockInTime) || !moment.isMoment(clockOutTime) || !moment.isMoment(shiftStart) || !moment.isMoment(date)) {
  //   console.error("Invalid time inputs: not moment objects");
  //   return 'MS'; // Return MS for invalid inputs
  // }

  const latestAllowedTime = moment(shiftStart).add(lgtMinutes, 'minutes');
  const dayOfWeek = moment(date).day();
  const isWeekend = (dayOfWeek === 6); // 6 is Saturday in moment.js

  let status;
  if ( clockOutTime === null || clockOutTime == null) {
    status = 'MS';
  } else if (isWeekend) {
    status = 'W';
  } else if (clockOutTime.isSame(moment('00:00:00', 'HH:mm:ss'))) {
    status = 'MS';
  } else {
    status = 'P'; // Present
  }

  console.log("status is", status);
  return status;
}







async calculateAWH(clockInTime, clockOutTime, breakHours, shift_start) {
  console.log("trying to calculate awh", clockInTime, clockOutTime, breakHours, shift_start);

  // Parse both times with the same format
  const shiftStartTime = moment(shift_start, "HH:mm:ss");
  const clockIn = moment(clockInTime, "HH:mm:ss");
  const clockOut = moment(clockOutTime, "HH:mm:ss");

  console.log("shiftStartTime", shiftStartTime.format());
  console.log("clockIn", clockIn.format());
  console.log("clockOut", clockOut.format());
  console.log("clockIn.isBefore(shiftStartTime)", clockIn.isBefore(shiftStartTime));

  let totalHours;

  if (clockIn.isBefore(shiftStartTime)) {
    totalHours = moment.duration(clockOut.diff(shiftStartTime)).asHours();
  } else {
    totalHours = moment.duration(clockOut.diff(clockIn)).asHours();
  }

  const awh = Math.max(totalHours - breakHours, 0).toFixed(2);
  console.log("AWH", awh);

  let result = awh % 1;
  let newawh = Math.floor(awh) + (result * 60) / 100;
  newawh = newawh.toFixed(2);

  return newawh;
}

async calculateOT(clockOutTime, shiftEnd) {
  console.log("trying to calculate ot", clockOutTime, shiftEnd);
  const otHours = moment.duration(clockOutTime.diff(shiftEnd)).asHours();
  const ot = Math.max(otHours, 0).toFixed(2);
  let result = ot % 1;
  let newot = Math.floor(ot) + (result * 60) / 100;
  newot = newot.toFixed(2);
  console.log("ot", newot);
  if(ot>2){
     let NEWot='2:00';
    return NEWot;
  }
  return newot;
}


// async insertOrUpdateGAR(report) {
//   if (!Array.isArray(report)) {
//       console.error('Report is not an array:', report);
//       return;
//   }
//   try {
//       const insertOrUpdatePromises = report.map(async (record) => {
//          // Log the record to inspect emp_id and shift_date
//          console.log('Processing Record:', record);
//           const validRecord = {
//               emp_id: record.emp_id,
//               emp_fname: record.emp_fname,
//               emp_lname: record.emp_lname,
//               shift_date: record.shift_date,
//               first_in: record.first_in,
//               last_out: record.last_out,
//               status: record.status,
//               leave_id: record.leave_id,
//               awh: record.awh,
//               ot: record.ot
//           };
//   // Check if emp_id and shift_date are present
//   if (!validRecord.emp_id || !validRecord.shift_date) {
//     console.warn('Missing emp_id or shift_date:', validRecord);
//     return;
// }
//           // Check if a record already exists
//           const existingRecord = await this.query(
//               'SELECT * FROM general_attendance_report WHERE emp_id = ? AND shift_date = ?',
//               [validRecord.emp_id, validRecord.shift_date]
//           );

//           if (existingRecord.length > 0) {
//               // Record exists, check if it needs updating
//               const currentRecord = existingRecord[0];
//               const needsUpdate = Object.keys(validRecord).some(key => 
//                   key !== 'emp_id' && key !== 'shift_date' && currentRecord[key] !== validRecord[key]
//               );

//               if (needsUpdate) {
//                   // Update the existing record
//                   await this.query(
//                       'UPDATE general_attendance_report SET ? WHERE emp_id = ? AND shift_date = ?',
//                       [validRecord, validRecord.emp_id, validRecord.shift_date]
//                   );
//                   console.log(`Updated record for employee ${validRecord.emp_id} on ${validRecord.shift_date}`);
//               } else {
//                   console.log(`Duplicate record found for employee ${validRecord.emp_id} on ${validRecord.shift_date}, no changes needed`);
//               }
//           } else {
//               // Insert new record
//               await this.query('INSERT INTO general_attendance_report SET ?', validRecord);
//               console.log(`Inserted new record for employee ${validRecord.emp_id} on ${validRecord.shift_date}`);
//           }
//       });

//       await Promise.all(insertOrUpdatePromises);
//       console.log(`Processed ${report.length} records in GAR table.`);
//   } catch (error) {
//       console.error('Error processing data for general_attendance_report table:', error);
//       throw error;
//   }
// }






// async executeQuery(sql, values = []) {
//   try {
//       logger.debug('Executing query', { sql, values });
//       const results = await this.query(sql, values);
//       logger.debug('Query executed successfully', { rowCount: results.length, timestamp: new Date().toISOString() });
//       return results;
//   } catch (error) {
//       logger.error('Database query error', { 
//           error: error.message,
//           sql,
//           values 
//       });
//       throw error;
//   }
// }







async executeQuery(sql, values = [], maxRetries = 3, timeout = 100000) {
  let retries = 0;

  while (retries < maxRetries) {
    try {
      logger.debug('Executing query', { sql, values });
      const results = await this.query(sql, values, { timeout });
      logger.debug('Query executed successfully', { rowCount: results.length, timestamp: new Date().toISOString() });
      return results;
    } catch (error) {
      logger.error('Database query error', {
        error: error.message,
        sql,
        values
      });

      if (error.code === 'ETIMEDOUT' || error.code === 'ER_LOCK_DEADLOCK') {
        retries++;
        logger.warn('Retrying query due to timeout or deadlock', { retries });
        await new Promise(res => setTimeout(res, 1000)); // Adding a delay before retrying
      } else {
        throw error;
      }
    }
  }

  throw new Error('Max retries reached. Query failed.');
}










async insertOrUpdateGAR(report) {
  if (!Array.isArray(report)) {
      console.error('Report is not an array:', report);
      return;
  }
logger.info('report', report);
  const BATCH_SIZE = 500;
  const validRecords = report.filter(record => record.emp_id && record.shift_date);

  if (validRecords.length === 0) {
      console.warn('No valid records to insert or update in GAR.');
      return;
  }

  try {
      for (let i = 0; i < validRecords.length; i += BATCH_SIZE) {
          const batch = validRecords.slice(i, i + BATCH_SIZE);
          const values = batch.map(record => [
              record.emp_id,
              record.FullName,
              record.shift_date,
              record.first_in,
              record.last_out,
              record.status,
              11,
              record.awh,
              record.ot
          ]);

          const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
          const flatValues = values.flat();

          const sql = `
              INSERT INTO general_attendance_report 
                  (emp_id, FullName, shift_date, first_in, last_out, status, leave_id, awh, ot)
              VALUES ${placeholders}
              ON DUPLICATE KEY UPDATE 
                  FullName = VALUES(FullName),
                  first_in = VALUES(first_in),
                  last_out = VALUES(last_out),
                  status = VALUES(status),
                  leave_id = VALUES(leave_id),
                  awh = VALUES(awh),
                  ot = VALUES(ot)
          `;

          await this.executeQuery(sql, flatValues);
          console.log(`Processed batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} records in GAR table.`);
      }

      console.log(`All ${validRecords.length} records have been processed in GAR table.`);
  } catch (error) {
      console.error('Error processing data for general_attendance_report table:', error);
      throw error;
  }
}





async insertOrUpdateInputData(dataArray, chunkSize = 1000) {
  const totalRows = dataArray.length;
  let currentIndex = 0;

  console.log(`Total Rows to Insert/Update: ${totalRows}`);

  while (currentIndex < totalRows) {
      const chunk = dataArray.slice(currentIndex, currentIndex + chunkSize);
      const placeholders = chunk.map(() => "(?, ?, ?, ?)").join(", ");
      const sql = `
          INSERT INTO input_data (empid, date, clock_in, clock_out)
          VALUES ${placeholders}
          ON DUPLICATE KEY UPDATE
          clock_in = VALUES(clock_in),
          clock_out = VALUES(clock_out)
      `;

      const flattenedValues = chunk.flat();

      try {
          await this.executeQuery(sql, flattenedValues);
          console.log(`Successfully inserted/updated chunk from row ${currentIndex + 1} to ${currentIndex + chunk.length}`);
      } catch (error) {
          console.error(`Error inserting/updating chunk from row ${currentIndex + 1} to ${currentIndex + chunk.length}: ${error.message}`);
          throw error;
      }

      currentIndex += chunkSize;
  }

  console.log('All data inserted/updated successfully.');
}


async endPool() {
  return await pool.end();
}








async generateAttendanceReport(filters = {}, limit = 100000, offset = 0) {
  try {
    logger.debug('Building attendance report query with filters', { filters });

    // Set default date range if not specified
    const today = moment().format('YYYY-MM-DD');
    filters.dateFrom = filters.dateFrom || today;
    filters.dateTo = filters.dateTo || today;

    logger.debug('Using date range', { dateFrom: filters.dateFrom, dateTo: filters.dateTo });

    // First, get all active employees from employee_master
    let employeeMasterQuery = `
      SELECT DISTINCT 
        e.SAPID,
        e.EmpID,
        e.FullName,
        e.EmpStatus,
        e.EmployeeGradeID,
        e.NationalityID,
        e.EmailID,
        e.ShiftId,
        e.DepId,
        e.DivId,
        e.SiteId,
        e.JobTitle,
        e.OT,
        e.VisaId,
        e.EXP_LOC,
        e.Accomodation,
        e.Gender,
        e.AssetID,
        e.DateOfJoining,
        s.Shift_id,
        s.shift_name,
        s.shift_type,
        s.shift_start,
        s.shift_end,
        s.hours_allowed_for_break,
        s.time_allowed_before_shift,
        s.shift_incharge,
        s.total_working_hours_before,
        s.lgt_in_minutes,
        d.depId,
        d.depName,
        sec.sectionId,
        sec.sectionName,
        st.siteId,
        st.siteName,
        g.gradeId,
        g.gradeName
      FROM employee_master e
      LEFT JOIN shift s ON e.ShiftId = s.Shift_id
      LEFT JOIN departments d ON e.DepId = d.depId
      LEFT JOIN section sec ON e.DivId = sec.sectionId
      LEFT JOIN sites st ON e.SiteId = st.siteId
      LEFT JOIN grade g ON e.EmployeeGradeID = g.gradeId
      LEFT JOIN visa v ON e.VisaId = v.visaId
      WHERE 1=1
    `;

    let whereConditions = [];
    let params = [];

    // Build dynamic WHERE clause based on filters
    if (filters.empId) {
      whereConditions.push('e.EmpID = ?');
      params.push(filters.empId);
    }

    if (filters.empName) {
      whereConditions.push('e.FullName LIKE ?');
      params.push(`%${filters.empName}%`);
    }

    if (filters.department) {
      whereConditions.push('e.DepId = ?');
      params.push(filters.department);
    }

    if (filters.site) {
      whereConditions.push('e.SiteId = ?');
      params.push(filters.site);
    }

    if (filters.nationality) {
      whereConditions.push('e.NationalityID = ?');
      params.push(filters.nationality);
    }

    if (filters.visa) {
      whereConditions.push('e.VisaId = ?');
      params.push(filters.visa);
    }

    if (whereConditions.length > 0) {
      employeeMasterQuery += ' AND ' + whereConditions.join(' AND ');
    }

    logger.debug('Executing employee master query', { 
      query: employeeMasterQuery, 
      parameters: params 
    });

    const allEmployees = await this.query(employeeMasterQuery, params);

    logger.debug('Employee master query results', { 
      employeeCount: allEmployees.length 
    });

    // Get attendance records for the date range
    let attendanceQuery = `
      SELECT 
        i.*,
        e.EmpID,
        e.FullName,
        e.EmpStatus,
        e.EmployeeGradeID,
        e.NationalityID,
        e.EmailID,
        e.ShiftId,
        e.DepId,
        e.DivId,
        e.SiteId,
        e.JobTitle,
        e.OT,
        e.VisaId,
        e.EXP_LOC,
        e.Accomodation,
        e.Gender,
        e.AssetID,
        e.DateOfJoining,
        s.Shift_id,
        s.shift_name,
        s.shift_type,
        s.shift_start,
        s.shift_end,
        s.hours_allowed_for_break,
        s.time_allowed_before_shift,
        s.shift_incharge,
        s.total_working_hours_before,
        s.lgt_in_minutes,
        d.depId,
        d.depName,
        sec.sectionId,
        sec.sectionName,
        st.siteId,
        st.siteName,
        g.gradeId,
        g.gradeName
      FROM input_data i
      JOIN employee_master e ON i.empid = e.EmpID
      LEFT JOIN shift s ON e.ShiftId = s.Shift_id
      LEFT JOIN departments d ON e.DepId = d.depId
      LEFT JOIN section sec ON e.DivId = sec.sectionId
      LEFT JOIN sites st ON e.SiteId = st.siteId
      LEFT JOIN grade g ON e.EmployeeGradeID = g.gradeId
      LEFT JOIN visa v ON e.VisaId = v.VisaId
      WHERE i.date BETWEEN ? AND ?
    `;

    let attendanceWhereConditions = [];
    let attendanceParams = [filters.dateFrom, filters.dateTo];

    // Build dynamic WHERE clause based on filters for attendanceQuery
    if (filters.empId) {
      attendanceWhereConditions.push('e.EmpID = ?');
      attendanceParams.push(filters.empId);
    }

    if (filters.empName) {
      attendanceWhereConditions.push('e.FullName LIKE ?');
      attendanceParams.push(`%${filters.empName}%`);
    }

    if (filters.department) {
      attendanceWhereConditions.push('e.DepId = ?');
      attendanceParams.push(filters.department);
    }

    if (filters.site) {
      attendanceWhereConditions.push('e.SiteId = ?');
      attendanceParams.push(filters.site);
    }

    if (filters.nationality) {
      attendanceWhereConditions.push('e.NationalityID = ?');
      attendanceParams.push(filters.nationality);
    }

    if (attendanceWhereConditions.length > 0) {
      attendanceQuery += ' AND ' + attendanceWhereConditions.join(' AND ');
    }

    logger.debug('Executing attendance query', { 
      query: attendanceQuery, 
      parameters: attendanceParams 
    });

    const attendanceRecords = await this.query(attendanceQuery, attendanceParams);

    logger.debug('Attendance query results', { 
      attendanceCount: attendanceRecords.length 
    });

    // Generate date range
    const dateRange = this.generateDateRange(filters.dateFrom, filters.dateTo);
    
    logger.debug('Generated date range', { 
      dateCount: dateRange.length,
      firstDate: dateRange[0],
      lastDate: dateRange[dateRange.length - 1]
    });

    // Combine attendance records with absent records
    const combinedResults = await this.combineAttendanceData(
      allEmployees,
      attendanceRecords,
      dateRange
    );

    const totalRecords = combinedResults.length;

    logger.debug('Combined results', { 
      totalRecords,
      sampleRecord: combinedResults[0] 
    });

    // Apply pagination to combined results
    const paginatedResults = combinedResults.slice(offset, offset + limit);

    // Process the results
    const processedData = await this.processAttendanceData(paginatedResults);

    // Organize and return the final report
    const organizedReport = this.organizeReportData(processedData);
    
    logger.info('Report generation completed', { 
      reportSize: Object.keys(organizedReport).length 
    });

    return { 
      report: organizedReport, 
      totalRecords,
      dateRange: {
        from: filters.dateFrom,
        to: filters.dateTo
      }
    };
  } catch (error) {
    logger.error('Error generating attendance report', { 
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

// Helper function to generate date range
generateDateRange(startDate, endDate) {
  try {
    const start = moment(startDate);
    const end = moment(endDate);
    const dates = [];

    while (start.isSameOrBefore(end)) {
      dates.push(start.format('YYYY-MM-DD'));
      start.add(1, 'days');
    }

    logger.debug('Generated date range', {
      startDate,
      endDate,
      numberOfDates: dates.length
    });

    return dates;
  } catch (error) {
    logger.error('Error generating date range', {
      error: error.message,
      startDate,
      endDate
    });
    throw error;
  }
}

// Helper function to combine attendance data
async combineAttendanceData(allEmployees, attendanceRecords, dateRange) {
  try {
    logger.debug('Starting to combine attendance data', {
      employeeCount: allEmployees.length,
      attendanceCount: attendanceRecords.length,
      dateCount: dateRange.length
    });

    if (!allEmployees.length) {
      logger.warn('No employees found in master data');
      return [];
    }

    // First, process all existing attendance records
    const combinedResults = [...attendanceRecords].map(record => ({
      ...record,
      is_absent: false  // These are actual attendance records, so they're present
    }));

    // Create a Set of keys for quick lookup of existing records
    const existingRecords = new Set(
      attendanceRecords.map(record => `${record.EmpID}_${moment(record.date).format('YYYY-MM-DD')}`)
    );

    // Now check for missing records and add absent records only for those
    for (const employee of allEmployees) {
      for (const date of dateRange) {
        const key = `${employee.EmpID}_${date}`;
        
        // Only add an absent record if no attendance record exists
        if (!existingRecords.has(key)) {
          combinedResults.push({
            ...employee,
            date,
            clock_in: null,
            clock_out: null,
            is_absent: true,
            EmpID: employee.EmpID  // Ensure EmpID is set correctly
          });
        }
      }
    }

    logger.debug('Data combination completed', {
      combinedRecordsCount: combinedResults.length,
      sampleRecord: combinedResults[0],
      absentCount: combinedResults.filter(r => r.is_absent).length,
      presentCount: combinedResults.filter(r => !r.is_absent).length
    });

    return combinedResults;
  } catch (error) {
    logger.error('Error combining attendance data', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

// Helper function to group data by employee and date
groupByEmployeeAndDate(inputData) {
  logger.debug('Starting groupByEmployeeAndDate', {
    inputDataLength: inputData.length
  });

  try {
    const grouped = inputData.reduce((acc, record) => {
      const employeeId = record.EmpID.toString();
      const date = record.date;

      if (!employeeId) {
        logger.warn('Record missing employee ID', { record });
        return acc;
      }

      if (!date) {
        logger.warn('Record missing date', { record });
        return acc;
      }

      if (!acc[employeeId]) {
        acc[employeeId] = {};
      }
      if (!acc[employeeId][date]) {
        acc[employeeId][date] = [];
      }

      acc[employeeId][date].push({
        ...record,
        is_absent: !!record.is_absent
      });

      return acc;
    }, {});

    logger.debug('Grouping completed', {
      employeeCount: Object.keys(grouped).length,
      sampleGroup: Object.entries(grouped)[0]
    });

    return grouped;
  } catch (error) {
    logger.error('Error in groupByEmployeeAndDate', {
      error: error.message,
      stack: error.stack,
      inputDataSample: inputData?.[0]
    });
    throw new Error(`Failed to group attendance data: ${error.message}`);
  }
}

// Helper function to process attendance data
async processAttendanceData(results) {
  try {
    logger.debug('Starting attendance data processing', {
      resultCount: results ? results.length : 0
    });

    if (!results || !Array.isArray(results)) {
      logger.error('Invalid input data', { results });
      throw new Error('Input data must be an array');
    }

    const report = [];
    logger.debug('Input data before grouping', {
      sampleRecord: results[0],
      totalRecords: results.length
    });

    const groupedData = this.groupByEmployeeAndDate(results);
    
    for (const [empId, dates] of Object.entries(groupedData)) {
      const employeeRecords = results.filter(r => r.EmpID.toString() === empId);
      if (!employeeRecords.length) continue;

      const employee = {
        EmpID: employeeRecords[0].EmpID,
        FullName: employeeRecords[0].FullName,
        EmpStatus: employeeRecords[0].EmpStatus,
        EmployeeGradeID: employeeRecords[0].EmployeeGradeID,
        Address: employeeRecords[0].Address,
        NationalityID: employeeRecords[0].NationalityID,
        EXP_LOC: employeeRecords[0].EXP_LOC,
        Gender: employeeRecords[0].Gender,
        EmailID: employeeRecords[0].EmailID,
        IsAutoPunch: employeeRecords[0].IsAutoPunch,
        AssetId: employeeRecords[0].AssetId,
        ShiftId: employeeRecords[0].ShiftId,
        JobTitle: employeeRecords[0].JobTitle,
        Accommodation: employeeRecords[0].Accommodation,
        DepId: employeeRecords[0].DepId,
        DivId: employeeRecords[0].DivId,
        SiteId: employeeRecords[0].SiteId,
        VisaId: employeeRecords[0].VisaId,
        OT: employeeRecords[0].OT,
        DateOfJoining: employeeRecords[0].DateOfJoining,
        SAPID: employeeRecords[0].SAPID
      };

      const firstRecord = employeeRecords[0];
      const shift = {
        Shift_id: firstRecord.Shift_id,
        shift_name: firstRecord.shift_name,
        shift_start: firstRecord.shift_start,
        shift_end: firstRecord.shift_end,
        shift_incharge: firstRecord.shift_incharge,
        shift_type: firstRecord.shift_type,
        hours_allowed_for_break: firstRecord.hours_allowed_for_break,
        lgt_in_minutes: firstRecord.lgt_in_minutes,
        total_working_hours_before: firstRecord.total_working_hours_before,
        time_allowed_before_shift: firstRecord.time_allowed_before_shift
      };

      const department = {
        depId: firstRecord.DepId,
        depName: firstRecord.depName
      };

      const section = {
        sectionId: firstRecord.sectionId,
        sectionName: firstRecord.sectionName
      };

      const site = {
        siteId: firstRecord.SiteId,
        siteName: firstRecord.siteName
      };

      const designation = {
        designationId: firstRecord.gradeId,
        designationName: firstRecord.JobTitle
      };

      const grade = {
        gradeId: firstRecord.gradeId,
        gradeName: firstRecord.gradeName
      };

      for (const [date, records] of Object.entries(dates)) {
        const attendanceRecord = await this.processEmployeeAttendance(
          employee,
          shift,
          records,
          date,
          department,
          section,
          site,
          designation,
          grade
        );

        if (attendanceRecord) {
          report.push(attendanceRecord);
        }
      }
    }

    logger.info('Data processing completed', {
      processedRecords: report.length
    });

    return report;
  } catch (error) {
    logger.error('Error in processAttendanceData', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}



async processEmployeeAttendance(employee, shift, records, date, department, section, site, designation, grade) {
  try {
    // Handle cross-day shifts (shift_id = 3)
    if (shift.Shift_id === 3) {
      return await this.processCrossDayAttendance(
        employee,
        shift,
        records,
        date,
        department,
        section,
        site,
        designation,
        grade
      );
    }

    // Existing logic for non-cross-day shifts remains unchanged
  
    const actualRecords = records.filter(r => !r.is_absent);

    let status, clockInTime, clockOutTime, awh, ot;

    if (actualRecords.length > 0) {
      const hasClockIn = actualRecords.some(r => r.clock_in);
      const hasClockOut = actualRecords.some(r => r.clock_out);

      if (!hasClockIn || !hasClockOut) {
        status = 'MS';
        clockInTime = hasClockIn
          ? moment.min(...actualRecords.filter(r => r.clock_in).map(r => moment(r.clock_in, 'HH:mm:ss')))
          : null;
        clockOutTime = hasClockOut
          ? moment.max(...actualRecords.filter(r => r.clock_out).map(r => moment(r.clock_out, 'HH:mm:ss')))
          : null;
        awh = 0;
        ot = 0;
      } else {
        clockInTime = moment.min(...actualRecords.filter(r => r.clock_in).map(r => moment(r.clock_in, 'HH:mm:ss')));
        clockOutTime = moment.max(...actualRecords.filter(r => r.clock_out).map(r => moment(r.clock_out, 'HH:mm:ss')));
        status = 'P';
        if(employee.IsAutoPunch===1){
          status = 'P';
        }
        // Calculate AWH and OT
        awh = await this.calculateAWH(clockInTime, clockOutTime, shift.hours_allowed_for_break, shift.shift_start);
        
        
    let    clockInTime1 = moment.min(...actualRecords.filter(r => r.clock_in).map(r => moment(r.clock_in, 'HH:mm:ss')));
  let  clockOutTime1 = moment.max(...actualRecords.filter(r => r.clock_out).map(r => moment(r.clock_out, 'HH:mm:ss')));
    const shiftStart1 = moment(shift.shift_start, 'HH:mm:ss');
    const shiftEnd1 = moment(shift.shift_end, 'HH:mm:ss');
        ot = (employee.OT === 1)
          ? await this.calculateOT(clockOutTime1, shiftEnd1)
          : 0;
      }
    } else {
     
      status = 'A';
      clockInTime = null;
      clockOutTime = null;
      awh = 0;
      ot = 0;
      if(employee.IsAutoPunch===1){
        status = 'P';
      }
    }

    const attendanceRecord = {
      sap_id: employee.SAPID,
      emp_id: employee.EmpID,
      full_name: employee.FullName,
      shift_date: moment(date).format('DD-MM-YYYY'),
      first_in: clockInTime ? clockInTime.format('HH:mm:ss') : 'Didn\'t clock in',
      last_out: clockOutTime ? clockOutTime.format('HH:mm:ss') : 'Didn\'t clock out',
      status,
      leave_id: status === 'A' ? 11 : 11,
      awh,
      ot,
      shift_id: shift.Shift_id,
      shift_name: shift.shift_name,
      shift_type: shift.shift_type,
      shift_start: shift.shift_start,
      shift_end: shift.shift_end,
      hours_allowed_for_break: shift.hours_allowed_for_break,
      time_allowed_before_shift: shift.time_allowed_before_shift,
      shift_incharge: shift.shift_incharge,
      total_working_hours_before: shift.total_working_hours_before,
      lgt_in_minutes: shift.lgt_in_minutes,
      department_id: department.depId,
      department_name: department.depName,
      section_id: section.sectionId,
      section_name: section.sectionName,
      site_id: site.siteId,
      site_name: site.siteName,
      designation_id: designation.designationId,
      designation_name: designation.designationName,
      grade_id: grade.gradeId,
      grade_name: grade.gradeName
    };

    logger.debug('Processed attendance record', {
      employeeId: employee.EmpID,
      date,
      status,
      awh,
      ot
    });

    return attendanceRecord;

  } catch (error) {
    logger.error('Error in processEmployeeAttendance', {
      error: error.message,
      stack: error.stack,
      employeeId: employee?.EmpID,
      date,
      shiftId: shift?.Shift_id
    });
    throw error;
  }
}















// Add these new helper functions to your DbService class

async processCrossDayAttendance(employee, shift, records, date, department, section, site, designation, grade) {
  try {
    logger.debug('Processing cross-day attendance', {
      employeeId: employee.EmpID,
      date,
      shiftId: shift.Shift_id
    });

    const today = moment().format('YYYY-MM-DD');
    const isToday = moment(date).isSame(today);
    
    // If it's today, we can only process today's records
    if (isToday) {
      logger.debug('Processing only today\'s records for cross-day shift', { date });
      
      // Create a modified version of processEmployeeAttendance that doesn't recurse
      const actualRecords = records.filter(r => !r.is_absent);
      let status, clockInTime, clockOutTime, awh, ot;

      if (actualRecords.length > 0) {
        const hasClockIn = actualRecords.some(r => r.clock_in);
        const hasClockOut = actualRecords.some(r => r.clock_out);

        if (!hasClockIn || !hasClockOut) {
          status = 'MS';
          clockInTime = hasClockIn
            ? moment.min(...actualRecords.filter(r => r.clock_in).map(r => moment(r.clock_in, 'HH:mm:ss')))
            : null;
          clockOutTime = hasClockOut
            ? moment.max(...actualRecords.filter(r => r.clock_out).map(r => moment(r.clock_out, 'HH:mm:ss')))
            : null;
          awh = 0;
          ot = 0;
        } else {
          clockInTime = moment.min(...actualRecords.filter(r => r.clock_in).map(r => moment(r.clock_in, 'HH:mm:ss')));
          clockOutTime = moment.max(...actualRecords.filter(r => r.clock_out).map(r => moment(r.clock_out, 'HH:mm:ss')));
          status = 'P';
          awh = await this.calculateAWH(clockInTime, clockOutTime, shift.hours_allowed_for_break, shift.shift_start);
          ot = (employee.OT === 1 && employee.EmployeeGradeID !== 1)
            ? await this.calculateOT(clockOutTime, moment(shift.shift_end, 'HH:mm:ss'))
            : 0;
        }
      } else {
        status = 'A';
        clockInTime = null;
        clockOutTime = null;
        awh = 0;
        ot = 0;
      }

      return {
        sap_id: employee.SAPID,
        emp_id: employee.EmpID,
        full_name: employee.FullName,
        shift_date: moment(date).format('YYYY-MM-DD'),
        first_in: clockInTime ? clockInTime.format('HH:mm:ss') : 'Didn\'t clock in',
        last_out: clockOutTime ? clockOutTime.format('HH:mm:ss') : 'Didn\'t clock out',
        status,
        leave_id: status === 'A' ? 11 : 11,
        awh,
        ot,
        shift_id: shift.Shift_id,
        shift_name: shift.shift_name,
        shift_type: shift.shift_type,
        shift_start: shift.shift_start,
        shift_end: shift.shift_end,
        hours_allowed_for_break: shift.hours_allowed_for_break,
        time_allowed_before_shift: shift.time_allowed_before_shift,
        shift_incharge: shift.shift_incharge,
        total_working_hours_before: shift.total_working_hours_before,
        lgt_in_minutes: shift.lgt_in_minutes,
        department_id: department.depId,
        department_name: department.depName,
        section_id: section.sectionId,
        section_name: section.sectionName,
        site_id: site.siteId,
        site_name: site.siteName,
        designation_id: designation.designationId,
        designation_name: designation.designationName,
        grade_id: grade.gradeId,
        grade_name: grade.gradeName
      };
    }

    // For past dates, process both days
    const nextDay = moment(date).add(1, 'day').format('YYYY-MM-DD');
    const nextDayRecords = await this.getNextDayRecords(employee.EmpID, nextDay);
    
    logger.debug('Retrieved next day records', {
      currentDate: date,
      nextDay,
      recordsCount: nextDayRecords.length
    });

    // Process records from both days together
    const allRecords = [...records, ...nextDayRecords];
    const actualRecords = allRecords.filter(r => !r.is_absent);

    let status, clockInTime, clockOutTime, awh, ot;

    if (actualRecords.length > 0) {
      const hasClockIn = actualRecords.some(r => r.clock_in);
      const hasClockOut = actualRecords.some(r => r.clock_out);

      if (!hasClockIn || !hasClockOut) {
        status = 'MS';
        clockInTime = hasClockIn
          ? moment.min(...actualRecords.filter(r => r.clock_in).map(r => moment(r.clock_in, 'HH:mm:ss')))
          : null;
        clockOutTime = hasClockOut
          ? moment.max(...actualRecords.filter(r => r.clock_out).map(r => moment(r.clock_out, 'HH:mm:ss')))
          : null;
        awh = 0;
        ot = 0;
      } else {
        clockInTime = moment.min(...actualRecords.filter(r => r.clock_in).map(r => moment(r.clock_in, 'HH:mm:ss')));
        clockOutTime = moment.max(...actualRecords.filter(r => r.clock_out).map(r => moment(r.clock_out, 'HH:mm:ss')));
        status = 'P';
        


        awh = await this.calculateAWHCD(
          clockInTime, 
          clockOutTime, 
          shift.hours_allowed_for_break, 
          shift.shift_start,
          shift.shift_end
        );
    
        ot = (employee.OT === 1 && employee.EmployeeGradeID !== 1)
          ? await this.calculateOTCD(
              clockInTime,
              clockOutTime,
              shift.shift_start,
              shift.shift_end
            )
          : 0;
      


/*
        // Calculate total duration across both days
        const totalDuration = moment.duration(clockOutTime.diff(clockInTime));
        const hoursWorked = totalDuration.asHours();
        
        // Calculate AWH and OT
        awh = Math.max(hoursWorked - shift.hours_allowed_for_break, 0).toFixed(2);
        const shiftEndTime = moment(shift.shift_end, 'HH:mm:ss');
        ot = (employee.OT === 1 && employee.EmployeeGradeID !== 1)
          ? await this.calculateOT(clockOutTime, shiftEndTime)
          : 0;
*/



      }
    } else {
      status = 'A';
      clockInTime = null;
      clockOutTime = null;
      awh = 0;
      ot = 0;
    }

    // Return two records - one for each day
    return [
      {
        sap_id: employee.SAPID,
        emp_id: employee.EmpID,
        full_name: employee.FullName,
        shift_date: moment(date).format('YYYY-MM-DD'),
        first_in: clockInTime ? clockInTime.format('HH:mm:ss') : 'Didn\'t clock in',
        last_out: '00:00:00', //clockOutTime ? clockOutTime.format('HH:mm:ss') : 'Didn\'t clock out',
        status,
        leave_id: status === 'A' ? 11 : 11,
        awh,
        ot,
        shift_id: shift.Shift_id,
        shift_name: shift.shift_name,
        shift_type: shift.shift_type,
        shift_start: shift.shift_start,
        shift_end: shift.shift_end,
        hours_allowed_for_break: shift.hours_allowed_for_break,
        time_allowed_before_shift: shift.time_allowed_before_shift,
        shift_incharge: shift.shift_incharge,
        total_working_hours_before: shift.total_working_hours_before,
        lgt_in_minutes: shift.lgt_in_minutes,
        department_id: department.depId,
        department_name: department.depName,
        section_id: section.sectionId,
        section_name: section.sectionName,
        site_id: site.siteId,
        site_name: site.siteName,
        designation_id: designation.designationId,
        designation_name: designation.designationName,
        grade_id: grade.gradeId,
        grade_name: grade.gradeName
      },
      {
        // Second day record with same details but different date and zero AWH/OT
        sap_id: employee.SAPID,
        emp_id: employee.EmpID,
        full_name: employee.FullName,
        shift_date: moment(nextDay).format('YYYY-MM-DD'),
        first_in: '00:00:00', //clockInTime ? clockInTime.format('HH:mm:ss') : 'Didn\'t clock in',
        last_out: clockOutTime ? clockOutTime.format('HH:mm:ss') : 'Didn\'t clock out',
        status,
        leave_id: status === 'A' ? 11 : 11,
        awh: 0, // AWH shown only in first record
        ot: 0,  // OT shown only in first record
        shift_id: shift.Shift_id,
        shift_name: shift.shift_name,
        shift_type: shift.shift_type,
        shift_start: shift.shift_start,
        shift_end: shift.shift_end,
        hours_allowed_for_break: shift.hours_allowed_for_break,
        time_allowed_before_shift: shift.time_allowed_before_shift,
        shift_incharge: shift.shift_incharge,
        total_working_hours_before: shift.total_working_hours_before,
        lgt_in_minutes: shift.lgt_in_minutes,
        department_id: department.depId,
        department_name: department.depName,
        section_id: section.sectionId,
        section_name: section.sectionName,
        site_id: site.siteId,
        site_name: site.siteName,
        designation_id: designation.designationId,
        designation_name: designation.designationName,
        grade_id: grade.gradeId,
        grade_name: grade.gradeName
      }
    ];
  } catch (error) {
    logger.error('Error processing cross-day attendance', {
      error: error.message,
      stack: error.stack,
      employeeId: employee?.EmpID,
      date
    });
    throw error;
  }
}



async getNextDayRecords(empId, nextDay) {
  try {
    logger.info('Fetching next day records', {
      empId,
      nextDay
    });
    const query = `
      SELECT * FROM input_data 
      WHERE empid = ? AND date = ?
    `;
    return await this.executeQuery(query, [empId, nextDay]);
  } catch (error) {
    logger.error('Error fetching next day records', {
      error: error.message,
      stack: error.stack,
      empId,
      nextDay
    });
    return [];
  }
}

async calculateAWHCD(clockInTime, clockOutTime, breakHours, shift_start, shift_end) {
  try {
    logger.debug('Calculating cross-day AWH', {
      clockInTime: clockInTime.format('YYYY-MM-DD HH:mm:ss'),
      clockOutTime: clockOutTime.format('YYYY-MM-DD HH:mm:ss'),
      breakHours,
      shift_start,
      shift_end
    });

    // Create base times for comparison
    const shiftStartTime = moment(shift_start, 'HH:mm:ss');
    const shiftEndTime = moment(shift_end, 'HH:mm:ss');
    
    // Adjust clock times to ensure proper calculation across days
    let adjustedClockIn = moment(clockInTime);
    let adjustedClockOut = moment(clockOutTime);
    
    // If shift ends next day and clockOut is before clockIn, add a day to clockOut
    if (shiftEndTime.isBefore(shiftStartTime) && adjustedClockOut.isBefore(adjustedClockIn)) {
      adjustedClockOut.add(1, 'day');
    }

    // Calculate total duration
    let totalHours;
    
    if (adjustedClockIn.isBefore(shiftStartTime)) {
      // If clocked in before shift start, calculate from shift start
      totalHours = moment.duration(adjustedClockOut.diff(shiftStartTime)).asHours();
    } else {
      // Otherwise calculate from actual clock in
      totalHours = moment.duration(adjustedClockOut.diff(adjustedClockIn)).asHours();
    }

    // Subtract break hours and ensure non-negative
    const awh = Math.max(totalHours - breakHours, 0).toFixed(2);
    
    // Convert decimal minutes to percentage of hour
    const result = awh % 1;
    let finalAWH = Math.floor(awh) + (result * 60) / 100;
    finalAWH = finalAWH.toFixed(2);

    logger.debug('Cross-day AWH calculation result', {
      totalHours,
      breakHours,
      awh,
      finalAWH
    });

    return parseFloat(finalAWH);
  } catch (error) {
    logger.error('Error calculating cross-day AWH', {
      error: error.message,
      stack: error.stack
    });
    return 0;
  }
}

async calculateOTCD(clockInTime, clockOutTime, shift_start, shift_end) {
  try {
    logger.debug('Calculating cross-day OT', {
      clockInTime: clockInTime.format('YYYY-MM-DD HH:mm:ss'),
      clockOutTime: clockOutTime.format('YYYY-MM-DD HH:mm:ss'),
      shift_start,
      shift_end
    });

    // Create base times for comparison
    const shiftStartTime = moment(shift_start, 'HH:mm:ss');
    const shiftEndTime = moment(shift_end, 'HH:mm:ss');
    
    // Adjust clock times to ensure proper calculation across days
    let adjustedClockIn = moment(clockInTime);
    let adjustedClockOut = moment(clockOutTime);
    let adjustedShiftEnd = moment(shiftEndTime);

    // If shift ends next day, add a day to shift end time
    if (shiftEndTime.isBefore(shiftStartTime)) {
      adjustedShiftEnd.add(1, 'day');
    }

    // If clock out is before clock in, add a day to clock out
    if (adjustedClockOut.isBefore(adjustedClockIn)) {
      adjustedClockOut.add(1, 'day');
    }

    // Calculate OT hours
    const otHours = moment.duration(adjustedClockOut.diff(adjustedShiftEnd)).asHours();

    // If OT is negative or NaN, return 0
    if (otHours <= 0 || isNaN(otHours)) {
      return 0;
    }

    // Convert to fixed decimal
    const otDecimal = otHours.toFixed(2);
    
    // Convert decimal minutes to percentage of hour
    const otMinutes = Math.round((parseFloat(otDecimal) % 1) * 60);
    const finalOT = Math.floor(otDecimal) + (otMinutes / 100);

    logger.debug('Cross-day OT calculation result', {
      otHours,
      otDecimal,
      otMinutes,
      finalOT
    });

    return parseFloat(finalOT.toFixed(2));
  } catch (error) {
    logger.error('Error calculating cross-day OT', {
      error: error.message,
      stack: error.stack
    });
    return 0;
  }
}














}

module.exports = DbService;