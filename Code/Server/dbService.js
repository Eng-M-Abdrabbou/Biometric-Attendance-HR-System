const mysql = require('mysql');
const dotenv = require('dotenv');
const moment = require('moment'); 
const winston = require('winston');

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
  connectionLimit: 10,
  queueLimit: 0,
  acquireTimeout: 30000
  
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

class DbService {

    static instance;
    static getDbServiceInstance() {
        return instance ? instance : instance = new DbService();
    }

    constructor() {
      this.pool = mysql.createPool({
          host: process.env.DB_HOST,
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_NAME,
          port: process.env.DB_PORT,
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0,
          acquireTimeout: 30000
      });
  }

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

// async generateAttendanceReport() {
//   let conn;
//   try {
//     conn = await this.getConnection();
//     console.log("pool is working");

//     const shifts = await this.query(conn, 'SELECT * FROM shift');
//     const employees = await this.query(conn, 'SELECT * FROM employee_master');
//     const inputData = await this.query(conn, 'SELECT * FROM input_data');
//     const departments = await this.query(conn, 'SELECT * FROM departments');
//     const sections = await this.query(conn, 'SELECT * FROM section');
//     const sites = await this.query(conn, 'SELECT * FROM sites');
//     const designations = await this.query(conn, 'SELECT * FROM jobtitle');
//     const grades = await this.query(conn, 'SELECT * FROM grade');

//     const report = await this.processAttendanceData(shifts, employees, inputData, departments, sections, sites, designations, grades);
//     await this.insertOrUpdateGAR(conn, report);
//     return this.organizeReportData(report);
//   } catch (error) {
//     console.error("Error in generateAttendanceReport:", error);
//     throw error;
//   } finally {
//     if (conn) conn.release();
//   }
// }



async generateAttendanceReport(filters = {}) {
  let conn;
  try {
      conn = await this.getConnection();
      logger.debug('Building attendance report query with filters', { filters });

      let whereConditions = [];
      let params = [];

      // Build dynamic WHERE clause based on filters
      if (filters.dateFrom && filters.dateTo) {
          whereConditions.push('i.date BETWEEN ? AND ?');
          params.push(filters.dateFrom, filters.dateTo);
      }

      if (filters.empId) {
          whereConditions.push('e.EmpID = ?');
          params.push(filters.empId);
      }

      if (filters.empName) {
          whereConditions.push('(e.EmpFName LIKE ? OR e.EmpLName LIKE ?)');
          params.push(`%${filters.empName}%`, `%${filters.empName}%`);
      }

      if (filters.department) {
          whereConditions.push('e.depId = ?');
          params.push(filters.department);
      }

      if (filters.site) {
          whereConditions.push('sec.site_Id = ?');
          params.push(filters.site);
      }

      if (filters.nationality) {
          whereConditions.push('e.NationalityID = ?');
          params.push(filters.nationality);
      }

      // Construct the main query
      let baseQuery = `
          SELECT DISTINCT 
              i.*,
              e.EmpID, e.EmpFName, e.EmpLName, e.IsLive, e.EmployeeGradeID,
              e.NationalityID, e.EmailID, e.ShiftId, e.depId, e.jobTitle,
              s.Shift_id, s.shift_name, s.shift_type, s.shift_start, s.shift_end,
              s.hours_allowed_for_break, s.time_allowed_before_shift,
              s.shift_incharge, s.total_working_hours_before, s.lgt_in_minutes,
              d.depId, d.depName, d.section_Id,
              sec.sectionId, sec.sectionName, sec.site_Id,
              st.siteId, st.siteName, j.jobTitleId, j.jobTitleName, g.gradeId, g.gradeName
          FROM input_data i
          JOIN employee_master e ON i.empid = e.EmpID
          JOIN shift s ON e.ShiftId = s.Shift_id
          JOIN departments d ON e.depId = d.depId
          JOIN section sec ON d.section_Id = sec.sectionId
          JOIN sites st ON sec.site_Id = st.siteId
          JOIN jobtitle j ON e.jobTitle = j.jobTitleId
          JOIN grade g ON e.EmployeeGradeID = g.gradeId
      `;

      if (whereConditions.length > 0) {
          baseQuery += ' WHERE ' + whereConditions.join(' AND ');
      }

      logger.debug('Executing main query', { 
          query: baseQuery, 
          parameters: params 
      });

      const results = await this.query(conn, baseQuery, params);
      logger.info('Query executed successfully', { 
          rowCount: results.length 
      });

      console.log(results,"xxxxxxxxxxxxxxxxxxxx");

      // Process the results
      const processedData = await this.processAttendanceData(results);
      logger.debug('Data processing completed', { 
          processedRecords: Object.keys(processedData).length 
      });

      // Update GAR table
      await this.insertOrUpdateGAR(conn, processedData);

      // Organize and return the final report
      const organizedReport = this.organizeReportData(processedData);
      logger.info('Report generation completed', { 
          reportSize: Object.keys(organizedReport).length 
      });

      return organizedReport;
  } catch (error) {
      logger.error('Error generating attendance report', { 
          error: error.message,
          stack: error.stack
      });
      throw error;
  } finally {
      if (conn) {
          logger.debug('Releasing database connection');
          conn.release();
      }
  }
}



// async getFilterOptions() {
//   let conn;
//   try {
//       conn = await this.getConnection();
      
//       const departments = await this.query(conn, 'SELECT depId as id, depName as name FROM departments');
//       const sites = await this.query(conn, 'SELECT siteId as id, siteName as name FROM sites');
//       const nationalities = await this.query(conn, 'SELECT NationalityID as id, NationalityName as name FROM nationalities');

//       return {
//           departments,
//           sites,
//           nationalities
//       };
//   } catch (error) {
//       console.error("Error getting filter options:", error);
//       throw error;
//   } finally {
//       if (conn) conn.release();
//   }
// }


async getFilterOptions() {
  let conn;
  try {
      logger.debug('Fetching filter options');
      conn = await this.getConnection();
      
      const departments = await this.query(
          conn, 
          'SELECT depId as id, depName as name FROM departments'
      );
      
      const sites = await this.query(
          conn, 
          'SELECT siteId as id, siteName as name FROM sites'
      );
      
      const nationalities = await this.query(
          conn, 
          'SELECT NationalityID as id, NationalityName as name FROM nationalities'
      );

      logger.info('Filter options retrieved successfully', {
          departmentCount: departments.length,
          siteCount: sites.length,
          nationalityCount: nationalities.length
      });

      return { departments, sites, nationalities };
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




// async getConnection() {
//   return new Promise((resolve, reject) => {
//       pool.getConnection((err, connection) => {
//           if (err) {
//               reject(new Error('Error getting connection from pool: ' + err.message));
//           } else {
//               resolve(connection);
//           }
//       });
//   });
// }

// async query(conn, sql, values = []) {
//   return new Promise((resolve, reject) => {
//       pool.query(sql, values, (error, results) => {
//           if (error) {
//               console.error('Database query error:', error);
//               reject(error);
//           } else {
//               console.log('Database query results:', results);
//               resolve(results);
//           }
//       });
//   });
// }



async query(conn, sql, values = []) {
  return new Promise((resolve, reject) => {
      logger.debug('Executing query', { sql, values });
      conn.query(sql, values, (error, results) => {
          if (error) {
              logger.error('Database query error', { 
                  error: error.message,
                  sql,
                  values 
              });
              reject(error);
          } else {
              logger.debug('Query executed successfully', { 
                  rowCount: results.length 
              });
              resolve(results);
          }
      });
  });
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




// async processAttendanceData(shifts, employees, inputData, departments, sections, sites, designations, grades) {
//   const report = [];
//   const groupedData = this.groupByEmployeeAndDate(inputData);
// 
//   for (const [empId, dates] of Object.entries(groupedData)) {
//     const employee = employees.find(emp => emp.EmpID === parseInt(empId));
//     if (!employee) continue;
// 
//     const shift = shifts.find(s => s.Shift_id === employee.ShiftId);
//     const department = departments.find(d => d.depId === employee.depId);
//     const section = sections.find(s => s.sectionId === department.section_Id);
//     const site = sites.find(s => s.siteId === section.site_Id);
//     const designation = designations.find(d => d.jobTitleId === employee.jobTitle);
//     const grade = grades.find(g => g.gradeId === employee.EmployeeGradeID);
// 
//     for (const [date, records] of Object.entries(dates)) {
//       const attendanceRecord = await this.processEmployeeAttendance(employee, shift, records, date, department, section, site, designation, grade);
//       if (attendanceRecord) {
//         report.push(attendanceRecord);
//       }
//     }
//   }
// 
//   return report;
// }


async processAttendanceData(results) {
  try {
      logger.debug('Starting attendance data processing', {
          resultCount: results ? results.length : 0
      });

      // Validate input
      if (!results || !Array.isArray(results)) {
          logger.error('Invalid input data', { results });
          throw new Error('Input data must be an array');
      }

      const report = [];
      
      // Debug log before grouping
      logger.debug('Input data before grouping', {
          sampleRecord: results[0],
          totalRecords: results.length
      });

      const groupedData = this.groupByEmployeeAndDate(results);

      // Process grouped data
      for (const [empId, dates] of Object.entries(groupedData)) {
          // Extract employee data from the results
          const employeeRecords = results.filter(r => r.EmpID === parseInt(empId));
          if (!employeeRecords.length) continue;

          const employee = {
              EmpID: employeeRecords[0].EmpID,
              EmpFName: employeeRecords[0].EmpFName,
              EmpLName: employeeRecords[0].EmpLName,
              ShiftId: employeeRecords[0].ShiftId,
              depId: employeeRecords[0].depId,
              jobTitle: employeeRecords[0].jobTitle,
              EmployeeGradeID: employeeRecords[0].EmployeeGradeID
          };

          // Get related data from the first record
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
              depId: firstRecord.depId,
              depName: firstRecord.depName,
              section_Id: firstRecord.section_Id
          };

          const section = {
              sectionId: firstRecord.sectionId,
              sectionName: firstRecord.sectionName,
              site_Id: firstRecord.site_Id
          };

          const site = {
              siteId: firstRecord.siteId,
              siteName: firstRecord.siteName
          };
          const designation = {
              jobTitleId: firstRecord.jobTitleId,
              jobTitleName: firstRecord.jobTitleName
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

          console.log(firstRecord);
console.log(grade);
console.log(designation)
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
  if (!employee || !shift) return null;

  const shiftStart = moment(shift.shift_start, 'HH:mm:ss');
  const shiftEnd = moment(shift.shift_end, 'HH:mm:ss');
  const lgtMinutes = shift.lgt_in_minutes;

  const clockInTime = moment.min(...records.map(r => moment(r.clock_in, 'HH:mm:ss')));
  const clockOutTime = moment.max(...records.map(r => moment(r.clock_out, 'HH:mm:ss')));

  const status = await this.determineStatus(clockInTime,clockOutTime, shiftStart, lgtMinutes);
  const awh = 
  //status === 'A' ? '0:00' : 
  await this.calculateAWH(clockInTime, clockOutTime, shift.hours_allowed_for_break);
  const ot = status === 'A' ? '0:00' : await this.calculateOT(clockOutTime, shiftEnd);
console.log("xxxxxxxxxxxxx",  site.siteId,
  site.siteName,
  designation.jobTitleId,
   designation.jobTitleName,
 grade.gradeId,
 grade.gradeName );


  return {
    emp_id: employee.EmpID,
    emp_fname: employee.EmpFName,
    emp_lname: employee.EmpLName,
    shift_date: moment(date).format('YYYY-MM-DD'),
    first_in: clockInTime.format('HH:mm:ss'),
    last_out: clockOutTime.format('HH:mm:ss'),
    status,
    leave_id: 11,  
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
    designation_id: designation.jobTitleId,
    designation_name: designation.jobTitleName,
    grade_id: grade.gradeId,
    grade_name: grade.gradeName
  };
}





groupByEmployeeAndDate(inputData) {
  logger.debug('Starting groupByEmployeeAndDate', {
      inputDataLength: inputData.length
  });

  try {
      const grouped = inputData.reduce((acc, record) => {
          // Ensure required fields exist
          if (!record.empid || !record.date) {
              logger.warn('Record missing required fields', { record });
              return acc;
          }

          // Initialize nested objects if they don't exist
          if (!acc[record.empid]) {
              acc[record.empid] = {};
          }
          if (!acc[record.empid][record.date]) {
              acc[record.empid][record.date] = [];
          }

          acc[record.empid][record.date].push(record);
          return acc;
      }, {});

      logger.debug('Grouping completed', {
          employeeCount: Object.keys(grouped).length
      });

      return grouped;
  } catch (error) {
      logger.error('Error in groupByEmployeeAndDate', {
          error: error.message,
          inputDataSample: inputData?.[0]
      });
      throw error;
  }
}




//groupByEmployeeAndDate(inputData) {
//  console.log("trying to group", inputData);
//  return inputData.reduce((acc, record) => {
//      const { empid, date } = record;
//      if (!acc[empid]) acc[empid] = {};
//      if (!acc[empid][date]) acc[empid][date] = [];
//      acc[empid][date].push(record);
//      return acc;
//  }, {});
//}

organizeReportData(report) {
  const organized = {};

  report.forEach(record => {
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
        emp_name: `${record.emp_fname} ${record.emp_lname}`,
        grade: record.grade_name,
        designation: record.designation_name,
        attendance: []
      };
    }
    console.log("record", record.emp_id);


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



async determineStatus(clockInTime, clockOutTime, shiftStart, lgtMinutes) {
  console.log("trying to determine status", clockInTime, shiftStart, lgtMinutes);
  const latestAllowedTime = moment(shiftStart).add(lgtMinutes, 'minutes');
  const status = clockOutTime.isSame(moment('00:00:00', 'HH:mm:ss')) ? 'MS' : (clockInTime.isSameOrBefore(latestAllowedTime) ? 'P' : 'A');
 console.log("status is xyz", clockOutTime, );
  console.log("status", status);
  return status;
}

async calculateAWH(clockInTime, clockOutTime, breakHours) {
  console.log("trying to calculate awh", clockInTime, clockOutTime, breakHours);
  const totalHours = moment.duration(clockOutTime.diff(clockInTime)).asHours();
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


async insertDataIntoGAR(conn, report) {
  if (!Array.isArray(report)) {
    console.error('Report is not an array:', report);
    return;
  }
  try {
    const insertPromises = report.map(record => {
      // Ensure only valid fields are included
      const validRecord = {
        emp_id: record.emp_id,
        emp_fname: record.emp_fname,
        emp_lname: record.emp_lname,
        shift_date: record.shift_date,
        first_in: record.first_in,
        last_out: record.last_out,
        status: record.status,
        leave_id: record.leave_id,
        awh: record.awh,
        ot: record.ot
      };
      return this.query(conn, 'INSERT INTO general_attendance_report SET ?', validRecord);
    });
    await Promise.all(insertPromises);
    console.log(`Inserted ${report.length} records into GAR table.`);
  } catch (error) {
    console.error('Error inserting data into general_attendance_report table:', error);
    throw error;
  }
}

async insertOrUpdateGAR(conn, report) {
  if (!Array.isArray(report)) {
    console.error('Report is not an array:', report);
    return;
  }
  try {
    const insertOrUpdatePromises = report.map(async (record) => {
      const validRecord = {
        emp_id: record.emp_id,
        emp_fname: record.emp_fname,
        emp_lname: record.emp_lname,
        shift_date: record.shift_date,
        first_in: record.first_in,
        last_out: record.last_out,
        status: record.status,
        leave_id: record.leave_id,
        awh: record.awh,
        ot: record.ot
      };

      // Check if a record already exists
      const existingRecord = await this.query(
        conn,
        'SELECT * FROM general_attendance_report WHERE emp_id = ? AND shift_date = ?',
        [validRecord.emp_id, validRecord.shift_date]
      );

      if (existingRecord.length > 0) {
        // Record exists, check if it needs updating
        const currentRecord = existingRecord[0];
        const needsUpdate = Object.keys(validRecord).some(key => 
          key !== 'emp_id' && key !== 'shift_date' && currentRecord[key] !== validRecord[key]
        );

        if (needsUpdate) {
          // Update the existing record
          await this.query(
            conn,
            'UPDATE general_attendance_report SET ? WHERE emp_id = ? AND shift_date = ?',
            [validRecord, validRecord.emp_id, validRecord.shift_date]
          );
          console.log(`Updated record for employee ${validRecord.emp_id} on ${validRecord.shift_date}`);
        } else {
          console.log(`Duplicate record found for employee ${validRecord.emp_id} on ${validRecord.shift_date}, no changes needed`);
        }
      } else {
        // Insert new record
        await this.query(conn, 'INSERT INTO general_attendance_report SET ?', validRecord);
        console.log(`Inserted new record for employee ${validRecord.emp_id} on ${validRecord.shift_date}`);
      }
    });

    await Promise.all(insertOrUpdatePromises);
    console.log(`Processed ${report.length} records in GAR table.`);
  } catch (error) {
    console.error('Error processing data for general_attendance_report table:', error);
    throw error;
  }
}



}






module.exports = DbService;