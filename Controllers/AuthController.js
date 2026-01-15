import bcrypt from "bcryptjs";
import db from "../config/db.js";

// --- REGISTER CONTROLLER ---
export const userRegister = async (req, res) => {
  console.log("Register Payload:", req.body);

  let {
    Username,
    Name,
    Roll_No,
    College_ID,
    Degree_ID,
    Year,
    Email,
    Password,
    hobby_ids,
  } = req.body;

  // Sanitization
  Username = Username?.toString().trim();
  Name = Name?.toString().trim();
  Roll_No = Roll_No?.toString().trim();
  Email = Email?.toString().trim();
  Password = Password?.toString();

  // Validation
  if (!Username || !Name || !Roll_No || !Email || !Password) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  let connection;
  try {
    const hashedPassword = await bcrypt.hash(Password, 10);

    // Get connection from pool and start transaction
    connection = await db.getConnection();
    await connection.beginTransaction();

    // 1. Insert Student
    const studentSql = `
      INSERT INTO student_tbl 
      (Username, Name, Roll_No, College_ID, Degree_ID, Year, Email, Password, is_Active) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await connection.query(studentSql, [
      Username,
      Name,
      Roll_No,
      College_ID || null,
      Degree_ID || null,
      Year || null,
      Email,
      hashedPassword,
      1,
    ]);
    const newStudentId = result.insertId;

    // 2. Insert Hobbies (if any)
    if (hobby_ids && Array.isArray(hobby_ids) && hobby_ids.length > 0) {
      const hobbySql = `INSERT INTO student_hobby_mapping_tbl (Student_ID, Hobby_ID) VALUES ?`;
      const hobbyValues = hobby_ids.map((hobbyId) => [newStudentId, hobbyId]);
      await connection.query(hobbySql, [hobbyValues]);
    }

    // 3. Commit
    await connection.commit();
    console.log(`User registered: ${Username} (ID: ${newStudentId})`);
    res
      .status(201)
      .json({ message: "Signup successful!", userId: newStudentId });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Registration error:", err);
    if (err.code === "ER_DUP_ENTRY") {
      return res
        .status(400)
        .json({ error: "Username, Email, or Roll No already exists." });
    }
    return res.status(500).json({ error: "Registration failed." });
  } finally {
    if (connection) connection.release();
  }
};

// --- LOGIN CONTROLLER ---
export const userLogin = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ message: "Missing credentials." });

    const [rows] = await db.query(
      "SELECT * FROM student_tbl WHERE Username = ?",
      [username]
    );
    if (rows.length === 0)
      return res.status(400).json({ message: "Invalid credentials." });

    const user = rows[0];
    const match = await bcrypt.compare(password, user.Password);
    if (!match)
      return res.status(400).json({ message: "Invalid credentials." });

    res.status(200).json({
      message: "Login successful",
      user: {
        id: user.S_ID || user.student_id,
        Username: user.Username,
        Email: user.Email,
        Name: user.Name,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error." });
  }
};
