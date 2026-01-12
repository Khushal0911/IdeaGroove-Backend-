import bcrypt from "bcryptjs";
import db from "../config/db.js";

// --- LOGIN CONTROLLER ---
export const userLogin = async (req, res) => {
  try {
    console.log("Login Attempt:", req.body);
    // 1. Sanitize inputs (Trim spaces to avoid " admin" vs "admin" mismatch)
    const username = req.body.username
      ? req.body.username.toString().trim()
      : "";
    const password = req.body.password ? req.body.password.toString() : "";

    // 2. Basic Empty Check
    if (!username || !password) {
      return res
        .status(400)
        .json({ message: "Please enter both username and password." });
    }

    // 3. Database Query
    const [rows] = await db.query(
      "SELECT * FROM student_tbl WHERE Username = ?",
      [username]
    );

    if (!rows || rows.length === 0) {
      return res.status(400).json({ message: "Invalid credentials." });
    }

    const user = rows[0];

    // 4. Password Check
    const match = await bcrypt.compare(password, user.Password);
    if (!match) {
      return res.status(400).json({ message: "Invalid credentials." });
    }

    // 5. Success Response (Return strictly necessary info)
    // Note: Documentation says Primary Key is 'S_ID' or 'student_id'. Adjust 'id' below if needed.
    return res.status(200).json({
      message: "Login successful",
      user: {
        id: user.S_ID || user.student_id,
        Username: user.Username,
        Email: user.Email,
        Name: user.Name,
      },
    });
  } catch (error) {
    console.error("User Login Error:", error);
    res.status(500).json({ message: "Server Error during login." });
  }
};

// --- REGISTER CONTROLLER ---
export const userRegister = async (req, res) => {
  console.log("Register Attempt:", req.body);
  // // Destructure incoming data
  // let {
  //   Username,
  //   Name,
  //   Roll_No,
  //   College_ID,
  //   Degree_ID,
  //   Year,
  //   Email,
  //   Password,
  //   Hobbies, // Expected to be an array: [1, 2]
  // } = req.body;

  // // --- STEP 1: SANITIZATION & TYPE SAFETY ---
  // // Convert to string and trim to prevent "SQL Injection via types" or whitespace errors
  // Username = Username?.toString().trim();
  // Name = Name?.toString().trim();
  // Roll_No = Roll_No?.toString().trim();
  // Email = Email?.toString().trim();
  // Password = Password?.toString(); // Do not trim password (spaces might be intentional)

  // // --- STEP 2: VALIDATION ---

  // // Required Fields Check
  // if (!Username || !Name || !Roll_No || !Email || !Password) {
  //   return res.status(400).json({
  //     error:
  //       "Missing required fields (Username, Name, Roll No, Email, Password).",
  //   });
  // }

  // // Length Constraints (Based on Data Dictionary )
  // if (Username.length > 25)
  //   return res
  //     .status(400)
  //     .json({ error: "Username must be 25 characters or less." });
  // if (Name.length > 25)
  //   return res
  //     .status(400)
  //     .json({ error: "Name must be 25 characters or less." });
  // if (Roll_No.length > 15)
  //   return res
  //     .status(400)
  //     .json({ error: "Roll No must be 15 characters or less." });
  // if (Email.length > 50)
  //   return res
  //     .status(400)
  //     .json({ error: "Email must be 50 characters or less." });

  // // Email Format Check
  // const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  // if (!emailRegex.test(Email)) {
  //   return res.status(400).json({ error: "Invalid email format." });
  // }

  // // Hobbies Type Check (Prevent server crash if Hobbies is "string" instead of array)
  // if (Hobbies && !Array.isArray(Hobbies)) {
  //   return res.status(400).json({ error: "Hobbies must be an array of IDs." });
  // }

  // let connection;
  // try {
  //   // --- STEP 3: DATABASE TRANSACTION ---
  //   const hashedPassword = await bcrypt.hash(Password, 10);

  //   // Get a dedicated connection for the transaction
  //   connection = await db.getConnection();
  //   await connection.beginTransaction();

  //   // A. Insert Student
  //   const studentSql = `
  //     INSERT INTO student_tbl
  //     (Username, Name, Roll_No, College_ID, Degree_ID, Year, Email, Profile_Pic, Password, is_Active)
  //     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  //   `;

  //   const [result] = await connection.query(studentSql, [
  //     Username,
  //     Name,
  //     Roll_No,
  //     College_ID || null, // Handle optional FKs
  //     Degree_ID || null,
  //     Year || null,
  //     Email,
  //     null, // Profile_Pic default
  //     hashedPassword,
  //     1, // is_Active = true
  //   ]);

  //   const newStudentId = result.insertId;

  //   // B. Insert Hobbies (if provided)
  //   if (Hobbies && Hobbies.length > 0) {
  //     const hobbySql = `INSERT INTO student_hobby_mapping_tbl (Student_ID, Hobby_ID) VALUES ?`;
  //     const hobbyValues = Hobbies.map((hobbyId) => [newStudentId, hobbyId]);
  //     await connection.query(hobbySql, [hobbyValues]);
  //   }

  //   // Commit changes
  //   await connection.commit();

  //   console.log(`User registered: ${Username} (ID: ${newStudentId})`);
  //   res
  //     .status(201)
  //     .json({ message: "Signup successful!", userId: newStudentId });
  // } catch (err) {
  //   // Rollback changes if ANY error occurs
  //   if (connection) await connection.rollback();

  //   console.error("Registration error:", err);

  //   // Handle Duplicate Entry specifically (Common in registration)
  //   if (err.code === "ER_DUP_ENTRY") {
  //     let msg = "User already exists.";
  //     if (err.sqlMessage.includes("Email"))
  //       msg = "Email is already registered.";
  //     if (err.sqlMessage.includes("Username"))
  //       msg = "Username is already taken.";
  //     if (err.sqlMessage.includes("Roll_No"))
  //       msg = "Roll Number is already registered.";
  //     return res.status(400).json({ error: msg });
  //   }

  //   return res
  //     .status(500)
  //     .json({ error: "Registration failed due to server error." });
  // } finally {
  //   // ALWAYS release the connection
  //   if (connection) connection.release();
  // }
};
