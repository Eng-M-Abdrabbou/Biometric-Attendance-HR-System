const mysql = require('mysql');
const dotenv = require('dotenv');
const moment = require('moment'); 

let instance = null;
dotenv.config();


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
    const response = await new Promise((resolve, reject) => {
      const query = `
        UPDATE input_data 
        SET clock_out = NOW() 
        WHERE empid = ? AND date = CURDATE();
      `;
      pool.query(query, [empid], (err, results) => {
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


async generateAttendanceReport() {
  let conn;
  try {
    conn = await this.getConnection();
    console.log("pool is working");

    const shifts = await this.query(conn, 'SELECT * FROM shift');
    const employees = await this.query(conn, 'SELECT * FROM employee_master');
    const inputData = await this.query(conn, 'SELECT * FROM input_data');
    const departments = await this.query(conn, 'SELECT * FROM departments');
    const sections = await this.query(conn, 'SELECT * FROM section');
    const sites = await this.query(conn, 'SELECT * FROM sites');
    const designations = await this.query(conn, 'SELECT * FROM jobtitle');
    const grades = await this.query(conn, 'SELECT * FROM grade');

    const report = await this.processAttendanceData(shifts, employees, inputData, departments, sections, sites, designations, grades);
    await this.insertOrUpdateGAR(conn, report);
    return this.organizeReportData(report);
  } catch (error) {
    console.error("Error in generateAttendanceReport:", error);
    throw error;
  } finally {
    if (conn) conn.release();
  }
}

async getConnection() {
  return new Promise((resolve, reject) => {
      pool.getConnection((err, connection) => {
          if (err) {
              reject(new Error('Error getting connection from pool: ' + err.message));
          } else {
              resolve(connection);
          }
      });
  });
}

async query(conn, sql, values = []) {
  return new Promise((resolve, reject) => {
      conn.query(sql, values, (error, results) => {
          if (error) {
              reject(error);
          } else {
              resolve(results);
          }
      });
  });
}



async processAttendanceData(shifts, employees, inputData, departments, sections, sites, designations, grades) {
  const report = [];
  const groupedData = this.groupByEmployeeAndDate(inputData);

  for (const [empId, dates] of Object.entries(groupedData)) {
    const employee = employees.find(emp => emp.EmpID === parseInt(empId));
    if (!employee) continue;

    const shift = shifts.find(s => s.Shift_id === employee.ShiftId);
    const department = departments.find(d => d.depId === employee.depId);
    const section = sections.find(s => s.sectionId === department.section_Id);
    const site = sites.find(s => s.siteId === section.site_Id);
    const designation = designations.find(d => d.jobTitleId === employee.jobTitle);
    const grade = grades.find(g => g.gradeId === employee.EmployeeGradeID);

    for (const [date, records] of Object.entries(dates)) {
      const attendanceRecord = await this.processEmployeeAttendance(employee, shift, records, date, department, section, site, designation, grade);
      if (attendanceRecord) {
        report.push(attendanceRecord);
      }
    }
  }

  return report;
}


async processEmployeeAttendance(employee, shift, records, date, department, section, site, designation, grade) {
  if (!employee || !shift) return null;

  const shiftStart = moment(shift.shift_start, 'HH:mm:ss');
  const shiftEnd = moment(shift.shift_end, 'HH:mm:ss');
  const lgtMinutes = shift.lgt_in_minutes;

  const clockInTime = moment.min(...records.map(r => moment(r.clock_in, 'HH:mm:ss')));
  const clockOutTime = moment.max(...records.map(r => moment(r.clock_out, 'HH:mm:ss')));

  const status = await this.determineStatus(clockInTime, shiftStart, lgtMinutes);
  const awh = status === 'A' ? 0 : await this.calculateAWH(clockInTime, clockOutTime, shift.hours_allowed_for_break);
  const ot = status === 'A' ? 0 : await this.calculateOT(clockOutTime, shiftEnd);

  return {
    emp_id: employee.EmpID,
    emp_fname: employee.EmpFName,
    emp_lname: employee.EmpLName,
    shift_date: moment(date).format('YYYY-MM-DD'),
    first_in: clockInTime.format('HH:mm:ss'),
    last_out: clockOutTime.format('HH:mm:ss'),
    status,
    leave_id: 11,  // You may need to determine this value based on your business logic
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
  console.log("trying to group", inputData);
  return inputData.reduce((acc, record) => {
      const { empid, date } = record;
      if (!acc[empid]) acc[empid] = {};
      if (!acc[empid][date]) acc[empid][date] = [];
      acc[empid][date].push(record);
      return acc;
  }, {});
}

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

    organized[record.shift_id].sites[record.site_id].departments[record.department_id].employees[record.emp_id].attendance.push({
      shift_date: record.shift_date,
      first_in: record.first_in,
      last_out: record.last_out,
      status: record.status,
      awh: record.awh,
      ot: record.ot
    });
  });

  return organized;
}

async determineStatus(clockInTime, shiftStart, lgtMinutes) {
  console.log("trying to determine status", clockInTime, shiftStart, lgtMinutes);
  const latestAllowedTime = moment(shiftStart).add(lgtMinutes, 'minutes');
  const status = clockInTime.isSameOrBefore(latestAllowedTime) ? 'P' : 'A';
  console.log("status", status);
  return status;
}

async calculateAWH(clockInTime, clockOutTime, breakHours) {
  console.log("trying to calculate awh", clockInTime, clockOutTime, breakHours);
  const totalHours = moment.duration(clockOutTime.diff(clockInTime)).asHours();
  const awh = Math.max(totalHours - breakHours, 0).toFixed(2);
  console.log("AWH", awh);
  return awh;
}

async calculateOT(clockOutTime, shiftEnd) {
  console.log("trying to calculate ot", clockOutTime, shiftEnd);
  const otHours = moment.duration(clockOutTime.diff(shiftEnd)).asHours();
  const ot = Math.max(otHours, 0).toFixed(2);
  console.log("ot", ot);
  return ot;
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