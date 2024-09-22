
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

app.get('/Clocking', (req, res) => {
    res.sendFile(path.join(__dirname,'..','Client','Clocking.html'));
});

app.get('/Dashboard', (req, res) => {
    res.sendFile(path.join(__dirname,'..','Client','Dashboard.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
})

