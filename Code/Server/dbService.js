const mysql = require('mysql');
const dotenv = require('dotenv');
let instance = null;
dotenv.config();

const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
});

connection.connect((err) => {
    if (err) {
        console.log(err.message);
    }
     console.log('db ' + connection.state);
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
            connection.query(query, [id], (err, results) => {
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


async  addClockingRecord() {
    try {
      const timestamp = new Date().toISOString();
      const result = await db.query(
        'INSERT INTO clocking (cin) VALUES (?)',
        [timestamp]
      );
      return result;
    } catch (error) {
      console.error('Error adding clocking record:', error);
      throw error;
    }
  }

// insert employee

async  addEmployee(uid) {
    try {
      const result = await db.query(
        'INSERT INTO test_user (uid) VALUES (?)',
        [uid]
      );
      return result;
    } catch (error) {
      console.error('Error adding employee:', error);
      throw error;
    }
  }


//update employee

async  updateEmployee(uid, newUid) {
    try {
      const result = await db.query(
        'UPDATE test_user SET uid = ? WHERE uid = ?',
        [newUid, uid]
      );
      return result;
    } catch (error) {
      console.error('Error updating employee:', error);
      throw error;
    }
  }

//delete employee

async  deleteEmployee(uid) {
    try {
      const result = await db.query(
        'DELETE FROM test_user WHERE uid = ?',
        [uid]
      );
      return result;
    } catch (error) {
      console.error('Error deleting employee:', error);
      throw error;
    }
  }

async updateClockingAndRecords(uid) {
    try {
      const timestamp = new Date().toISOString();
      const response = await new Promise((resolve, reject) => {
        const query = "UPDATE clocking SET cout = ? WHERE cid = (SELECT MAX(cid) FROM clocking WHERE uid = ?); INSERT INTO records (uid, cid, shiftId, timestamp) VALUES (?,?,(SELECT shiftId FROM test_user WHERE uid = ?),?);";
        connection.query(query, [timestamp, uid, uid, uid, timestamp], (err, results) => {
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

//get employee

// async getEmployee(uid) {
//     try {
//         const result = await db.query(
//             'SELECT * FROM test_user WHERE uId = ?',
//             [uid]
//         );
//         return result[0];
//     } catch (error) {
//         console.error('Error getting employee:', error);
//         throw error;
//     }
// }


}


module.exports = DbService;