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
            const query = "SELECT uId FROM test_user WHERE uId = ?;";
            pool.query(query, [id], (err, results) => {
              if (err) reject(new Error(err.message));
              if (results.length === 0) {
                resolve(null); // or throw an error
              } else {
                const [{ uId }] = results;
                resolve(uId);
              }
            });
          });
          console.log(response, "response");  
          return response;
        } catch (error) {
          console.log(error);
        }
      }




// async updateClockingAndRecords(uid) {
//     try {
//       const timestamp = new Date().toISOString();
//       const response = await new Promise((resolve, reject) => {
//         const query = "UPDATE clocking SET cout = ? WHERE cid = (SELECT MAX(cid) FROM clocking WHERE uid = ?); INSERT INTO records (uid, cid, shiftId, timestamp) VALUES (?,?,(SELECT shiftId FROM test_user WHERE uid = ?),?);";
//         connection.query(query, [timestamp, uid, uid, uid, timestamp], (err, results) => {
//           if (err) reject(new Error(err.message));
//           resolve(results);
//         });
//       });
//       console.log(response, "response");
//       return response;
//     } catch (error) {
//       console.log(error);
//     }
//   }


async insertInput(uid) {
  console.log("db is working");
  try {
    const response = await new Promise((resolve, reject) => {
      const query = "INSERT INTO input_data (empid, clock_in) VALUES (?, NOW());";
      pool.query(query, [uid], (err, results) => {
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

// async generateAttendanceReport() {
//   console.log("db is trying");
//   let conn;
//   try {
//       conn = await new Promise((resolve, reject) => {
//           pool.getConnection((err, connection) => {
//               if (err) {
//                   reject(new Error('Error getting connection from pool: ' + err.message));
//               } else {
//                   resolve(connection);
//               }
//           });
//       });

//       console.log("pool is working");

//       const [shifts] = await new Promise((resolve, reject) => {
//           conn.query('SELECT * FROM shift', (err, results) => {
//               if (err) {
//                   reject(new Error('Error fetching shifts: ' + err.message));
//               } else {
//                   resolve([results]);
//               }
//           });
//       });
//       console.log("got shifts", shifts);

//       const [employees] = await new Promise((resolve, reject) => {
//           conn.query('SELECT * FROM employee_master', (err, results) => {
//               if (err) {
//                   reject(new Error('Error fetching employees: ' + err.message));
//               } else {
//                   resolve([results]);
//               }
//           });
//       });
//       console.log("got employees", employees);

//       const [inputData] = await new Promise((resolve, reject) => {
//           conn.query('SELECT * FROM input_data', (err, results) => {
//               if (err) {
//                   reject(new Error('Error fetching input data: ' + err.message));
//               } else {
//                   resolve([results]);
//               }
//           });
//       });
//       console.log("got input data", inputData);

//       const report = this.processAttendanceData(shifts, employees, inputData);
//       console.log("processed data", report);

//       await this.insertDataIntoGAR(conn, report);
//       return report;
//   } catch (error) {
//       console.log(error);
//   } finally {
//       if (conn) conn.release();
//   }
// }


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

      await this.insertDataIntoGAR(conn, report);
      return report;
  } catch (error) {
      console.log(error);
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
      return null; // or handle the error as needed
  }

  if (!shift) {
      console.error(`Shift is undefined for employee ${employee.EmpID} on date ${date}`);
      return null; // or handle the error as needed
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
      date,
      shift_id: shift.Shift_id,
      first_in: clockInTime.format('HH:mm:ss'),
      last_out: clockOutTime.format('HH:mm:ss'),
      status,
      awh,
      ot,
      department: employee.depId, // Assuming depId corresponds to department
      designation: employee.jobTitle
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


// async  insertDataIntoGAR(report) {
//   try {
//       const conn = await pool.getConnection();
//       const insertPromises = report.map(record => {
//           return new Promise((resolve, reject) => {
//               conn.query('INSERT INTO gar SET ?', record, (error, results) => {
//                   if (error) {
//                       return reject(error);
//                   }
//                   resolve(results);
//               });
//           });
//       });
//       await Promise.all(insertPromises);
//       conn.release();
//       console.log(`Inserted ${report.length} records into GAR table.`);
//   } catch (error) {
//       console.error('Error inserting data into GAR table:', error);
//   }
// }

async insertDataIntoGAR(conn, report) {
  if (!Array.isArray(report)) {
      console.error('Report is not an array:', report);
      return;
  }
  try {
      const insertPromises = report.map(record => {
          return this.query(conn, 'INSERT INTO general_attendance_report SET ?', record);
      });
      await Promise.all(insertPromises);
      console.log(`Inserted ${report.length} records into GAR table.`);
  } catch (error) {
      console.error('Error inserting data into GAR table:', error);
  }
}

}








module.exports = DbService;