import mysql from 'mysql2';
import dotenv from 'dotenv';
import { exit } from 'process';

dotenv.config();

const connection = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'Rushi@72'
});

connection.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL server:', err);
    exit(1);
  }
  console.log('Connected to MySQL server');

  const dbName = process.env.DB_NAME || 'medibot';

  const createDbQuery = `CREATE DATABASE IF NOT EXISTS ${dbName}`;
  
  connection.query(createDbQuery, (err) => {
    if (err) {
      console.error('Error creating database:', err);
      exit(1);
    }
    console.log(`Database ${dbName} created or already exists`);

    connection.changeUser({ database: dbName }, (err) => {
      if (err) {
        console.error('Error switching to database:', err);
        exit(1);
      }

      const createUsersTable = `
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          role ENUM('patient', 'doctor') DEFAULT 'patient',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      const createAppointmentsTable = `
        CREATE TABLE IF NOT EXISTS appointments (
          id INT AUTO_INCREMENT PRIMARY KEY,
          patient_id INT NOT NULL,
          doctor_id INT NOT NULL,
          doctor_name VARCHAR(255) NOT NULL,
          date DATE NOT NULL,
          time TIME NOT NULL,
          reason VARCHAR(255),
          status ENUM('pending', 'accepted', 'completed', 'cancelled') DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (patient_id) REFERENCES users(id),
          FOREIGN KEY (doctor_id) REFERENCES users(id)
        )
      `;

      const createPrescriptionsTable = `
        CREATE TABLE IF NOT EXISTS prescriptions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          appointment_id INT NOT NULL,
          patient_id INT NOT NULL,
          doctor_id INT NOT NULL,
          medication_details TEXT NOT NULL,
          dosage VARCHAR(255),
          instructions TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (appointment_id) REFERENCES appointments(id),
          FOREIGN KEY (patient_id) REFERENCES users(id),
          FOREIGN KEY (doctor_id) REFERENCES users(id)
        )
      `;

      connection.query(createUsersTable, (err) => {
        if (err) {
          console.error('Error creating users table:', err);
          exit(1);
        }
        console.log('Users table ready');
        
        connection.query(createAppointmentsTable, (err) => {
          if (err) {
            console.error('Error creating appointments table:', err);
            exit(1);
          }
          console.log('Appointments table ready');

          connection.query(createPrescriptionsTable, (err) => {
            if (err) {
              console.error('Error creating prescriptions table:', err);
              exit(1);
            }
            console.log('Prescriptions table ready');
            exit(0);
          });
        });
      });
    });
  });
});
