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
  console.log("db is trying");
  let conn;
  try {
    conn = await this.getConnection();
    console.log("pool is working");

    const shifts = await this.query(conn, 'SELECT * FROM shift');
    console.log("got shifts", shifts);

    const employees = await this.query(conn, 'SELECT * FROM employee_master');
    console.log("got employees", employees);

    const inputData = await this.query(conn, 'SELECT * FROM input_data');
    console.log("got input data", inputData);

    const report = await this.processAttendanceData(shifts, employees, inputData);
    console.log("processed data", report);

    await this.insertOrUpdateGAR(conn, report);
    return report;
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



async processAttendanceData(shifts, employees, inputData) {
  const report = [];
  console.log("trying to process");
  const groupedData = this.groupByEmployeeAndDate(inputData);

  for (const [empId, dates] of Object.entries(groupedData)) {
      const employee = employees.find(emp => emp.EmpID === parseInt(empId));
      if (!employee) {
          console.error(`Employee not found for empId ${empId}`);
          continue;
      }
      const shift = shifts.find(s => s.Shift_id === employee.ShiftId);
      if (!shift) {
          console.error(`Shift not found for employee ${employee.EmpID} with shift_id ${employee.ShiftId}`);
          continue;
      }

      for (const [date, records] of Object.entries(dates)) {
          const attendanceRecord = await this.processEmployeeAttendance(employee, shift, records, date);
          if (attendanceRecord) {
              report.push(attendanceRecord);
          }
      }
  }

  return report;
}

async processEmployeeAttendance(employee, shift, records, date) {
  console.log("trying to process employee attendance", employee, shift, records, date);

  if (!employee) {
    console.error(`Employee is undefined for date ${date}`);
    return null;
  }

  if (!shift) {
    console.error(`Shift is undefined for employee ${employee.EmpID} on date ${date}`);
    return null;
  }

  const shiftStart = moment(shift.shift_start, 'HH:mm:ss');
  const shiftEnd = moment(shift.shift_end, 'HH:mm:ss');
  const lgtMinutes = shift.lgt_in_minutes;

  const clockInTime = moment.min(...records.map(r => moment(r.clock_in, 'HH:mm:ss')));
  const clockOutTime = moment.max(...records.map(r => moment(r.clock_out, 'HH:mm:ss')));

  const status = await this.determineStatus(clockInTime, shiftStart, lgtMinutes);
  const awh = await this.calculateAWH(clockInTime, clockOutTime, shift.hours_allowed_for_break);
  const ot = await this.calculateOT(clockOutTime, shiftEnd);

  return {
    emp_id: employee.EmpID,
    emp_fname: employee.EmpFName, // Assuming these fields exist in your employee object
    emp_lname: employee.EmpLName,  // Assuming these fields exist in your employee object
    shift_date: moment(date).format('YYYY-MM-DD'),
    first_in: clockInTime.format('HH:mm:ss'),
    last_out: clockOutTime.format('HH:mm:ss'),
    status,
    leave_id: 11, // You may need to determine this value based on your business logic
    awh,
    ot
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




// things I plan to do later : if absent make OT and AWH equal zero by default, 
//make it also display user grade, department, designation==jobtitle(i will change table job title to designation)
// make it also display shift info 
//make it order by 1. shift, then by site, then by department, then by date,



module.exports = DbService;