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
    Hobbies,
  } = req.body;

  const Profile_Pic = req.file ? req.file.path : null;

  // Sanitization
  Username = Username?.toString().trim();
  Name = Name?.toString().trim();
  Roll_No = Roll_No?.toString().trim();
  Email = Email?.toString().trim();
  Password = Password?.toString();

  const collegeIdInt = College_ID ? parseInt(College_ID) : null;
  const degreeIdInt = Degree_ID ? parseInt(Degree_ID) : null;
  const yearInt = Year ? parseInt(Year) : null;

  // Validation
  if (!Username || !Name || !Roll_No || !Email || !Password) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  let parsedHobbies = [];
  if (Hobbies) {
    if (Array.isArray(Hobbies)) {
      parsedHobbies = Hobbies;
    } else if (typeof Hobbies === "string") {
      // Split by comma if it's a string "1,2,3"
      parsedHobbies = Hobbies.split(",").map((h) => h.trim());
    }
  }
  // Filter out empty values and convert to Integers
  parsedHobbies = parsedHobbies
    .map((id) => parseInt(id))
    .filter((id) => !isNaN(id));

  console.log("✅ Parsed Hobbies:", parsedHobbies);

  let connection;
  try {
    const hashedPassword = await bcrypt.hash(Password, 10);

    // Get connection from pool and start transaction
    connection = await db.getConnection();
    await connection.beginTransaction();

    // 1. Insert Student
    const studentSql = `
      INSERT INTO student_tbl 
      (Username, Name, Roll_No, College_ID, Degree_ID, Year, Email, Password, Profile_Pic, is_Active) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      Profile_Pic,
      1,
    ]);
    const newStudentId = result.insertId;

    // --- 5. Insert Hobbies (if any) ---
    if (parsedHobbies.length > 0) {
      const hobbySql = `INSERT INTO student_hobby_mapping_tbl (Student_ID, Hobby_ID) VALUES ?`;

      // Prepare bulk insert array: [[student_id, hobby_id_1], [student_id, hobby_id_2], ...]
      const hobbyValues = parsedHobbies.map((hobbyId) => [
        newStudentId,
        hobbyId,
      ]);

      await connection.query(hobbySql, [hobbyValues]);
    }

    const [userRows] = await connection.query(
      `
      SELECT s.*, c.College_Name, d.Degree_Name
      FROM student_tbl s
      LEFT JOIN college_tbl c ON s.College_ID = c.College_ID
      LEFT JOIN degree_tbl d ON s.Degree_ID = d.Degree_ID
      WHERE s.S_ID = ?
    `,
      [newStudentId]
    );

    const newUser = userRows[0];

    // --- 4. Fetch Hobby Names ---
    const [hobbyRows] = await connection.query(
      `
      SELECT h.Hobby_Name 
      FROM hobbies_tbl h
      JOIN student_hobby_mapping_tbl m ON h.Hobby_ID = m.Hobby_ID
      WHERE m.Student_ID = ?
    `,
      [newStudentId]
    );

    const hobbyNames = hobbyRows.map((h) => h.Hobby_Name);

    // 3. Commit
    await connection.commit();

    console.log(`User registered: ${Username} (ID: ${newStudentId})`);

    const userData = {
      id: newUser.S_ID,
      Name: newUser.Name,
      Username: newUser.Username,
      Email: newUser.Email,
      Roll_No: newUser.Roll_No,
      Year: newUser.Year,
      College: newUser.College_Name || "N/A", // Sending Name, not ID
      Degree: newUser.Degree_Name || "N/A", // Sending Name, not ID
      Profile_Pic: newUser.Profile_Pic, // Sending the Cloudinary URL
      Hobbies: hobbyNames, // Sending Names ["Art", "Music"]
    };

    res.status(201).json({ message: "Signup successful!", user: userData });
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
export const userLogin = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    console.log("Received Login Payload:", req.body);

    if (!username || !password)
      return res.status(400).json({ message: "Missing credentials." });

    console.log("Login Attempt for:", username);

    const [rows] = await db.query(
      "SELECT * FROM student_tbl WHERE Username = ?",
      [username]
    );

    if (rows.length === 0) {
      console.log("User not found");
      return res.status(400).json({ message: "Invalid credentials." });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.Password);
    console.log("Password Match Result:", match);
    if (!match) {
      console.log("Password mismatch");
      return res.status(400).json({ message: "Invalid credentials." });
    }

    const [hobbyRows] = await db.query(
      `SELECT h.Hobby_Name 
       FROM hobbies_tbl h
       JOIN student_hobby_mapping_tbl m ON h.Hobby_ID = m.Hobby_ID
       WHERE m.Student_ID = ?`,
      [user.S_ID]
    );

    // Convert [{Hobby_Name: 'Art'}, {Hobby_Name: 'Code'}] -> ['Art', 'Code']
    const hobbiesList = hobbyRows.map((row) => row.Hobby_Name);

    const [collegeRows] = await db.query(
      "SELECT College_Name FROM college_tbl WHERE College_ID = ?",
      [user.College_ID]
    );
    const collegeName = collegeRows[0]?.College_Name || "N/A";

    // 5. Fetch Degree Name ✅ FIXED DESTRUCTURING
    const [degreeRows] = await db.query(
      "SELECT Degree_Name FROM degree_tbl WHERE Degree_ID = ?",
      [user.Degree_ID]
    );
    const degreeName = degreeRows[0]?.Degree_Name || "N/A";

    const userData = {
      id: user.S_ID,
      Name: user.Name,
      Username: user.Username,
      Email: user.Email, // Added
      Roll_No: user.Roll_No, // Added
      Year: user.Year, // Added
      College: collegeName,
      Degree: degreeName,
      Profile_Pic: user.Profile_Pic, // Added
      Hobbies: hobbiesList, // Added Hobbies Array
    };

    req.login(user, (err) => {
      if (err) {
        console.error("Passport Login Error:", err);
        return next(err);
      }

      console.log("Session created for User ID:", user.S_ID);

      return res.status(200).json({
        message: "Login successful",
        user: userData,
      });
    });
  } catch (error) {
    // CRITICAL FIX: Print the actual error to your terminal
    console.error("🔥 SERVER CRASH IN LOGIN:", error);
    res.status(500).json({ message: "Server Error." });
  }
};

export const userLogout = (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: "Logout failed" });

    req.session = null; // Clear cookie-session
    res.clearCookie("session"); // Clear browser cookie
    res.clearCookie("session.sig"); // Clear signature

    return res.status(200).json({ message: "Logged out successfully" });
  });
};
