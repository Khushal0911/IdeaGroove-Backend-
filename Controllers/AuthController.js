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
// export const userLogin = async (req, res, next) => {
//   try {
//     const { username, password } = req.body;
//     if (!username || !password)
//       return res.status(400).json({ message: "Missing credentials." });
//     console.log("Login Attempt:", username);

//     const [rows] = await db.query(
//       "SELECT * FROM student_tbl WHERE Username = ?",
//       [username]
//     );
//     if (rows.length === 0)
//       return res.status(400).json({ message: "Invalid credentials." });

//     const user = rows[0];
//     const match = await bcrypt.compare(password, user.Password);
//     if (!match)
//       return res.status(400).json({ message: "Invalid credentials." });

//     req.login(user, (err) => {
//       if (err) {
//         console.error("Passport Login Error:", err);
//         return next(err);
//       }

//       // Session is now saved! Cookie will be sent to browser.
//       return res.status(200).json({
//         message: "Login successful",
//         user: {
//           id: user.S_ID,
//           Name: user.Name,
//           Username: user.Username,
//         },
//       });
//     });
//   } catch (error) {
//     res.status(500).json({ message: "Server Error." });
//   }
// };

export const userLogin = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    console.log("Received Login Payload:", req.body);

    if (!username || !password)
      return res.status(400).json({ message: "Missing credentials." });

    console.log("🔹 Login Attempt for:", username);

    const [rows] = await db.query(
      "SELECT * FROM student_tbl WHERE Username = ?",
      [username]
    );

    if (rows.length === 0) {
      console.log("❌ User not found");
      return res.status(400).json({ message: "Invalid credentials." });
    }

    const user = rows[0];
    console.log(user);

    // ✅ This line will crash if bcrypt is not imported
    const match = await bcrypt.compare(password, user.Password);
    console.log("Password Match Result:", match);
    if (!match) {
      console.log("❌ Password mismatch");
      return res.status(400).json({ message: "Invalid credentials." });
    }
    console.log("✅ User authenticated:", username);
    req.login(user, (err) => {
      if (err) {
        console.error("❌ Passport Login Error:", err);
        return next(err);
      }

      console.log("✅ Session created for User ID:", user.S_ID);

      return res.status(200).json({
        message: "Login successful",
        user: {
          id: user.S_ID,
          Name: user.Name,
          Username: user.Username,
        },
      });
    });
  } catch (error) {
    // ✅ CRITICAL FIX: Print the actual error to your terminal
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
