
const express = require('express');
const dotenv = require('dotenv');
const mysql = require('mysql');
const cors = require('cors');
const app = express();
const path = require("path");

dotenv.config();


const PORT = process.env.PORT || 8000;
app.use(cors());


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const dbService = require('./dbService.js'); 
 const { Console } = require('console');
const moment = require('moment/moment.js');
const db = dbService.getDbServiceInstance();




app.get('/api/admin-credentials', (req, res) => {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    res.json({
        email: adminEmail,
        password: adminPassword,
    });
});


app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname,'..','Client','Login.html'));
});


app.post('/api/input/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const result = await db.insertInput(id);
        if (result === null) {
            res.status(404).send({ message: 'Employee not found' });
        } else {
            res.json({ result });
        }
    } catch (error) {
        console.error('Error handling POST request:', error);
        res.status(500).send({ message: 'Internal Server Error' });
    }
});

app.patch('/api/update/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const result = await db.updateClockOut(id);
        if (result.affectedRows === 0) {
            res.status(404).send({ message: 'Employee not found or no record to update' });
        } else {
            res.json({ message: 'Clock out time updated successfully', result });
        }
    } catch (error) {
        console.error('Error handling PATCH request:', error);
        res.status(500).send({ message: 'Internal Server Error' });
    }
});



app.get('/api/employees/:id', async (req, res) => {
    console.log(req.params.id);
     console.log("api is working");
    const id = req.params.id;
    console.log(id);
    const employee = await db.getEmployee(id);
    console.log("app.js ",employee);
    //res.send(employee);
    if (employee === null) {
        res.status(404).send({ message: 'Employee not found' });
      } else {
        res.json({ employee });
      }
})

app.get('/api/attendance-report', async (req, res) => {
    try {
        console.log("api is working");
        const report = await db.generateAttendanceReport();
        res.json(report);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/departments', async (req, res) => {
    try {
        const departments = await db.getDepartments();
        res.json(departments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// app.get('/api/attendance-report', async (req, res) => {
//     try {
//         const { startDate, endDate, department } = req.query;
//         const report = await db.generateAttendanceReport(startDate, endDate, department);
//         res.json(report);
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// });



app.get('/api/data', async (req, res) => {
    try {
      const query = 'SELECT * FROM your_table_name';
      const [rows] = await db.execute(query);
      res.json(rows);
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });
  


app.get('/Clocking', (req, res) => {
    res.sendFile(path.join(__dirname,'..','Client','Clocking.html'));
});

app.get('/gar', (req, res) => {
    res.sendFile(path.join(__dirname,'..','Client','GAR2.html'));
});

app.get('/Dashboard', (req, res) => {
    res.sendFile(path.join(__dirname,'..','Client','Dashboard.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
})

