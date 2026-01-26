import bcrypt from "bcryptjs";
import db from "../config/db.js";
import jwt from "jsonwebtoken"; // Import JWT
import nodemailer from "nodemailer";

// --- FORGOT PASSWORD (STATELESS) ---
export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    // 1. Find the user
    const [user] = await db.query("SELECT * FROM student_tbl WHERE Email = ?", [
      email,
    ]);

    if (user.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const targetUser = user[0];

    // 2. Create a One-Time Secret
    // We combine the Global Secret + The User's Current Password
    // If the user changes their password later, this secret changes, invalidating old tokens!
    const secret = process.env.JWT_SECRET + targetUser.Password;

    // 3. Generate the Token (Payload: User ID and Email)
    const token = jwt.sign(
      { id: targetUser.S_ID, email: targetUser.Email },
      secret,
      { expiresIn: "15m" }, // Token valid for 15 minutes
    );

    // Send Email
    // Note: We include the ID in the URL to help us find the user quickly during reset
    // /resetPassword/USER_ID/TOKEN
    const resetUrl = `http://localhost:5173/resetPassword/${targetUser.S_ID}/${token}`;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      to: email,
      from: process.env.EMAIL_USER,
      subject: "Password Reset Request",
      text: `Hello ${targetUser.Username} Click this link to reset your password: ${resetUrl}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #1A3C20;">Password Reset Request</h2>
          <p>Hello <strong>${targetUser.Username}</strong>,</p>
          <p>The Link will <strong style="color: #1A3C20;">expire</strong> in <strong style="color: #1A3C20;">15 minutes</strong>.</p>
          <p>You requested a password reset. Click the button below to set a new password:</p>
          
          <a href="${resetUrl}" style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; margin: 10px 0;">
            Reset Password
          </a>
          <p style="margin-top: 20px;">If the button above doesn't work, verify the link below:</p>
          <p><a href="${resetUrl}" style="color: #16a34a;">${resetUrl}</a></p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: "Reset link sent to email." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};

// --- RESET PASSWORD (STATELESS) ---
export const resetPassword = async (req, res) => {
  const { id, token } = req.params; // Get ID and Token from URL
  const { password } = req.body;

  try {
    // 1. Find User by ID first
    const [user] = await db.query("SELECT * FROM student_tbl WHERE S_ID = ?", [
      id,
    ]);

    if (user.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    const targetUser = user[0];

    // 2. Recreate the Secret used to sign the token
    // (Global Secret + User's CURRENT Password Hash from DB)
    const secret = process.env.JWT_SECRET + targetUser.Password;

    // 3. Verify the Token
    try {
      jwt.verify(token, secret);
    } catch (err) {
      return res.status(400).json({ message: "Invalid or expired token." });
    }

    // 4. Hash New Password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 5. Update Password in DB
    await db.query("UPDATE student_tbl SET Password = ? WHERE S_ID = ?", [
      hashedPassword,
      id,
    ]);

    res.status(200).json({ message: "Password successfully updated." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};

// --- REGISTER CONTROLLER ---
export const userRegister = async (req, res) => {
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
      [newStudentId],
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
      [newStudentId],
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

    if (!username || !password)
      return res.status(400).json({ message: "Missing credentials." });

    const [rows] = await db.query(
      "SELECT * FROM student_tbl WHERE Username = ?",
      [username],
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
      [user.S_ID],
    );

    // Convert [{Hobby_Name: 'Art'}, {Hobby_Name: 'Code'}] -> ['Art', 'Code']
    const hobbiesList = hobbyRows.map((row) => row.Hobby_Name);

    const [collegeRows] = await db.query(
      "SELECT College_Name FROM college_tbl WHERE College_ID = ?",
      [user.College_ID],
    );
    const collegeName = collegeRows[0]?.College_Name || "N/A";

    const [degreeRows] = await db.query(
      "SELECT Degree_Name FROM degree_tbl WHERE Degree_ID = ?",
      [user.Degree_ID],
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

      return res.status(200).json({
        message: "Login successful",
        user: userData,
      });
    });
  } catch (error) {
    // CRITICAL FIX: Print the actual error to your terminal
    console.error("SERVER CRASH IN LOGIN:", error);
    res.status(500).json({ message: "Server Error." });
  }
};

export const userLogout = (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: "Logout failed" });

    req.session = null;
    res.clearCookie("session"); // Clear browser cookie
    res.clearCookie("session.sig"); // Clear signature

    return res.status(200).json({ message: "Logged out successfully" });
  });
};
